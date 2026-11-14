import React from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useApp } from "../state/AppContext";
export function useColors() {
  const { theme } = useApp();
  const dark = theme === "dark";
  return {
    dark,
    bg: dark ? "#0b1412" : "#f5f8f7",
    card: dark ? "#13201b" : "#fff",
    text: dark ? "#eff6f2" : "#17251f",
    muted: dark ? "#97a9a1" : "#718078",
    line: dark ? "#263831" : "#e2eae5",
    green: "#0a9b70",
    red: "#df5c55",
    amber: "#c58b29",
  };
}
export function Page({ children }) {
  const c = useColors();
  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: c.bg }}>
      {children}
    </SafeAreaView>
  );
}
export function Header({ title, subtitle, right }) {
  const c = useColors();
  return (
    <View style={s.header}>
      <View style={{ flex: 1 }}>
        <Text style={[s.title, { color: c.text }]}>{title}</Text>
        {subtitle ? (
          <Text style={{ color: c.muted, marginTop: 4 }}>{subtitle}</Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}
export function Card({ children, style }) {
  const c = useColors();
  return (
    <View
      style={[s.card, { backgroundColor: c.card, borderColor: c.line }, style]}
    >
      {children}
    </View>
  );
}
export function Button({ title, onPress, secondary, danger, icon, disabled }) {
  const c = useColors();
  return (
    <TouchableOpacity
      disabled={disabled}
      onPress={onPress}
      style={[
        s.button,
        {
          backgroundColor: secondary
            ? "transparent"
            : danger
              ? "#d9514c"
              : c.green,
          borderColor: secondary ? c.line : "transparent",
          opacity: disabled ? 0.55 : 1,
        },
      ]}
    >
      <Text
        style={{
          color: secondary ? c.text : "#fff",
          fontWeight: "700",
          fontSize: 14,
        }}
      >
        {icon ? `${icon}  ` : ""}
        {title}
      </Text>
    </TouchableOpacity>
  );
}
export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  multiline,
  editable = true,
}) {
  const c = useColors();
  return (
    <View style={{ marginBottom: 14 }}>
      <Text
        style={{
          color: c.text,
          fontSize: 13,
          fontWeight: "600",
          marginBottom: 7,
        }}
      >
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        editable={editable}
        placeholderTextColor={c.muted}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        multiline={multiline}
        autoCapitalize={keyboardType === "email-address" ? "none" : "sentences"}
        style={[
          s.field,
          {
            color: c.text,
            borderColor: c.line,
            backgroundColor: c.card,
            height: multiline ? 84 : 48,
            textAlignVertical: multiline ? "top" : "center",
          },
        ]}
      />
    </View>
  );
}
export function Pill({ children, color }) {
  const c = useColors();
  return (
    <View
      style={{
        backgroundColor: (color || c.green) + "18",
        paddingHorizontal: 9,
        paddingVertical: 5,
        borderRadius: 99,
        alignSelf: "flex-start",
      }}
    >
      <Text
        style={{ color: color || c.green, fontWeight: "700", fontSize: 11 }}
      >
        {children}
      </Text>
    </View>
  );
}
export const s = StyleSheet.create({
  header: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 18,
    flexDirection: "row",
    alignItems: "center",
  },
  title: { fontSize: 26, fontWeight: "750", letterSpacing: -0.5 },
  card: { borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 12 },
  button: {
    height: 45,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginVertical: 5,
    paddingHorizontal: 16,
  },
  field: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  link: { fontSize: 14, fontWeight: "700", color: "#0a9b70" },
});
