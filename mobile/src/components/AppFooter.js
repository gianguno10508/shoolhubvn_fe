// components/AppFooter.js — dòng bản quyền & nhà phát triển ở cuối màn hình đăng nhập / tài khoản
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BRAND, copyrightText } from "../constants/brand";
import { colors, radius, space } from "../theme";

export default function AppFooter() {
  return (
    <View style={styles.wrap}>
      <View style={styles.brandRow}>
        <View style={styles.logo}>
          <Ionicons name="school" size={14} color="#fff" />
        </View>
        <Text style={styles.brand}>{BRAND.name}</Text>
        <View style={styles.version}>
          <Text style={styles.versionText}>v{BRAND.version}</Text>
        </View>
      </View>
      <Text style={styles.text}>{BRAND.tagline}</Text>
      <Text style={styles.text}>{copyrightText()}. Bảo lưu mọi quyền.</Text>
      <View style={styles.devRow}>
        <Ionicons name="code-slash" size={12} color={colors.muted} />
        <Text style={styles.text}>
          Phát triển bởi <Text style={styles.dev}>{BRAND.developer}</Text>
        </Text>
        <Ionicons name="heart" size={12} color={colors.danger} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: 3, marginTop: space.xl, paddingVertical: space.md },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
  logo: { width: 22, height: 22, borderRadius: 7, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  brand: { color: colors.primary, fontSize: 15, fontWeight: "900" },
  version: { paddingHorizontal: 7, paddingVertical: 1, borderRadius: radius.pill, backgroundColor: colors.primarySoft },
  versionText: { color: colors.primaryDark, fontSize: 11, fontWeight: "700" },
  text: { color: colors.muted, fontSize: 12, textAlign: "center" },
  devRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  dev: { color: colors.text, fontWeight: "800" },
});
