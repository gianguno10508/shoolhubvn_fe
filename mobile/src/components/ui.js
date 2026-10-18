// components/ui.js — các thành phần giao diện dùng chung
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, radius, space } from "../theme";

/** Khung màn hình cuộn được, kéo xuống để tải lại */
export function Screen({ children, refreshing = false, onRefresh, scroll = true, style }) {
  if (!scroll) return <View style={[styles.screen, styles.pad, style]}>{children}</View>;
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.pad, style]}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}
    >
      {children}
    </ScrollView>
  );
}

export function Card({ children, style, onPress }) {
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed, style]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

export const H1 = ({ children, style }) => <Text style={[styles.h1, style]}>{children}</Text>;
export const H2 = ({ children, style }) => <Text style={[styles.h2, style]}>{children}</Text>;
export const Body = ({ children, style, ...rest }) => (
  <Text style={[styles.body, style]} {...rest}>
    {children}
  </Text>
);
export const Muted = ({ children, style, ...rest }) => (
  <Text style={[styles.muted, style]} {...rest}>
    {children}
  </Text>
);

const BUTTON = {
  primary: { bg: colors.primary, fg: "#fff", border: colors.primary },
  light: { bg: colors.surface, fg: colors.text, border: colors.border },
  danger: { bg: colors.danger, fg: "#fff", border: colors.danger },
  success: { bg: colors.success, fg: "#fff", border: colors.success },
};

export function Button({ title, onPress, variant = "primary", loading = false, disabled = false, small = false, style }) {
  const c = BUTTON[variant];
  const off = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: c.bg, borderColor: c.border, opacity: off ? 0.55 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={c.fg} />
      ) : (
        <Text style={[styles.buttonText, small && styles.buttonTextSmall, { color: c.fg }]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Field({ label, style, multiline, ...props }) {
  return (
    <View style={[styles.field, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.muted}
        style={[styles.input, multiline && styles.inputMulti]}
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
        {...props}
      />
    </View>
  );
}

export function ErrorBox({ message, style }) {
  if (!message) return null;
  return (
    <View style={[styles.error, style]}>
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

export function Notice({ message, style }) {
  if (!message) return null;
  return (
    <View style={[styles.notice, style]}>
      <Text style={styles.noticeText}>✓ {message}</Text>
    </View>
  );
}

export function Empty({ icon = "📭", title, hint }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>{icon}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      {hint ? <Muted style={styles.center}>{hint}</Muted> : null}
    </View>
  );
}

export function Loading({ label = "Đang tải..." }) {
  return (
    <View style={styles.empty}>
      <ActivityIndicator color={colors.primary} />
      <Muted style={{ marginTop: space.sm }}>{label}</Muted>
    </View>
  );
}

/** Nút chuyển chế độ dạng thanh (Tuần / Tháng...) */
export function Segmented({ options, value, onChange, style }) {
  return (
    <View style={[styles.segmented, style]}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable key={String(o.value)} onPress={() => onChange(o.value)} style={[styles.segment, active && styles.segmentActive]}>
            <Text style={[styles.segmentText, active && styles.segmentTextActive]} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chip({ label, selected, onPress, style }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipSelected, style]}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

export function Badge({ label, color = colors.primary, bg = colors.primarySoft, style }) {
  return (
    <View style={[styles.badge, { backgroundColor: bg }, style]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

export function Row({ children, style }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  pad: { padding: space.lg, paddingBottom: space.xl * 2 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    marginBottom: space.md,
  },
  pressed: { opacity: 0.8 },
  h1: { fontSize: 22, fontWeight: "700", color: colors.text, marginBottom: space.sm },
  h2: { fontSize: 17, fontWeight: "700", color: colors.text, marginBottom: space.xs },
  body: { fontSize: 15, color: colors.text, lineHeight: 22 },
  muted: { fontSize: 13, color: colors.text2, lineHeight: 19 },
  center: { textAlign: "center" },
  button: {
    minHeight: 46,
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: space.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonSmall: { minHeight: 36, paddingHorizontal: space.md },
  buttonText: { fontSize: 15, fontWeight: "600" },
  buttonTextSmall: { fontSize: 13 },
  field: { marginBottom: space.md },
  label: { fontSize: 13, fontWeight: "600", color: colors.text2, marginBottom: space.xs },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    backgroundColor: colors.surface,
    fontSize: 15,
    color: colors.text,
  },
  inputMulti: { minHeight: 110, paddingTop: space.md },
  error: {
    backgroundColor: colors.dangerSoft,
    borderColor: "#FECACA",
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: space.md,
    marginBottom: space.md,
  },
  errorText: { color: colors.danger, fontSize: 14 },
  notice: {
    backgroundColor: colors.successSoft,
    borderColor: "#BBF7D0",
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: space.md,
    marginBottom: space.md,
  },
  noticeText: { color: colors.success, fontSize: 14, fontWeight: "600" },
  empty: { alignItems: "center", paddingVertical: space.xl * 2, paddingHorizontal: space.lg },
  emptyIcon: { fontSize: 40, marginBottom: space.sm },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: colors.text, marginBottom: space.xs, textAlign: "center" },
  segmented: {
    flexDirection: "row",
    backgroundColor: "#E9EAF2",
    borderRadius: radius.sm,
    padding: 3,
    marginBottom: space.md,
  },
  segment: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 6 },
  segmentActive: { backgroundColor: colors.surface },
  segmentText: { fontSize: 14, color: colors.text2, fontWeight: "500" },
  segmentTextActive: { color: colors.primary, fontWeight: "700" },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginRight: space.sm,
    marginBottom: space.sm,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 14, color: colors.text },
  chipTextSelected: { color: "#fff", fontWeight: "600" },
  badge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  badgeText: { fontSize: 12, fontWeight: "700" },
  row: { flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
});
