// screens/AccountScreen.js — thông tin tài khoản, đổi thông tin, đổi mật khẩu, đăng xuất
import { Alert, StyleSheet, Text, View } from "react-native";
import { Body, Button, Card, Muted, Screen } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { colors, space } from "../theme";
import { formatDate, ROLE_LABEL } from "../utils/format";

export default function AccountScreen({ navigation }) {
  const { user, logout } = useAuth();

  function confirmLogout() {
    Alert.alert("Đăng xuất", "Bạn muốn đăng xuất khỏi tài khoản này?", [
      { text: "Huỷ", style: "cancel" },
      { text: "Đăng xuất", style: "destructive", onPress: logout },
    ]);
  }

  const rows = [
    ["Tên đăng nhập", user.username],
    ["Chức danh", ROLE_LABEL[user.role] || user.role],
    ["Trường", user.school?.name],
    ["Lớp", user.className],
    ["Ngày sinh", user.birthDate ? formatDate(user.birthDate) : ""],
    ["Email", user.email],
    ["Số điện thoại", user.phone],
  ].filter(([, v]) => v);

  return (
    <Screen>
      <View style={styles.head}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(user.name || user.username || "?").charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.name}>{user.name || user.username}</Text>
        <Muted>{ROLE_LABEL[user.role]}</Muted>
      </View>

      {user.mustChangePassword && (
        <Card style={styles.warn}>
          <Body style={{ color: colors.warning, fontWeight: "600" }}>
            ⚠️ Bạn đang dùng mật khẩu mặc định. Hãy đổi mật khẩu để bảo vệ tài khoản.
          </Body>
        </Card>
      )}

      <Card>
        {rows.map(([k, v]) => (
          <View key={k} style={styles.row}>
            <Muted>{k}</Muted>
            <Body style={styles.value}>{v}</Body>
          </View>
        ))}
      </Card>

      <Button title="✏️ Đổi thông tin cá nhân" variant="light" onPress={() => navigation.navigate("EditProfile")} style={styles.btn} />
      <Button title="🔑 Đổi mật khẩu" variant="light" onPress={() => navigation.navigate("ChangePassword")} style={styles.btn} />
      <Button title="Đăng xuất" variant="danger" onPress={confirmLogout} style={styles.btn} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: "center", marginBottom: space.lg },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space.sm,
  },
  avatarText: { color: "#fff", fontSize: 30, fontWeight: "700" },
  name: { fontSize: 20, fontWeight: "700", color: colors.text },
  warn: { backgroundColor: colors.warningSoft, borderColor: "#FDE68A" },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  value: { flexShrink: 1, textAlign: "right", marginLeft: space.md },
  btn: { marginBottom: space.md },
});
