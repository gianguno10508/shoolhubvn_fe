// utils/periodTimes.js — giờ học của từng tiết (vd sáng tiết 1: 07:15 – 08:00)
/* Lưu trong config TKB: config.periodTimes = { "Sáng": [{ start, end }, ...], "Chiều": [...] } (vị trí = tiết − 1).
 * Backend (routes/myTimetable.js) dùng cùng giờ mặc định để app di động hiển thị khi chưa cài. */

import { getSessions, getTiets } from "./helpers";

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export const toMinutes = (hhmm) => {
  const [h, m] = String(hhmm).split(":").map(Number);
  return h * 60 + m;
};

export const fromMinutes = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** Sinh giờ cho 1 buổi: bắt đầu, số phút / tiết, nghỉ giữa tiết, ra chơi dài sau tiết `bigBreakAfter` */
export function buildSessionTimes({ start, count, length = 45, gap = 5, bigBreakAfter = 2, bigBreak = 15 }) {
  let t = toMinutes(start);
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push({ start: fromMinutes(t), end: fromMinutes(t + length) });
    t += length + (i + 1 === Number(bigBreakAfter) ? bigBreak : gap);
  }
  return out;
}

export const DEFAULT_SESSION_START = { Sáng: "07:15", Chiều: "13:30", "Cả ngày": "07:15" };

/** Giờ học đầy đủ theo số buổi / số tiết hiện tại; chỗ chưa cài (hoặc sai định dạng) lấy giờ mặc định */
export function resolvePeriodTimes(config) {
  const sessions = getSessions(config.soBuoi);
  const count = getTiets(config.soTiet).length;
  const saved = config.periodTimes || {};
  const out = {};
  sessions.forEach((s) => {
    const def = buildSessionTimes({ start: DEFAULT_SESSION_START[s], count });
    out[s] = def.map((d, i) => {
      const x = (saved[s] || [])[i] || {};
      return TIME_RE.test(x.start || "") && TIME_RE.test(x.end || "") ? { start: x.start, end: x.end } : d;
    });
  });
  return out;
}

export const formatRange = (t) => (t ? `${t.start} – ${t.end}` : "");
