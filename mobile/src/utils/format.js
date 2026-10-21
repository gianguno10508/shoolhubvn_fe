// utils/format.js — định dạng ngày giờ, nhãn chức danh

export const ROLE_LABEL = {
  admin: "Quản trị hệ thống",
  school_admin: "Tài khoản trường",
  principal: "Ban giám hiệu",
  homeroom_teacher: "Giáo viên chủ nhiệm",
  teacher: "Giáo viên",
  red_flag: "Cờ đỏ",
  youth_union: "Đoàn thanh niên",
  student: "Học sinh",
};

const WEEKDAYS = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
const pad = (n) => String(n).padStart(2, "0");

/** "dd/mm/yyyy" */
export function formatDate(value) {
  if (!value) return "";
  const d = new Date(value);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** "HH:mm dd/mm/yyyy" */
export function formatDateTime(value) {
  if (!value) return "";
  const d = new Date(value);
  return `${pad(d.getHours())}:${pad(d.getMinutes())} ${formatDate(d)}`;
}

/** "14:30 · Thứ Hai, 20/10/2026" — thời gian của sự việc trong thông báo */
export function formatEventTime(value) {
  const d = new Date(value);
  return `${pad(d.getHours())}:${pad(d.getMinutes())} · ${WEEKDAYS[d.getDay()]}, ${formatDate(d)}`;
}

/** Giờ nhận thông báo: "14:30 · Hôm nay", "09:15 · Hôm qua", "08:00 · 18/10/2026" */
export function formatReceived(value) {
  if (!value) return "";
  const d = new Date(value);
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const label = day === today ? "Hôm nay" : day === today - 86400000 ? "Hôm qua" : formatDate(d);
  return `${pad(d.getHours())}:${pad(d.getMinutes())} · ${label}`;
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

/** Ngày theo giờ máy, dạng "YYYY-MM-DD" (backend tính theo giờ Việt Nam) */
export function todayISO(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** "YYYY-MM-DD" ± n ngày */
export function addDaysISO(iso, n) {
  const [y, m, d] = iso.split("-").map(Number);
  return todayISO(new Date(y, m - 1, d + n));
}

/** "YYYY-MM-DD" → "Thứ Hai, 20/10" */
export function weekdayLabel(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${WEEKDAYS[new Date(y, m - 1, d).getDay()]}, ${pad(d)}/${pad(m)}`;
}

/** "YYYY-MM-DD" → "dd/mm" */
export const shortDay = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "");

/** Số giây → "mm:ss" hoặc "h:mm:ss" */
export function formatCountdown(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
}
