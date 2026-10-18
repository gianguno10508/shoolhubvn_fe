// screens/ChangePasswordScreen.js — đổi mật khẩu (bắt buộc khi đang dùng mật khẩu mặc định)
import { useState } from "react";
import { Button, ErrorBox, Field, Muted, Screen } from "../components/ui";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function ChangePasswordScreen({ navigation, forced = false }) {
  const { setUser, logout } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (next.length < 6) return setError("Mật khẩu mới cần ít nhất 6 ký tự.");
    if (next !== again) return setError("Nhập lại mật khẩu mới chưa khớp.");
    setBusy(true);
    setError("");
    try {
      const { user } = await api.changePassword(current, next);
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
      <Field label="Mật khẩu hiện tại" value={current} onChangeText={setCurrent} secureTextEntry />
      <Field label="Mật khẩu mới (ít nhất 6 ký tự)" value={next} onChangeText={setNext} secureTextEntry />
      <Field label="Nhập lại mật khẩu mới" value={again} onChangeText={setAgain} secureTextEntry />
      <Button title="Đổi mật khẩu" onPress={save} loading={busy} />
      {forced && <Button title="Đăng xuất" variant="light" onPress={logout} style={{ marginTop: 12 }} />}
    </Screen>
  );
}
