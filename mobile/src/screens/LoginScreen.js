// screens/LoginScreen.js — đăng nhập bằng tài khoản nhà trường cấp
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BASE_URL } from "../api/client";
import { Button, ErrorBox, Field, Muted } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { colors, radius, space } from "../theme";

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
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
          <View style={styles.logo}>
            <Text style={styles.logoIcon}>🏫</Text>
          </View>
          <Text style={styles.title}>SchoolHub</Text>
          <Muted style={styles.subtitle}>Đăng nhập bằng tài khoản nhà trường cấp cho bạn</Muted>

          <View style={styles.card}>
            <ErrorBox message={error} />
            <Field
              label="Tên đăng nhập"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="VD: nguyenvana.0105"
              returnKeyType="next"
            />
            <Field
              label="Mật khẩu"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="Mật khẩu"
              returnKeyType="go"
              onSubmitEditing={submit}
            />
            <Button title="Đăng nhập" onPress={submit} loading={busy} />
          </View>
          <Muted style={styles.server}>Máy chủ: {BASE_URL}</Muted>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  wrap: { flexGrow: 1, justifyContent: "center", padding: space.xl },
  logo: {
    alignSelf: "center",
    width: 76,
    height: 76,
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space.md,
  },
  logoIcon: { fontSize: 40 },
  title: { fontSize: 26, fontWeight: "800", color: colors.text, textAlign: "center" },
  subtitle: { textAlign: "center", marginTop: space.xs, marginBottom: space.xl },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
  },
  server: { textAlign: "center", marginTop: space.lg, fontSize: 11 },
});
