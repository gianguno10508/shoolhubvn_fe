/* Các hàm tiện ích dùng chung (không phụ thuộc React) */

let uidCounter = 100;
/* ID phải duy nhất giữa các lần mở app (dữ liệu được lưu lên server), nên
 * ghép thêm mốc thời gian + số ngẫu nhiên thay vì chỉ đếm từ 100. */
export function nextId(prefix) {
  uidCounter += 1;
  const rand = Math.random().toString(36).slice(2, 6);
  return prefix + Date.now().toString(36) + uidCounter.toString(36) + rand;
}

export function abbreviateName(fullName) {
  const parts = String(fullName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  const last = parts[parts.length - 1];
  const initials = parts
    .slice(0, -1)
    .map((p) => p.charAt(0).toLocaleUpperCase("vi-VN"))
    .join(".");
  return initials + "." + last;
}

const ALL_DAY_LABELS = [
  "Thứ 2",
  "Thứ 3",
  "Thứ 4",
  "Thứ 5",
  "Thứ 6",
  "Thứ 7",
  "Chủ Nhật",
];
export function getDays(soNgay) {
  const n = Math.min(Math.max(Number(soNgay) || 1, 1), 7);
  return ALL_DAY_LABELS.slice(0, n);
}
export function getSessions(soBuoi) {
  return Number(soBuoi) === 2 ? ["Sáng", "Chiều"] : ["Cả ngày"];
}
export function getTiets(soTiet) {
  const n = Math.min(Math.max(Number(soTiet) || 1, 1), 10);
  return Array.from({ length: n }, (_, i) => i + 1);
}

/* slot = một ô thời gian trong tuần, chưa gắn với lớp */
export function slotKey(day, session, tiet) {
  return `${day}|${session}|${tiet}`;
}
/* cell = slot + lớp */
export function cellKey(day, session, tiet, classId) {
  return `${day}|${session}|${tiet}|${classId}`;
}
export function parseCell(key) {
  const [day, session, tiet, classId] = key.split("|");
  return { day, session, tiet, classId, slot: slotKey(day, session, tiet) };
}
export function parseSlot(key) {
  const [day, session, tiet] = key.split("|");
  return { day, session, tiet };
}
export function slotLabel(key) {
  const { day, session, tiet } = parseSlot(key);
  return `${day} - ${session} - tiết ${tiet}`;
}

export function allSlots(config) {
  const out = [];
  getDays(config.soNgay).forEach((d) =>
    getSessions(config.soBuoi).forEach((s) =>
      getTiets(config.soTiet).forEach((t) => out.push(slotKey(d, s, t))),
    ),
  );
  return out;
}

export function newAssignment(extra) {
  return {
    id: nextId("a"),
    classId: "",
    gradeId: "",
    subjectId: "",
    teacherId: "",
    soTiet: 1,
    tietLienTiep: 1,
    fixed: [],
    avoid: [],
    ...extra,
  };
}
