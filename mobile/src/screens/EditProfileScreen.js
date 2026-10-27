// screens/EditProfileScreen.js — người dùng tự sửa họ tên, ngày sinh, email, số điện thoại
import { useState } from "react";
import { Button, ErrorBox, Field, Muted, Screen } from "../components/ui";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { formatDate } from "../utils/format";

export default function EditProfileScreen({ navigation }) {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({
    name: user.name || "",
    birthDate: user.birthDate ? formatDate(user.birthDate) : "",
    email: user.email || "",
    phone: user.phone || "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    if (!form.name.trim()) return setError("Họ và tên không được để trống.");
    if (form.birthDate && !/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(form.birthDate.trim())) {
      return setError("Ngày sinh theo dạng dd/mm/yyyy, VD: 05/09/2010.");
    }
    setBusy(true);
    setError("");
    try {
      setUser(await api.updateMe({ ...form, birthDate: form.birthDate.trim() || null }));
      navigation.goBack();
    } catch (err) {
      setError(err.message || "Không lưu được thông tin.");
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Muted style={{ marginBottom: 12 }}>Tên đăng nhập, chức danh và lớp do nhà trường quản lý.</Muted>
      <ErrorBox message={error} />
      <Field label="Họ và tên *" value={form.name} onChangeText={set("name")} />
      <Field label="Ngày sinh (dd/mm/yyyy)" value={form.birthDate} onChangeText={set("birthDate")} placeholder="05/09/2010" keyboardType="numbers-and-punctuation" />
      <Field label="Email" value={form.email} onChangeText={set("email")} autoCapitalize="none" keyboardType="email-address" />
      <Field label="Số điện thoại" value={form.phone} onChangeText={set("phone")} keyboardType="phone-pad" />
      <Button title="Lưu thông tin" icon="save-outline" onPress={save} loading={busy} />
    </Screen>
  );
}
