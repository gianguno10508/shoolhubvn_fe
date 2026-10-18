// utils/time.js

/** "Vừa xong", "5 phút trước", "Hôm qua", hoặc ngày */
export function timeAgo(value) {
  const diff = (Date.now() - new Date(value).getTime()) / 1000;
  if (diff < 60) return "Vừa xong";
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  if (diff < 2 * 86400) return "Hôm qua";
  return new Date(value).toLocaleDateString("vi-VN");
}

/** "14:30 · Thứ Hai, 20/10/2026" — thời gian của sự việc trong thông báo */
export function formatEventTime(value) {
  const d = new Date(value);
  const time = d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  const date = d.toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
  return `${time} · ${date.charAt(0).toUpperCase()}${date.slice(1)}`;
}

export function formatDateTimeVi(value) {
  return new Date(value).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
