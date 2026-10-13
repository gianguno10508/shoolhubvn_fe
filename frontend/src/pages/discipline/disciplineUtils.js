// pages/discipline/disciplineUtils.js

const pad = (n) => String(n).padStart(2, "0");

/** Ngày hôm nay theo giờ máy, dạng YYYY-MM-DD */
export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(s, n) {
  const [y, m, d] = s.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

export function addMonths(s, n) {
  const [y, m] = s.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  return t.toISOString().slice(0, 10);
}

/** 2026-10-13 -> 13/10/2026 */
export function viDate(s) {
  return s ? s.split("-").reverse().join("/") : "";
}

const WEEKDAY = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
export const WEEKDAY_SHORT = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

export function weekdayName(s) {
  const [y, m, d] = s.split("-").map(Number);
  return WEEKDAY[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

export const INPUT_TYPES = {
  checkbox: { label: "Đánh dấu (checkbox)", hint: "Tick là trừ 1 lần" },
  names: { label: "Ghi tên học sinh", hint: "Mỗi tên trừ 1 lần" },
  count: { label: "Nhập số lần", hint: "Trừ theo số lần" },
};

export function formatPoints(n) {
  if (n == null) return "—";
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}

/** Tách chuỗi tên: "A, B; C" hoặc mỗi dòng 1 tên */
export function splitNames(text) {
  return String(text || "")
    .split(/[,\n;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}
