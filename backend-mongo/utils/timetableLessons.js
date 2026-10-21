// utils/timetableLessons.js — đọc TKB nhà trường đang áp dụng (dùng chung cho app "TKB của tôi" và nhắc lịch học 20h)
const Timetable = require("../models/Timetable");
const { rangeOf } = require("./timetableWeek");

const DAY_LABELS = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ Nhật"];
const norm = (s) =>
  String(s || "")
    .normalize("NFC")
    .toLocaleLowerCase("vi")
    .replace(/\s+/g, " ")
    .trim();
/** Bỏ dấu (đ → d) để khớp cả khi gõ thiếu dấu */
const plain = (s) =>
  norm(s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");

/** Tìm phần tử khớp tên: khớp đúng (có dấu) trước, rồi khớp không dấu */
function matchByName(list, getNames, wanted) {
  for (const f of [norm, plain]) {
    const w = f(wanted);
    if (!w) return null;
    const hits = list.filter((x) => getNames(x).some((n) => n && f(n) === w));
    if (hits.length) return hits[0]; // trùng tên: lấy người đầu tiên
  }
  return null;
}

const TITLE_RE = /^(thầy|cô|gv|giáo viên|lớp)\s+/i;

/** TKB đang áp dụng cho khoảng [from, to].
 * Trường đã dùng TKB theo tuần (có ngày bắt đầu / kết thúc): chỉ lấy TKB có khoảng ngày trùng tuần này,
 * ngoài các khoảng đó thì không có lịch. TKB không ghi ngày chỉ dùng khi trường chưa có TKB theo tuần nào (bản cũ). */
async function findTimetable(schoolId, from, to) {
  const list = await Timetable.find({ school: schoolId, published: true, deletedAt: null }).sort({ publishedAt: -1 });
  const ranged = list.map((doc) => ({ doc, ...rangeOf(doc) })).filter((t) => t.weekStart);
  if (!ranged.length) return { doc: list[0] || null, range: null, any: list.length > 0 };
  const hit = ranged.filter((t) => t.weekStart <= to && t.weekEnd >= from).sort((a, b) => b.weekStart - a.weekStart)[0];
  return { doc: hit ? hit.doc : null, range: hit ? { weekStart: hit.weekStart, weekEnd: hit.weekEnd } : null, any: true };
}

/** Ô đã xếp thực tế: tiết cố định trong khung CT + các ô xếp (tay / tự động) còn hợp lệ — giống TimetableApp.jsx */
function effectiveSchedule(data) {
  const assignments = data.assignments || [];
  const lessons = new Map();
  const pinned = {};
  for (const a of assignments) {
    const n = Math.max(1, Number(a.soTiet) || 1);
    const fixed = a.fixed || [];
    for (let i = 0; i < n; i++) {
      const id = `${a.id}#${i}`;
      lessons.set(id, a);
      if (i < fixed.length && fixed[i]) pinned[`${fixed[i]}|${a.classId}`] = id;
    }
  }
  const pinnedIds = new Set(Object.values(pinned));
  const out = {};
  for (const [key, id] of Object.entries(data.schedule || {})) {
    if (pinned[key] || pinnedIds.has(id) || !lessons.has(id)) continue;
    out[key] = id;
  }
  Object.assign(out, pinned);
  return { cells: out, lessons };
}

module.exports = { DAY_LABELS, TITLE_RE, norm, plain, matchByName, findTimetable, effectiveSchedule };
