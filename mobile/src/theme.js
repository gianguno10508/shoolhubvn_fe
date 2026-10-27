// theme.js — màu sắc, khoảng cách, bóng đổ dùng chung cho toàn app (khớp tông màu bản web SchoolHub)
import { Platform } from "react-native";

export const colors = {
  primary: "#4F46E5",
  primaryDark: "#3730A3",
  primaryDeep: "#312E81",
  primarySoft: "#EEF2FF",
  primarySoft2: "#E0E7FF",
  blue: "#2563EB",
  blueSoft: "#EFF6FF",
  purple: "#7C3AED",
  purpleSoft: "#F5F3FF",
  teal: "#0F766E",
  tealSoft: "#F0FDFA",
  bg: "#F4F6FB",
  surface: "#FFFFFF",
  surface2: "#F8FAFC",
  border: "#E2E8F0",
  borderLight: "#EDF1F6",
  text: "#0F172A",
  text2: "#475569",
  muted: "#94A3B8",
  danger: "#DC2626",
  dangerSoft: "#FEF2F2",
  dangerBorder: "#FECACA",
  success: "#16A34A",
  successSoft: "#F0FDF4",
  successBorder: "#BBF7D0",
  warning: "#D97706",
  warningSoft: "#FFFBEB",
  warningBorder: "#FDE68A",
  gold: "#F59E0B",
};

export const radius = { sm: 10, md: 14, lg: 18, xl: 24, pill: 999 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };

export const font = { xs: 12, sm: 13, base: 15, md: 16, lg: 18, xl: 22, xxl: 26 };

/** Bóng đổ nhẹ đồng nhất iOS / Android */
export function shadow(level = 1, color = "#0F172A") {
  const map = {
    1: { opacity: 0.06, radius: 10, y: 3, elevation: 2 },
    2: { opacity: 0.1, radius: 18, y: 8, elevation: 5 },
    3: { opacity: 0.16, radius: 26, y: 12, elevation: 9 },
  };
  const s = map[level] || map[1];
  return Platform.select({
    ios: { shadowColor: color, shadowOpacity: s.opacity, shadowRadius: s.radius, shadowOffset: { width: 0, height: s.y } },
    android: { elevation: s.elevation, shadowColor: color },
    default: { boxShadow: `0px ${s.y}px ${s.radius}px rgba(15,23,42,${s.opacity})` },
  });
}
