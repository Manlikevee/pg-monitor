import { useState } from "react";
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Dimensions,
} from "react-native";
import { router } from "expo-router";
import {
  Activity,
  Timer,
  Database,
  ChevronRight,
} from "lucide-react-native";
import {
  Page,
  Header,
  Card,
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
import { LineChart } from "react-native-gifted-charts";
function ago(d) {
  if (!d) return "Not checked";
  const m = Math.max(0, Math.floor((Date.now() - new Date(d)) / 60000));
  return m < 1
    ? "Just now"
    : m < 60
      ? `${m}m ago`
      : `${Math.floor(m / 60)}h ago`;
}
export default function Dashboard() {
  const { data, addEvent, updateDb, getDbPassword } = useApp();
  const c = useColors();
  const [busy, setBusy] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const dbs = data.databases;
  const online = dbs.filter((d) => d.status === "online").length,
    offline = dbs.filter((d) => d.status === "offline").length,
    unknown = dbs.length - online - offline;
  const checks = data.history.filter(
    (h) => h.type === "success" || h.type === "failed",
  );
  const success = checks.length
    ? Math.round(
        (100 * checks.filter((h) => h.type === "success").length) /
          checks.length,
      )
    : null;
  const latency = checks.filter((h) => h.latencyMs).map((h) => h.latencyMs);
  const responsePoints = checks
    .filter((h) => Number.isFinite(h.latencyMs) && h.latencyMs > 0)
    .slice(0, 10)
    .reverse()
    .map((h, i) => ({ value: h.latencyMs, label: String(i + 1) }));
  const avg = latency.length
    ? Math.round(latency.reduce((a, b) => a + b, 0) / latency.length)
    : null;
  const nextCheck = data.preferences.monitoringEnabled
    ? dbs
        .filter((d) => d.schedule?.enabled && d.schedule?.nextCheckAt)
        .map((d) => ({ name: d.name, at: d.schedule.nextCheckAt }))
        .sort((a, b) => new Date(a.at) - new Date(b.at))[0]
    : null;
  const ping = async (d) => {
    if (!data.backend?.url) {
      return Alert.alert(
        "Live checks need a private checker",
        "PG Monitor stores your settings on this phone, but Expo cannot open PostgreSQL connections directly. To run real pings without a cloud service, use a checker on your own computer or private network.",
        [
          { text: "Not now", style: "cancel" },
          { text: "Set up checker", onPress: () => router.push("/monitoring-backend") },
        ],
      );
    }
    setBusy(d.id);
    try {
      const r = await checkDatabase(
        { ...d, password: await getDbPassword(d.id) },
        data.backend,
      );
      const type = r.success ? "success" : "failed";
      const failures = r.success ? 0 : (d.consecutiveFailures || 0) + 1;
      const offlineAlertSent = await notifyCheckOutcome({
        database: { ...d, offlineAlertSent: !!d.offlineAlertSent },
        success: r.success,
        latencyMs: r.latencyMs,
        preferences: data.preferences,
        previousStatus: d.status,
        failures,
      });
      await updateDb(d.id, {
        status: r.success ? "online" : "offline",
        consecutiveFailures: failures,
        offlineAlertSent: r.success ? false : (!!d.offlineAlertSent || offlineAlertSent),
        offlineEventRecorded: r.success ? false : (!!d.offlineEventRecorded || failures >= (data.preferences.failuresBeforeAlert || 2)),
        lastChecked: r.checkedAt,
        lastSuccess: r.success ? r.checkedAt : d.lastSuccess,
        latencyMs: r.latencyMs,
      });
      await addEvent({
        databaseId: d.id,
        databaseName: d.name,
        type,
        source: "manual",
        latencyMs: r.latencyMs,
        error: r.error,
      });
      if (!r.success && failures >= (data.preferences.failuresBeforeAlert || 2) && !d.offlineEventRecorded) {
        await addEvent({
          databaseId: d.id,
          databaseName: d.name,
          type: "offline",
          source: "manual",
          error: "Consecutive checks failed.",
        });
      }
      if (r.success && d.status === "offline") {
        await addEvent({
          databaseId: d.id,
          databaseName: d.name,
          type: "recovered",
          source: "manual",
        });
      }
      await notifySuccessRateDrop({
        database: d,
        history: [{ type, databaseId: d.id }, ...data.history],
        preferences: data.preferences,
      });
    } catch (e) {
      Alert.alert("Check unavailable", e.message);
    } finally {
      setBusy(null);
    }
  };
  const refreshAll = async () => {
    if (!data.backend?.url) {
      Alert.alert('Private checker needed', 'To run real PostgreSQL checks without a cloud service, configure a self-hosted checker on your computer or private network.', [{text:'Not now',style:'cancel'},{text:'Set up checker',onPress:()=>router.push('/monitoring-backend')}]);
      return;
    }
    setRefreshing(true);
    try {
      for (const db of dbs) await ping(db);
    } finally {
      setRefreshing(false);
    }
  };
  return (
    <Page>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 30 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshAll}
            tintColor={c.green}
          />
        }
      >
        <Header
          title="Good morning"
          subtitle="Your PostgreSQL fleet at a glance"
          right={
            <TouchableOpacity onPress={() => router.push("/profile")}>
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 21,
                  backgroundColor: "#0a9b7018",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: c.green, fontWeight: "800" }}>
                  {data.user?.firstName?.[0] || "P"}
                </Text>
              </View>
            </TouchableOpacity>
          }
        />
        <View style={{ paddingHorizontal: 16 }}>
          <Card
            style={{
              backgroundColor: c.dark ? "#102820" : "#e9f6f0",
              borderColor: "transparent",
              padding: 20,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <View>
                <Text
                  style={{ color: c.green, fontWeight: "700", fontSize: 13 }}
                >
                  MONITORING OVERVIEW
                </Text>
                <Text
                  style={{
                    color: c.text,
                    fontSize: 22,
                    fontWeight: "800",
                    marginTop: 6,
                  }}
                >
                  {dbs.length} {dbs.length === 1 ? "database" : "databases"}
                </Text>
              </View>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 15,
                  backgroundColor: c.green + "20",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Database color={c.green} />
              </View>
            </View>
            <View style={{ flexDirection: "row", marginTop: 20, gap: 0 }}>
              {[
                ["Online", online, c.green],
                ["Offline", offline, c.red],
                ["Unknown", unknown, c.amber],
              ].map(([label, num, color]) => (
                <View key={label} style={{ flex: 1 }}>
                  <Text
                    style={{ fontSize: 24, fontWeight: "800", color: c.text }}
                  >
                    {num}
                  </Text>
                  <Text style={{ fontSize: 12, color }}>{label}</Text>
                </View>
              ))}
            </View>
          </Card>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {[
              [
                "Success rate",
                success === null ? "—" : `${success}%`,
                Activity,
              ],
              ["Avg latency", avg === null ? "—" : `${avg} ms`, Timer],
            ].map(([label, val, Icon]) => (
              <Card key={label} style={{ flex: 1, padding: 14 }}>
                <Icon size={17} color={c.green} />
                <Text
                  style={{
                    fontSize: 20,
                    fontWeight: "800",
                    color: c.text,
                    marginTop: 9,
                  }}
                >
                  {val}
                </Text>
                <Text style={{ fontSize: 12, color: c.muted }}>{label}</Text>
              </Card>
            ))}
          </View>
          <Card style={{ marginTop: 4 }}>
            <Text style={{ fontSize: 16, fontWeight: "800", color: c.text }}>
              Connection history
            </Text>
            <Text style={{ fontSize: 12, color: c.muted, marginTop: 3, marginBottom: 12 }}>
              Recent real checks
            </Text>
            {checks.length === 0 ? (
              <Text style={{ fontSize: 13, color: c.muted }}>
                No check history yet. Connect a monitoring backend to start.
              </Text>
            ) : (
              <>
                <View style={{ height: 42, flexDirection: "row", alignItems: "flex-end", gap: 6, marginBottom: 12 }}>
                  {checks.slice(0, 10).reverse().map((h, i) => (
                    <View key={h.id || i} style={{ flex: 1, height: 30, borderRadius: 5, backgroundColor: h.type === "success" ? c.green : c.red, opacity: 0.82 }} />
                  ))}
                </View>
                <Text style={{ fontSize: 12, color: c.muted, marginBottom: 8 }}>
                  Response time (ms)
                </Text>
                {responsePoints.length > 1 ? (
                  <LineChart
                    data={responsePoints}
                    width={Dimensions.get("window").width - 84}
                    height={105}
                    color={c.green}
                    thickness={2}
                    dataPointsColor={c.green}
                    hideRules
                    hideYAxisText
                    isAnimated
                  />
                ) : (
                  <Text style={{ fontSize: 12, color: c.muted }}>
                    Need two measured checks to show a latency trend.
                  </Text>
                )}
              </>
            )}
          </Card>
          <Card style={{ padding: 14 }}>
            <Text style={{ fontSize: 12, color: c.muted }}>NEXT SCHEDULED CHECK</Text>
            <Text style={{ fontWeight: "800", color: c.text, marginTop: 5 }}>
              {nextCheck
                ? `${nextCheck.name} · ${new Date(nextCheck.at).toLocaleString()}`
                : data.preferences.monitoringEnabled
                  ? "No backend schedule confirmed"
                  : "All schedules are paused"}
            </Text>
          </Card>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 12,
              marginBottom: 10,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "800", color: c.text }}>
              Your databases
            </Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)/databases")}>
              <Text style={{ color: c.green, fontWeight: "700" }}>See all</Text>
            </TouchableOpacity>
          </View>
          {dbs.length === 0 ? (
            <Card style={{ alignItems: "center", padding: 28 }}>
              <Database color={c.green} size={32} />
              <Text
                style={{
                  fontSize: 17,
                  fontWeight: "800",
                  color: c.text,
                  marginTop: 12,
                }}
              >
                No databases yet
              </Text>
              <Text
                style={{
                  color: c.muted,
                  textAlign: "center",
                  marginTop: 6,
                  marginBottom: 14,
                }}
              >
                Add a connection to organize monitoring from one place.
              </Text>
              <Button
                title="Add database"
                onPress={() => router.push("/database")}
              />
            </Card>
          ) : (
            dbs.slice(0, 4).map((d) => (
              <TouchableOpacity
                key={d.id}
                onPress={() =>
                  router.push({ pathname: "/database", params: { id: d.id } })
                }
              >
                <Card style={{ padding: 15 }}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontWeight: "800",
                          fontSize: 16,
                          color: c.text,
                        }}
                      >
                        {d.name}
                      </Text>
                      <Text
                        style={{ fontSize: 12, color: c.muted, marginTop: 3 }}
                      >
                        {d.provider || "PostgreSQL"} ·{" "}
                        {d.environment || "Development"}
                      </Text>
                      <Text
                        style={{ fontSize: 12, color: c.muted, marginTop: 7 }}
                      >
                        {ago(d.lastChecked)}
                        {d.latencyMs ? ` · ${d.latencyMs} ms` : ""}
                      </Text>
                    </View>
                    <Pill
                      color={
                        d.status === "online"
                          ? c.green
                          : d.status === "offline"
                            ? c.red
                            : c.amber
                      }
                    >
                      {busy === d.id ? "checking" : d.status || "unknown"}
                    </Pill>
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        ping(d);
                      }}
                      style={{ padding: 10, marginLeft: 4 }}
                    >
                      <Activity size={18} color={c.green} />
                    </TouchableOpacity>
                    <ChevronRight color={c.muted} size={18} />
                  </View>
                </Card>
              </TouchableOpacity>
            ))
          )}
          <Button
            title="Add database"
            icon="＋"
            onPress={() => router.push("/database")}
          />
          <Text
            style={{
              fontSize: 12,
              color: c.muted,
              textAlign: "center",
              marginTop: 10,
            }}
          >
            Last successful check ·{" "}
            {ago(
              dbs
                .map((d) => d.lastSuccess)
                .filter(Boolean)
                .sort()
                .at(-1),
            )}
          </Text>
        </View>
      </ScrollView>
    </Page>
  );
}
