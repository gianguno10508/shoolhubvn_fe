// utils/time.js — định dạng ngày giờ dùng chung: luôn dd/mm/yyyy và HH:mm (24 giờ)

const pad = (n) => String(n).padStart(2, "0");
const WEEKDAYS = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];

/** "dd/mm/yyyy" theo giờ máy (utc = true: đọc theo 0h UTC, dùng cho ngày không kèm giờ như ngày sinh) */
export function formatDate(value, { utc = false } = {}) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return utc
    ? `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`
    : `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** "HH:mm" */
export function formatTime(value) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "Vừa xong", "5 phút trước", "Hôm qua", hoặc ngày */
export function timeAgo(value) {
  const diff = (Date.now() - new Date(value).getTime()) / 1000;
  if (diff < 60) return "Vừa xong";
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  if (diff < 2 * 86400) return "Hôm qua";
  return formatDate(value);
}

/** "14:30 · Thứ Hai, 20/10/2026" — thời gian của sự việc trong thông báo */
export function formatEventTime(value) {
  const d = new Date(value);
  return `${formatTime(d)} · ${WEEKDAYS[d.getDay()]}, ${formatDate(d)}`;
}

/** "14:30 dd/mm/yyyy" */
export function formatDateTimeVi(value) {
  if (!value) return "";
  return `${formatTime(value)} ${formatDate(value)}`;
}
