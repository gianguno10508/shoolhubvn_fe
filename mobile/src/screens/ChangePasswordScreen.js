// screens/ChangePasswordScreen.js — đổi mật khẩu (bắt buộc khi đang dùng mật khẩu mặc định)
// Mật khẩu mới: ≥ 8 ký tự, có chữ thường, chữ in hoa, ký tự đặc biệt (máy chủ kiểm tra lại)
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button, ErrorBox, Field, Muted, Screen } from "../components/ui";
import { api, saveToken } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { colors, space } from "../theme";
import { PASSWORD_RULES, passwordError } from "../utils/passwordPolicy";

export default function ChangePasswordScreen({ navigation, forced = false }) {
  const { user: me, setUser, logout } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    const weak = passwordError(next, me?.username);
    if (weak) return setError(weak);
    if (next !== again) return setError("Nhập lại mật khẩu mới chưa khớp.");
    setBusy(true);
    setError("");
    try {
      const { token, user } = await api.changePassword(current, next);
      // Máy chủ thu hồi mọi token cũ khi đổi mật khẩu → lưu token mới để phiên này vẫn dùng tiếp
      if (token) await saveToken(token);
      setUser(user);
      if (!forced) navigation.goBack();
    } catch (err) {
      setError(err.message || "Không đổi được mật khẩu.");
      setBusy(false);
    }
  }

  return (
    <Screen>
      {forced && (
        <Muted style={{ marginBottom: 12 }}>
          Tài khoản đang dùng mật khẩu mặc định do nhà trường cấp. Vui lòng đặt mật khẩu mới để tiếp tục.
        </Muted>
      )}
      <ErrorBox message={error} />
      <Field label="Mật khẩu hiện tại" value={current} onChangeText={setCurrent} secureTextEntry autoCapitalize="none" />
      <Field label="Mật khẩu mới" value={next} onChangeText={setNext} secureTextEntry autoCapitalize="none" />
      <View style={styles.rules}>
        {PASSWORD_RULES.map((r) => {
          const ok = r.test(next);
          return (
            <Text key={r.key} style={[styles.rule, ok && styles.ruleOk]}>
              {ok ? "✓" : "•"} {r.label}
            </Text>
          );
        })}
      </View>
      <Field label="Nhập lại mật khẩu mới" value={again} onChangeText={setAgain} secureTextEntry autoCapitalize="none" />
      <Button title="Đổi mật khẩu" icon="key-outline" onPress={save} loading={busy} />
      {forced && <Button title="Đăng xuất" icon="log-out-outline" variant="dangerSoft" onPress={logout} style={{ marginTop: 12 }} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  rules: { marginTop: -space.xs, marginBottom: space.md },
  rule: { fontSize: 13, color: colors.muted, lineHeight: 20 },
  ruleOk: { color: colors.success, fontWeight: "600" },
});
