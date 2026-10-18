// components/DateTimeField.js — chọn ngày hoặc giờ phút (Android: hộp thoại, iOS: picker gọn)
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, space } from "../theme";

const pad = (n) => String(n).padStart(2, "0");

/**
 * @param {{ label: string, mode: "date"|"time", value: Date|null, onChange: (d: Date) => void, placeholder?: string }} props
 */
export default function DateTimeField({ label, mode, value, onChange, placeholder }) {
  const text = value
    ? mode === "date"
      ? `${pad(value.getDate())}/${pad(value.getMonth() + 1)}/${value.getFullYear()}`
      : `${pad(value.getHours())}:${pad(value.getMinutes())}`
    : placeholder || (mode === "date" ? "Chọn ngày" : "Chọn giờ");

  if (Platform.OS === "ios") {
    return (
      <View style={styles.wrap}>
        <Text style={styles.label}>{label}</Text>
        <DateTimePicker
          value={value || new Date()}
          mode={mode}
          display="compact"
          locale="vi-VN"
          is24Hour
          onChange={(_, d) => d && onChange(d)}
          style={styles.ios}
        />
      </View>
    );
  }

  function open() {
    DateTimePickerAndroid.open({
      value: value || new Date(),
      mode,
      is24Hour: true,
      onChange: (event, d) => {
        if (event.type === "set" && d) onChange(d);
      },
    });
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Pressable onPress={open} style={styles.box}>
        <Text style={[styles.value, !value && styles.placeholder]}>
          {mode === "date" ? "📅 " : "🕒 "}
          {text}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, marginBottom: space.md },
  label: { fontSize: 13, fontWeight: "600", color: colors.text2, marginBottom: space.xs },
  box: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  value: { fontSize: 15, color: colors.text },
  placeholder: { color: colors.muted },
  ios: { alignSelf: "flex-start" },
});
