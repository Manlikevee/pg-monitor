import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import { pbkdf2Async } from "@noble/hashes/pbkdf2.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
const C = createContext(null);
const KEY = "pgm:v1:data";
const empty = {
  onboarded: false,
  user: null,
  databases: [],
  history: [],
  preferences: {
    theme: "system",
    biometricEnabled: false,
    monitoringEnabled: true,
    notifications: true,
    offlineAlerts: true,
    recoveryAlerts: true,
    successAlerts: false,
    failureAlerts: false,
    threshold: 95,
    failuresBeforeAlert: 2,
    quietStart: "22:00",
    quietEnd: "08:00",
  },
  backend: { url: "", token: "" },
};
export function AppProvider({ children }) {
  const [data, setData] = useState(empty);
  const dataRef = useRef(empty);
  const [ready, setReady] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const systemScheme = useColorScheme();
  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(KEY),
      SecureStore.getItemAsync("pgm-backend-token"),
    ])
      .then(([x, token]) => {
        if (x) {
          const restored = JSON.parse(x);
          const next = {
            ...empty,
            ...restored,
            backend: {
              ...empty.backend,
              ...restored.backend,
              token: token || "",
            },
            preferences: { ...empty.preferences, ...restored.preferences },
          };
          dataRef.current = next;
          setData(next);
          setSessionActive(!!restored.session);
        } else {
          const next = { ...empty, backend: { url: "", token: token || "" } };
          dataRef.current = next;
          setData(next);
        }
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);
  const save = async (next) => {
    dataRef.current = next;
    setData(next);
    const persisted = { ...next, backend: { url: next.backend?.url || "" } };
    await AsyncStorage.setItem(KEY, JSON.stringify(persisted));
  };
  const patch = async (p) => {
    if (p.backend && Object.prototype.hasOwnProperty.call(p.backend, "token"))
      await SecureStore.setItemAsync(
        "pgm-backend-token",
        p.backend.token || "",
      );
    return save({
      ...dataRef.current,
      ...p,
      backend: p.backend
        ? { ...dataRef.current.backend, ...p.backend }
        : dataRef.current.backend,
    });
  };
  const hash = async (pass, salt, iterations = 120_000) => {
    const derived = await pbkdf2Async(
      sha256,
      utf8ToBytes(pass),
      utf8ToBytes(salt),
      { c: iterations, dkLen: 32 },
    );
    return bytesToHex(derived);
  };
  const register = async (profile) => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email))
      throw Error("Enter a valid email address.");
    if (await SecureStore.getItemAsync("pgm-auth"))
      throw Error("A local account already exists. Sign in to continue.");
    const salt = Crypto.randomUUID();
    const iterations = 120_000;
    const passwordHash = await hash(profile.password, salt, iterations);
    await SecureStore.setItemAsync(
      "pgm-auth",
      JSON.stringify({
        email: profile.email.toLowerCase(),
        salt,
        iterations,
        passwordHash,
      }),
    );
    await patch({
      user: {
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email.toLowerCase(),
      },
      session: true,
      onboarded: true,
    });
    setSessionActive(true);
  };
  const login = async (email, password, remember = true) => {
    const x = await SecureStore.getItemAsync("pgm-auth");
    if (!x) throw Error("No local account was found on this device.");
    const a = JSON.parse(x);
    const iterations = a.iterations || 310_000;
    if (
      a.email !== email.trim().toLowerCase() ||
      a.passwordHash !== (await hash(password, a.salt, iterations))
    )
      throw Error("That email and password do not match.");
    if (iterations !== 120_000) {
      void (async () => {
        const salt = Crypto.randomUUID();
        const passwordHash = await hash(password, salt, 120_000);
        const latest = await SecureStore.getItemAsync("pgm-auth");
        if (latest !== x) return;
        await SecureStore.setItemAsync(
          "pgm-auth",
          JSON.stringify({ email: a.email, salt, iterations: 120_000, passwordHash }),
        );
      })().catch(() => {});
    }
    await patch({ session: !!remember });
    setSessionActive(true);
  };
  const changePassword = async (current, next) => {
    const raw = await SecureStore.getItemAsync("pgm-auth");
    if (!raw) throw Error("Local account was not found.");
    const auth = JSON.parse(raw);
    if (auth.passwordHash !== (await hash(current, auth.salt, auth.iterations || 310_000)))
      throw Error("Current password is incorrect.");
    if (next.length < 10)
      throw Error("Use at least 10 characters for your new password.");
    const salt = Crypto.randomUUID();
    await SecureStore.setItemAsync(
      "pgm-auth",
      JSON.stringify({
        email: auth.email,
        salt,
        iterations: 120_000,
        passwordHash: await hash(next, salt, 120_000),
      }),
    );
  };
  const changeEmail = async (currentPassword, nextEmail) => {
    const raw = await SecureStore.getItemAsync("pgm-auth");
    if (!raw) throw Error("Local account was not found.");
    const auth = JSON.parse(raw);
    if (auth.passwordHash !== (await hash(currentPassword, auth.salt, auth.iterations || 310_000)))
      throw Error("Password is incorrect.");
    const email = nextEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw Error("Enter a valid email address.");
    await SecureStore.setItemAsync(
      "pgm-auth",
      JSON.stringify({ ...auth, email }),
    );
    await patch({ user: { ...dataRef.current.user, email } });
  };
  const logout = () => {
    setSessionActive(false);
    return patch({ session: false });
  };
  const addDb = async (db) => {
    const id = Crypto.randomUUID();
    if (db.password)
      await SecureStore.setItemAsync(`pgm-db-${id}`, db.password);
    const safe = {
      ...db,
      id,
      password: undefined,
      status: "unknown",
      createdAt: new Date().toISOString(),
      schedule: db.schedule || {
        enabled: false,
        interval: 15,
        days: [0, 1, 2, 3, 4, 5, 6],
        start: "00:00",
        end: "23:59",
        timezone: "UTC",
      },
    };
    await patch({ databases: [...dataRef.current.databases, safe] });
    return id;
  };
  const updateDb = async (id, changes) => {
    const next = [...dataRef.current.databases];
    const i = next.findIndex((d) => d.id === id);
    if (i < 0) return;
    if (changes.password !== undefined) {
      if (changes.password)
        await SecureStore.setItemAsync(`pgm-db-${id}`, changes.password);
      delete changes.password;
    }
    next[i] = { ...next[i], ...changes };
    await patch({ databases: next });
  };
  const getDbPassword = (id) => SecureStore.getItemAsync(`pgm-db-${id}`);
  const deleteAccount = async () => {
    await Promise.all(dataRef.current.databases.map((d) => SecureStore.deleteItemAsync(`pgm-db-${d.id}`)));
    await SecureStore.deleteItemAsync("pgm-auth");
    await SecureStore.deleteItemAsync("pgm-backend-token");
    setSessionActive(false);
    await AsyncStorage.removeItem(KEY);
    dataRef.current = empty;
    setData(empty);
  };
  const removeDb = async (id) => {
    await SecureStore.deleteItemAsync(`pgm-db-${id}`);
    await patch({
      databases: dataRef.current.databases.filter((d) => d.id !== id),
      history: dataRef.current.history.filter((h) => h.databaseId !== id),
    });
  };
  const addEvent = async (e) =>
    patch({
      history: [
        { id: Crypto.randomUUID(), at: new Date().toISOString(), ...e },
        ...dataRef.current.history,
      ].slice(0, 1000),
    });
  const theme =
    data.preferences.theme === "system"
      ? systemScheme === "dark"
        ? "dark"
        : "light"
      : data.preferences.theme;
  const value = ({
      data,
      ready,
      sessionActive,
      theme,
      patch,
      register,
      login,
      changePassword,
      changeEmail,
      logout,
      addDb,
      updateDb,
      removeDb,
      getDbPassword,
      deleteAccount,
      addEvent,
      save,
    });
  return <C.Provider value={value}>{children}</C.Provider>;
}
export const useApp = () => useContext(C);
