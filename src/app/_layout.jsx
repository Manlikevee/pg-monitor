import { useEffect, useRef, useState } from "react";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, Platform, Text, View } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import * as Notifications from "expo-notifications";
import { AppProvider, useApp } from "../state/AppContext";
import { Button, Page, useColors } from "../components/ui";
if (Platform.OS !== "web")
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
function RootNavigator() {
  const { ready, theme, data } = useApp();
  const [unlocked, setUnlocked] = useState(null);
  const attempted = useRef(false);
  const c = useColors();
  const requiresLock =
    Platform.OS !== "web" && data.session && data.preferences.biometricEnabled;
  const authenticate = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock PG Monitor",
        fallbackLabel: "Use device passcode",
        disableDeviceFallback: false,
      });
      setUnlocked(!!result.success);
    } catch {
      setUnlocked(false);
    }
  };
  useEffect(() => {
    if (Platform.OS === "web") return;
    const response = Notifications.addNotificationResponseReceivedListener(
      ({ notification }) => {
        const id = notification.request.content.data?.databaseId;
        if (typeof id === "string")
          router.push({ pathname: "/database", params: { id } });
      },
    );
    return () => response.remove();
  }, []);
  useEffect(() => {
    if (!ready || attempted.current || !requiresLock) return;
    attempted.current = true;
    (async () => {
      const available = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (available && enrolled) await authenticate();
      else setUnlocked(true);
    })();
  }, [ready, requiresLock]);
  if (!ready)
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#10a87b" />
      </View>
    );
  if (requiresLock && unlocked !== true)
    return (
      <Page>
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: 28,
          }}
        >
          <Text
            style={{
              fontSize: 24,
              fontWeight: "800",
              color: c.text,
              marginBottom: 8,
            }}
          >
            PG Monitor is locked
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: c.muted,
              textAlign: "center",
              marginBottom: 20,
            }}
          >
            Authenticate with biometrics or your device passcode to continue.
          </Text>
          <Button title="Unlock app" onPress={authenticate} />
        </View>
      </Page>
    );
  return (
    <>
      <StatusBar style={theme === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: theme === "dark" ? "#0b1412" : "#f5f8f7",
          },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="database" />
        <Stack.Screen name="monitoring-backend" />
        <Stack.Screen name="activity" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="import-export" />
        <Stack.Screen name="schedule" />
      </Stack>
    </>
  );
}
export default function RootLayout() {
  return (
    <AppProvider>
      <RootNavigator />
    </AppProvider>
  );
}
