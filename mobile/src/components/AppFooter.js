// components/AppFooter.js — dòng bản quyền & nhà phát triển ở cuối màn hình đăng nhập / tài khoản
import { StyleSheet, Text, View } from "react-native";
import { BRAND, copyrightText } from "../constants/brand";
import { colors, space } from "../theme";

export default function AppFooter() {
  return (
    <View style={styles.wrap}>
      <Text style={styles.brand}>
        {BRAND.name} <Text style={styles.version}>v{BRAND.version}</Text>
      </Text>
      <Text style={styles.text}>{BRAND.tagline}</Text>
      <Text style={styles.text}>{copyrightText()}. Bảo lưu mọi quyền.</Text>
      <Text style={styles.text}>
        Phát triển bởi <Text style={styles.dev}>{BRAND.developer}</Text> ❤️
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: 2, marginTop: space.lg, paddingVertical: space.md },
  brand: { color: colors.primary, fontSize: 15, fontWeight: "800" },
  version: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  text: { color: colors.muted, fontSize: 12, textAlign: "center" },
  dev: { color: colors.text, fontWeight: "700" },
});
