// pages/assignments/assignmentUtils.js — định dạng dùng chung cho mục Bài tập

export function formatDateTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Giá trị cho <input type="datetime-local"> theo giờ máy */
export function toLocalInput(date) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatDuration(seconds) {
  if (seconds == null) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m ? `${m} phút ${s ? `${s} giây` : ""}`.trim() : `${s} giây`;
}

/** mm:ss hoặc hh:mm:ss cho đồng hồ đếm ngược */
export function formatClock(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** "còn 2 ngày", "còn 3 giờ", "quá hạn" */
export function timeLeft(dueAt) {
  const ms = new Date(dueAt).getTime() - Date.now();
  if (ms <= 0) return "Đã hết hạn";
  const hours = ms / 3600e3;
  if (hours >= 24) return `Còn ${Math.floor(hours / 24)} ngày`;
  if (hours >= 1) return `Còn ${Math.floor(hours)} giờ`;
  return `Còn ${Math.max(1, Math.floor(ms / 60e3))} phút`;
}

/** Trạng thái hiển thị của 1 bài tập */
export function assignmentState(a) {
  const now = Date.now();
  if (a.status === "closed") return { key: "closed", label: "Đã đóng" };
  if (new Date(a.openAt).getTime() > now) return { key: "upcoming", label: "Sắp mở" };
  if (new Date(a.dueAt).getTime() <= now) return { key: "expired", label: "Hết hạn" };
  return { key: "open", label: "Đang mở" };
}

export function formatScore(score, total) {
  if (score == null) return "—";
  const s = Number.isInteger(score) ? score : score.toFixed(2).replace(/\.?0+$/, "");
  return total ? `${s}/${total}` : String(s);
}
