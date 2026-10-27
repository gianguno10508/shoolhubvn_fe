// components/ui.js — các thành phần giao diện dùng chung (thẻ, nút, ô nhập, thông báo, danh sách…)
import { useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, font, radius, shadow, space } from "../theme";

/** Icon dùng chung (Ionicons) */
export function Icon({ name, size = 20, color = colors.text2, style }) {
  return <Ionicons name={name} size={size} color={color} style={style} />;
}

/** Ô vuông bo góc chứa icon, nền nhạt cùng tông */
export function IconBox({ name, color = colors.primary, bg = colors.primarySoft, size = 40, iconSize, style }) {
  return (
    <View style={[{ width: size, height: size, borderRadius: size * 0.32, backgroundColor: bg }, styles.center, style]}>
      <Ionicons name={name} size={iconSize || Math.round(size * 0.5)} color={color} />
    </View>
  );
}

/** Khung màn hình cuộn được, kéo xuống để tải lại */
export function Screen({ children, refreshing = false, onRefresh, scroll = true, style }) {
  if (!scroll) return <View style={[styles.screen, styles.pad, style]}>{children}</View>;
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.pad, style]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        ) : undefined
      }
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

/** Tiêu đề nhóm: chữ in hoa nhỏ + (tuỳ chọn) nội dung bên phải */
export function SectionTitle({ title, right, style }) {
  return (
    <View style={[styles.sectionRow, style]}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {right}
    </View>
  );
}

const BUTTON = {
  primary: { bg: colors.primary, fg: "#fff", border: colors.primary, shadow: true },
  light: { bg: colors.surface, fg: colors.text, border: colors.border },
  soft: { bg: colors.primarySoft, fg: colors.primaryDark, border: colors.primarySoft },
  danger: { bg: colors.danger, fg: "#fff", border: colors.danger, shadow: true },
  dangerSoft: { bg: colors.dangerSoft, fg: colors.danger, border: colors.dangerBorder },
  success: { bg: colors.success, fg: "#fff", border: colors.success, shadow: true },
};

