// utils/timetableWeek.js — khoảng ngày áp dụng của 1 TKB (ngày bắt đầu / kết thúc tuần cài ở web, lưu trong data.config)

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** "YYYY-MM-DD" → Date 0h UTC; sai định dạng → null */
const toDate = (s) => (DATE_RE.test(String(s || "")) ? new Date(`${s}T00:00:00Z`) : null);

/** Khoảng ngày từ cấu hình TKB; ném lỗi 400 nếu ngày kết thúc trước ngày bắt đầu */
function weekOf(data) {
  const c = (data && data.config) || {};
  const weekStart = toDate(c.tuanBatDau);
  const weekEnd = toDate(c.tuanKetThuc);
  if (weekStart && weekEnd && weekEnd < weekStart) {
    throw Object.assign(new Error("Ngày kết thúc tuần phải sau ngày bắt đầu."), { status: 400 });
  }
  // Chỉ nhập 1 đầu: coi như tuần 7 ngày
  return {
    weekStart: weekStart || (weekEnd ? new Date(weekEnd.getTime() - 6 * DAY_MS) : null),
    weekEnd: weekEnd || (weekStart ? new Date(weekStart.getTime() + 6 * DAY_MS) : null),
  };
}

/** Khoảng ngày của 1 bản TKB: đọc thẳng từ data.config (luôn đúng kể cả bản lưu trước khi có trường weekStart/weekEnd) */
function rangeOf(doc) {
  try {
    const r = weekOf(doc.data);
    return r.weekStart ? r : { weekStart: doc.weekStart || null, weekEnd: doc.weekEnd || null };
  } catch {
    return { weekStart: null, weekEnd: null };
  }
}

/** 2 TKB cùng áp dụng thì có trùng ngày không (2 bản không ghi ngày cũng tính là trùng) */
function overlaps(a, b) {
  if (!a.weekStart || !b.weekStart) return !a.weekStart && !b.weekStart;
  return a.weekStart <= b.weekEnd && b.weekStart <= a.weekEnd;
}

/** Chỉ lấy phần cấu hình chứa ngày (đỡ tải toàn bộ data khi chỉ cần khoảng ngày) */
const WEEK_FIELDS = "weekStart weekEnd data.config.tuanBatDau data.config.tuanKetThuc";

module.exports = { DAY_MS, toDate, weekOf, rangeOf, overlaps, WEEK_FIELDS };
