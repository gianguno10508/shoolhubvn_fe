// constants/brand.js — tên, bản quyền & nhà phát triển (giữ giống frontend/src/constants/brand.js)
import Constants from "expo-constants";

export const BRAND = {
  name: "SchoolHub",
  tagline: "Nền tảng quản lý trường học số",
  developer: "vxphuongictu",
  since: 2025,
  version: Constants.expoConfig?.version || "1.0.0",
};

export function copyrightText(now = new Date()) {
  const year = now.getFullYear();
  return `© ${year > BRAND.since ? `${BRAND.since}–${year}` : year} ${BRAND.name}`;
}
