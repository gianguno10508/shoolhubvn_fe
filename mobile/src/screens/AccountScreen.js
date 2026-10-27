// screens/AccountScreen.js — thông tin tài khoản, đổi thông tin, đổi mật khẩu, đăng xuất
import { Alert, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Avatar, Card, ListItem, Screen, SectionTitle } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import AppFooter from "../components/AppFooter";
import { colors, radius, shadow, space } from "../theme";
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
    ["at-outline", "Tên đăng nhập", user.username],
    ["school-outline", "Trường", user.school?.name],
    ["people-outline", "Lớp", user.className],
    ["gift-outline", "Ngày sinh", user.birthDate ? formatDate(user.birthDate) : ""],
    ["mail-outline", "Email", user.email],
    ["call-outline", "Số điện thoại", user.phone],
  ].filter(([, , v]) => v);

  return (
    <Screen>
      <View style={styles.hero}>
        <View style={styles.heroBlob} />
        <Avatar name={user.name || user.username} size={68} color="rgba(255,255,255,0.22)" style={styles.avatar} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={2}>
            {user.name || user.username}
          </Text>
          <View style={styles.roleChip}>
            <Ionicons name="ribbon-outline" size={13} color={colors.primaryDark} />
            <Text style={styles.roleText}>{ROLE_LABEL[user.role] || user.role}</Text>
          </View>
        </View>
      </View>

      {user.mustChangePassword && (
        <View style={styles.warn}>
          <Ionicons name="warning-outline" size={20} color={colors.warning} />
          <Text style={styles.warnText}>Bạn đang dùng mật khẩu mặc định. Hãy đổi mật khẩu để bảo vệ tài khoản.</Text>
        </View>
      )}

      <SectionTitle title="Thông tin" />
      <Card style={styles.listCard}>
        {rows.map(([icon, k, v], i) => (
          <ListItem key={k} icon={icon} title={k} value={v} last={i === rows.length - 1} />
        ))}
      </Card>

      <SectionTitle title="Cài đặt" />
      <Card style={styles.listCard}>
        <ListItem
          icon="create-outline"
          iconColor={colors.blue}
          iconBg={colors.blueSoft}
          title="Đổi thông tin cá nhân"
          onPress={() => navigation.navigate("EditProfile")}
        />
        <ListItem
          icon="key-outline"
          iconColor={colors.success}
          iconBg={colors.successSoft}
          title="Đổi mật khẩu"
          subtitle={user.mustChangePassword ? "Nên đổi ngay" : undefined}
          onPress={() => navigation.navigate("ChangePassword")}
        />
        <ListItem icon="log-out-outline" title="Đăng xuất" danger onPress={confirmLogout} last />
      </Card>

      <AppFooter />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.lg,
    padding: space.xl,
    marginBottom: space.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.primary,
    overflow: "hidden",
    ...shadow(2, colors.primary),
  },
  heroBlob: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    top: -70,
    right: -50,
    backgroundColor: "rgba(124,58,237,0.5)",
  },
  avatar: { borderWidth: 3, borderColor: "rgba(255,255,255,0.5)" },
  name: { fontSize: 20, fontWeight: "900", color: "#fff", letterSpacing: -0.3 },
  roleChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: "#fff",
  },
  roleText: { fontSize: 12, fontWeight: "800", color: colors.primaryDark },
  warn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: space.md,
    marginBottom: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    backgroundColor: colors.warningSoft,
  },
  warnText: { flex: 1, color: colors.warning, fontWeight: "600", fontSize: 14 },
  listCard: { paddingVertical: space.xs },
});
