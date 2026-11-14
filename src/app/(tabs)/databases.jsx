import { useState } from "react";
import { Alert, ScrollView, Text, View, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { Plus, Database as DbIcon, ChevronRight } from "lucide-react-native";
import {
  Page,
  Header,
  Card,
  Field,
  Button,
  Pill,
  useColors,
} from "../../components/ui";
import { useApp } from "../../state/AppContext";
import { checkDatabase } from "../../services/api";
import {
  notifyCheckOutcome,
  notifySuccessRateDrop,
} from "../../services/notifications";

export default function Databases() {
  const { data, updateDb, addEvent, getDbPassword } = useApp();
  const c = useColors();
  const [query, setQuery] = useState("");
  const [environment, setEnvironment] = useState("All");
  const [provider, setProvider] = useState("All providers");
  const [group, setGroup] = useState("All groups");
  const [checkingAll, setCheckingAll] = useState(false);
  const [checkProgress, setCheckProgress] = useState("");

  const groups = [
    "All groups",
    ...new Set(data.databases.map((db) => db.group).filter(Boolean)),
  ];
  const providers = [
    "All providers",
    ...new Set(data.databases.map((db) => db.provider || "Other")),
  ];
  const filteredDatabases = data.databases.filter(
    (db) =>
      (!query ||
        `${db.name} ${db.provider} ${db.environment}`
          .toLowerCase()
          .includes(query.toLowerCase())) &&
      (environment === "All" || db.environment === environment) &&
      (provider === "All providers" || (db.provider || "Other") === provider) &&
      (group === "All groups" || db.group === group),
  );

  const checkAll = async () => {
    if (checkingAll) return;
    if (!data.backend?.url) {
      Alert.alert(
        "Checker needed",
        "Add your monitoring checker URL before running real database checks.",
        [
          { text: "Not now", style: "cancel" },
          {
            text: "Set up checker",
            onPress: () => router.push("/monitoring-backend"),
          },
        ],
      );
      return;
    }
    if (!data.databases.length) {
      Alert.alert(
        "No databases yet",
        "Add a database connection before checking all.",
      );
      return;
    }

    setCheckingAll(true);
    let checked = 0;
    let online = 0;
    let backendError = "";
    try {
      for (const db of data.databases) {
        setCheckProgress(
          `Checking ${checked + 1} of ${data.databases.length}: ${db.name}`,
        );
        try {
          const password = await getDbPassword(db.id);
          const result = await checkDatabase({ ...db, password }, data.backend);
          const eventType = result.success ? "success" : "failed";
          const failures = result.success
            ? 0
            : (db.consecutiveFailures || 0) + 1;
          const offlineAlertSent = await notifyCheckOutcome({
            database: { ...db, offlineAlertSent: !!db.offlineAlertSent },
            success: result.success,
            latencyMs: result.latencyMs,
            preferences: data.preferences,
            previousStatus: db.status,
            failures,
          });

          await updateDb(db.id, {
            status: result.success ? "online" : "offline",
            consecutiveFailures: failures,
            offlineAlertSent: result.success
              ? false
              : !!db.offlineAlertSent || offlineAlertSent,
            offlineEventRecorded: result.success
              ? false
              : !!db.offlineEventRecorded ||
                failures >= (data.preferences.failuresBeforeAlert || 2),
            lastChecked: result.checkedAt,
            lastSuccess: result.success ? result.checkedAt : db.lastSuccess,
            latencyMs: result.latencyMs,
          });
          await addEvent({
            databaseId: db.id,
            databaseName: db.name,
            type: eventType,
            source: "manual",
            latencyMs: result.latencyMs,
            error: result.error,
          });

          if (
            !result.success &&
            failures >= (data.preferences.failuresBeforeAlert || 2) &&
            !db.offlineEventRecorded
          ) {
            await addEvent({
              databaseId: db.id,
              databaseName: db.name,
              type: "offline",
              source: "manual",
              error: "Consecutive checks failed.",
            });
          }
          if (result.success && db.status === "offline") {
            await addEvent({
              databaseId: db.id,
              databaseName: db.name,
              type: "recovered",
              source: "manual",
            });
          }
          await notifySuccessRateDrop({
            database: db,
            history: [{ type: eventType, databaseId: db.id }, ...data.history],
            preferences: data.preferences,
          });
          if (result.success) online += 1;
          checked += 1;
        } catch (error) {
          backendError =
            error.message || "Could not reach the monitoring checker.";
          break;
        }
      }

      if (backendError) {
        Alert.alert(
          "Check all stopped",
          `${checked} of ${data.databases.length} databases were checked. ${backendError}`,
        );
      } else {
        Alert.alert(
          "Checks complete",
          `${online} online · ${checked - online} failed · ${checked} checked`,
        );
      }
    } finally {
      setCheckingAll(false);
      setCheckProgress("");
    }
  };

  return (
    <Page>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <Header
          title="Databases"
          subtitle={`${data.databases.length} connections`}
          right={
            <TouchableOpacity onPress={() => router.push("/database")}>
              <View
                style={{
                  backgroundColor: c.green,
                  width: 42,
                  height: 42,
                  borderRadius: 14,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Plus color="white" />
              </View>
            </TouchableOpacity>
          }
        />
        <View style={{ paddingHorizontal: 16 }}>
          {data.databases.length > 0 && (
            <>
              <Button
                title={
                  checkingAll ? "Checking databases…" : "Check all databases"
                }
                onPress={checkAll}
                disabled={checkingAll}
              />
              {checkProgress ? (
                <Text
                  style={{
                    color: c.muted,
                    textAlign: "center",
                    marginBottom: 12,
                  }}
                >
                  {checkProgress}
                </Text>
              ) : null}
            </>
          )}
          <Field
            label="Search"
            value={query}
            onChangeText={setQuery}
            placeholder="Name, provider or environment"
          />
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
            {["All", "Production", "Development", "Staging"].map((value) => (
              <Text
                key={value}
                onPress={() => setEnvironment(value)}
                style={{
                  paddingHorizontal: 13,
                  paddingVertical: 8,
                  borderRadius: 30,
                  overflow: "hidden",
                  backgroundColor: environment === value ? c.green : c.card,
                  color: environment === value ? "white" : c.muted,
                  fontWeight: "700",
                }}
              >
                {value}
              </Text>
            ))}
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: 12 }}
          >
            {providers.map((value) => (
              <Text
                key={value}
                onPress={() => setProvider(value)}
                style={{
                  marginRight: 8,
                  paddingHorizontal: 13,
                  paddingVertical: 8,
                  borderRadius: 30,
                  overflow: "hidden",
                  backgroundColor: provider === value ? c.green : c.card,
                  color: provider === value ? "white" : c.muted,
                  fontWeight: "700",
                }}
              >
                {value}
              </Text>
            ))}
          </ScrollView>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: 12 }}
          >
            {groups.map((value) => (
              <Text
                key={value}
                onPress={() => setGroup(value)}
                style={{
                  marginRight: 8,
                  paddingHorizontal: 13,
                  paddingVertical: 8,
                  borderRadius: 30,
                  overflow: "hidden",
                  backgroundColor: group === value ? c.green : c.card,
                  color: group === value ? "white" : c.muted,
                  fontWeight: "700",
                }}
              >
                {value}
              </Text>
            ))}
          </ScrollView>

          {filteredDatabases.length === 0 ? (
            <Card style={{ alignItems: "center", padding: 30 }}>
              <DbIcon size={34} color={c.green} />
              <Text
                style={{
                  fontSize: 17,
                  fontWeight: "800",
                  color: c.text,
                  marginTop: 12,
                }}
              >
                Nothing here yet
              </Text>
              <Text
                style={{
                  color: c.muted,
                  textAlign: "center",
                  marginVertical: 8,
                }}
              >
                Create a database configuration. Actual checks require a
                monitoring backend.
              </Text>
              <Button
                title="Add database"
                onPress={() => router.push("/database")}
              />
            </Card>
          ) : (
            filteredDatabases.map((db) => (
              <TouchableOpacity
                key={db.id}
                onPress={() =>
                  router.push({ pathname: "/database", params: { id: db.id } })
                }
              >
                <Card>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontWeight: "800",
                          fontSize: 16,
                          color: c.text,
                        }}
                      >
                        {db.name}
                      </Text>
                      <Text
                        style={{ fontSize: 13, color: c.muted, marginTop: 4 }}
                      >
                        {db.provider || "Other"} ·{" "}
                        {db.environment || "Development"}
                      </Text>
                      <Text
                        style={{ fontSize: 12, color: c.muted, marginTop: 7 }}
                      >
                        {db.host?.includes(".")
                          ? `••••.${db.host.split(".").slice(1).join(".")}`
                          : "••••"}
                        :{db.port || 5432} · {db.databaseName}
                      </Text>
                    </View>
                    <Pill
                      color={
                        db.status === "online"
                          ? c.green
                          : db.status === "offline"
                            ? c.red
                            : c.amber
                      }
                    >
                      {db.status || "unknown"}
                    </Pill>
                    <ChevronRight size={18} color={c.muted} />
                  </View>
                </Card>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </Page>
  );
}
