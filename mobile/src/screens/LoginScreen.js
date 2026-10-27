// screens/LoginScreen.js — đăng nhập bằng tài khoản nhà trường cấp
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { BASE_URL } from "../api/client";
import { Button, ErrorBox, Field, Muted } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import AppFooter from "../components/AppFooter";
import { BRAND } from "../constants/brand";
import { colors, radius, shadow, space } from "../theme";

const FEATURES = [
  ["calendar-outline", "Thời khóa biểu"],
  ["document-text-outline", "Bài tập"],
  ["trophy-outline", "Thi đua"],
  ["notifications-outline", "Thông báo"],
];

export default function LoginScreen() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!username.trim() || !password) return setError("Vui lòng nhập tên đăng nhập và mật khẩu.");
    setBusy(true);
    setError("");
    try {
      await login(username, password);
    } catch (err) {
      setError(err.message || "Không đăng nhập được.");
      setBusy(false);
    }
  }

  return (
    <View style={styles.root}>
      {/* Nền thương hiệu phía trên + các vòng tròn trang trí */}
      <View style={styles.hero}>
        <View style={[styles.blob, styles.blob1]} />
        <View style={[styles.blob, styles.blob2]} />
        <View style={[styles.blob, styles.blob3]} />
      </View>

      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.brand}>
              <View style={styles.logo}>
                <Ionicons name="school" size={34} color={colors.primary} />
              </View>
              <Text style={styles.title}>{BRAND.name}</Text>
              <Text style={styles.tagline}>{BRAND.tagline}</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Đăng nhập</Text>
              <Muted style={styles.cardHint}>Dùng tài khoản nhà trường cấp cho bạn</Muted>

              <ErrorBox message={error} />
              <Field
                label="Tên đăng nhập"
                icon="person-outline"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="VD: nguyenvana.0105"
                returnKeyType="next"
              />
              <Field
                label="Mật khẩu"
                icon="lock-closed-outline"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="Nhập mật khẩu"
                returnKeyType="go"
                onSubmitEditing={submit}
              />
              <Button title="Đăng nhập" icon="log-in-outline" onPress={submit} loading={busy} style={{ marginTop: space.xs }} />

              <View style={styles.secure}>
                <Ionicons name="shield-checkmark-outline" size={14} color={colors.success} />
                <Text style={styles.secureText}>Kết nối được bảo mật</Text>
              </View>
            </View>

            <View style={styles.features}>
              {FEATURES.map(([icon, label]) => (
                <View key={label} style={styles.feature}>
                  <View style={styles.featureIcon}>
                    <Ionicons name={icon} size={20} color={colors.primary} />
                  </View>
                  <Text style={styles.featureText}>{label}</Text>
                </View>
              ))}
            </View>

            <Muted style={styles.server}>Máy chủ: {BASE_URL}</Muted>
            <AppFooter />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  hero: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 330,
    backgroundColor: colors.primary,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    overflow: "hidden",
  },
  blob: { position: "absolute", borderRadius: 999, backgroundColor: "rgba(255,255,255,0.09)" },
  blob1: { width: 260, height: 260, top: -90, right: -70 },
  blob2: { width: 180, height: 180, bottom: -60, left: -50, backgroundColor: "rgba(124,58,237,0.45)" },
  blob3: { width: 90, height: 90, top: 70, left: 40, backgroundColor: "rgba(37,99,235,0.45)" },
  wrap: { flexGrow: 1, padding: space.xl, paddingTop: space.xl * 1.5 },
  brand: { alignItems: "center", marginBottom: space.xl },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space.md,
    ...shadow(3, colors.primaryDeep),
  },
  title: { fontSize: 30, fontWeight: "900", color: "#fff", letterSpacing: -0.5 },
  tagline: { marginTop: 4, fontSize: 14, color: "rgba(255,255,255,0.82)", fontWeight: "500" },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: space.xl,
    ...shadow(3),
  },
  cardTitle: { fontSize: 22, fontWeight: "900", color: colors.text, letterSpacing: -0.3 },
  cardHint: { marginTop: 2, marginBottom: space.lg },
  secure: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, marginTop: space.md },
  secureText: { fontSize: 12, color: colors.text2, fontWeight: "600" },
  features: { flexDirection: "row", justifyContent: "space-between", marginTop: space.xl },
  feature: { alignItems: "center", flex: 1 },
  featureIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
    ...shadow(1),
  },
  featureText: { fontSize: 11, fontWeight: "700", color: colors.text2 },
  server: { textAlign: "center", marginTop: space.lg, fontSize: 11 },
});