export function Button({ title, onPress, variant = "primary", icon, loading = false, disabled = false, small = false, style }) {
  const c = BUTTON[variant] || BUTTON.primary;
  const off = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: c.bg, borderColor: c.border, opacity: off ? 0.55 : 1 },
        c.shadow && !off && shadow(2, c.bg),
        pressed && { transform: [{ scale: 0.98 }], opacity: 0.9 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={c.fg} />
      ) : (
        <View style={styles.buttonInner}>
          {icon ? <Ionicons name={icon} size={small ? 15 : 18} color={c.fg} /> : null}
          <Text style={[styles.buttonText, small && styles.buttonTextSmall, { color: c.fg }]} numberOfLines={1}>
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

/** Ô nhập: nhãn, icon bên trái, viền sáng khi đang nhập; secureTextEntry có nút ẩn / hiện */
export function Field({ label, icon, style, multiline, secureTextEntry, ...props }) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  return (
    <View style={[styles.field, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.inputWrap, multiline && styles.inputWrapMulti, focused && styles.inputFocused]}>
        {icon ? <Ionicons name={icon} size={18} color={focused ? colors.primary : colors.muted} style={styles.inputIcon} /> : null}
        <TextInput
          placeholderTextColor={colors.muted}
          style={[styles.input, multiline && styles.inputMulti]}
          multiline={multiline}
          textAlignVertical={multiline ? "top" : "center"}
          secureTextEntry={secureTextEntry && hidden}
          {...props}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
        />
        {secureTextEntry ? (
          <Pressable onPress={() => setHidden((h) => !h)} hitSlop={10} style={styles.inputAction}>
            <Ionicons name={hidden ? "eye-outline" : "eye-off-outline"} size={19} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function ErrorBox({ message, style }) {
  if (!message) return null;
  return (
    <View style={[styles.alert, styles.error, style]}>
      <Ionicons name="alert-circle" size={18} color={colors.danger} />
      <Text style={[styles.alertText, { color: colors.danger }]}>{message}</Text>
    </View>
  );
}

export function Notice({ message, style }) {
  if (!message) return null;
  return (
    <View style={[styles.alert, styles.notice, style]}>
      <Ionicons name="checkmark-circle" size={18} color={colors.success} />
      <Text style={[styles.alertText, { color: colors.success, fontWeight: "600" }]}>{message}</Text>
    </View>
  );
}

// Emoji cũ truyền vào <Empty icon> → icon tương ứng
const EMPTY_ICON = {
  "📭": "mail-open-outline",
  "✉️": "paper-plane-outline",
  "📝": "document-text-outline",
  "📚": "library-outline",
  "🏆": "trophy-outline",
  "🗓️": "calendar-outline",
  "🏫": "school-outline",
  "👥": "people-outline",
  "🎉": "happy-outline",
  "🛡️": "shield-checkmark-outline",
};

export function Empty({ icon = "📭", title, hint }) {
  const name = EMPTY_ICON[icon] || (/^[a-z-]+$/.test(icon) ? icon : null);
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        {name ? <Ionicons name={name} size={34} color={colors.primary} /> : <Text style={{ fontSize: 34 }}>{icon}</Text>}
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {hint ? <Muted style={styles.textCenter}>{hint}</Muted> : null}
    </View>
  );
}

export function Loading({ label = "Đang tải..." }) {
  return (
    <View style={styles.empty}>
      <ActivityIndicator color={colors.primary} size="large" />
      <Muted style={{ marginTop: space.md }}>{label}</Muted>
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
          <Pressable
            key={String(o.value)}
            onPress={() => onChange(o.value)}
            style={[styles.segment, active && styles.segmentActive, active && shadow(1)]}
          >
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
    <Pressable onPress={onPress} style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed, style]}>
      {selected ? <Ionicons name="checkmark" size={14} color="#fff" style={{ marginRight: 4 }} /> : null}
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

export function Badge({ label, color = colors.primary, bg = colors.primarySoft, icon, style }) {
  return (
    <View style={[styles.badge, { backgroundColor: bg }, style]}>
      {icon ? <Ionicons name={icon} size={12} color={color} style={{ marginRight: 3 }} /> : null}
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

export function Row({ children, style }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

/** Vòng tròn chữ cái đầu tên */
export function Avatar({ name, size = 44, color = colors.primary, style }) {
  const initials = String(name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }, styles.center, style]}>
      <Text style={{ color: "#fff", fontWeight: "800", fontSize: size * 0.38 }}>{initials}</Text>
    </View>
  );
}

/** Dòng menu / thông tin: icon trái, nhãn, giá trị hoặc mũi tên phải */
export function ListItem({ icon, iconColor = colors.primary, iconBg = colors.primarySoft, title, subtitle, value, onPress, danger, last }) {
  const content = (
    <>
      {icon ? <IconBox name={icon} color={danger ? colors.danger : iconColor} bg={danger ? colors.dangerSoft : iconBg} size={36} /> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.itemTitle, danger && { color: colors.danger }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.itemSub} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text style={styles.itemValue} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {onPress ? <Ionicons name="chevron-forward" size={18} color={colors.muted} /> : null}
    </>
  );
  const style = [styles.item, !last && styles.itemBorder];
  if (!onPress) return <View style={style}>{content}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [style, pressed && { backgroundColor: colors.surface2 }]}>
      {content}
    </Pressable>
  );
}

/** Thanh tiến độ */
export function Progress({ percent, color = colors.primary, style }) {
  return (
    <View style={[styles.bar, style]}>
      <View style={[styles.barFill, { width: `${Math.max(0, Math.min(100, percent))}%`, backgroundColor: color }]} />
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  pad: { padding: space.lg, paddingBottom: space.xl * 2 },
  center: { alignItems: "center", justifyContent: "center" },
  textCenter: { textAlign: "center" },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: space.lg,
    marginBottom: space.md,
    ...shadow(1),
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  h1: { fontSize: font.xl, fontWeight: "800", color: colors.text, marginBottom: space.sm, letterSpacing: -0.3 },
  h2: { fontSize: font.lg, fontWeight: "800", color: colors.text, marginBottom: space.xs },
  body: { fontSize: font.base, color: colors.text, lineHeight: 22 },
  muted: { fontSize: font.sm, color: colors.text2, lineHeight: 19 },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: space.sm, marginBottom: space.sm },
  sectionTitle: { fontSize: font.xs, fontWeight: "800", color: colors.text2, letterSpacing: 0.8, textTransform: "uppercase" },
  button: {
    minHeight: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: space.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonInner: { flexDirection: "row", alignItems: "center", gap: 8 },
  buttonSmall: { minHeight: 38, paddingHorizontal: space.md, borderRadius: radius.sm },
  buttonText: { fontSize: font.base, fontWeight: "700" },
  buttonTextSmall: { fontSize: font.sm },
  field: { marginBottom: space.md },
  label: { fontSize: font.sm, fontWeight: "700", color: colors.text2, marginBottom: 6 },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 50,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface2,
    paddingHorizontal: space.md,
  },
  inputWrapMulti: { alignItems: "flex-start" },
  inputFocused: { borderColor: colors.primary, backgroundColor: colors.surface },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, minHeight: 46, fontSize: font.base, color: colors.text, paddingVertical: 0 },
  inputMulti: { minHeight: 120, paddingTop: space.md, paddingBottom: space.md },
  inputAction: { paddingLeft: 8 },
  alert: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderWidth: 1, borderRadius: radius.md, padding: space.md, marginBottom: space.md },
  alertText: { flex: 1, fontSize: 14, lineHeight: 20 },
  error: { backgroundColor: colors.dangerSoft, borderColor: colors.dangerBorder },
  notice: { backgroundColor: colors.successSoft, borderColor: colors.successBorder },
  empty: { alignItems: "center", paddingVertical: space.xl * 2, paddingHorizontal: space.lg },
  emptyIcon: {
    width: 76,
    height: 76,
    borderRadius: 26,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space.md,
  },
  emptyTitle: { fontSize: font.md, fontWeight: "800", color: colors.text, marginBottom: space.xs, textAlign: "center" },
  segmented: {
    flexDirection: "row",
    backgroundColor: "#E8EBF3",
    borderRadius: radius.md,
    padding: 4,
    marginBottom: space.md,
  },
  segment: { flex: 1, paddingVertical: 9, alignItems: "center", borderRadius: radius.sm },
  segmentActive: { backgroundColor: colors.surface },
  segmentText: { fontSize: 14, color: colors.text2, fontWeight: "600" },
  segmentTextActive: { color: colors.primary, fontWeight: "800" },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginRight: space.sm,
    marginBottom: space.sm,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 14, color: colors.text, fontWeight: "500" },
  chipTextSelected: { color: "#fff", fontWeight: "700" },
  badge: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.pill },
  badgeText: { fontSize: 12, fontWeight: "800" },
  row: { flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
  item: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  itemBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  itemTitle: { fontSize: font.base, fontWeight: "700", color: colors.text },
  itemSub: { fontSize: font.sm, color: colors.text2, marginTop: 1 },
  itemValue: { maxWidth: "50%", fontSize: 14, color: colors.text2, fontWeight: "600", textAlign: "right" },
  bar: { height: 7, backgroundColor: "#E8EBF3", borderRadius: 4, overflow: "hidden", marginVertical: 8 },
  barFill: { height: 7, borderRadius: 4 },
});
