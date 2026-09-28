/* =================================================================
 * Tiện ích thời gian: ngày trong tuần, buổi, tiết, và các "khóa" (key)
 * dùng để định danh 1 ô / 1 slot trong thời khóa biểu.
 *
 * Muốn hỗ trợ thêm đơn vị thời gian mới (vd: "tiết trái buổi", tuần
 * chẵn/lẻ...) thì mở rộng ở đây, các component khác không cần đổi vì
 * chúng chỉ gọi qua các hàm bên dưới.
 * ================================================================= */

export const ALL_DAY_LABELS = [
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

/** slot = một ô thời gian trong tuần, chưa gắn với lớp */
export function slotKey(day, session, tiet) {
  return `${day}|${session}|${tiet}`;
}

/** cell = slot + lớp cụ thể */
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

/** Liệt kê toàn bộ slot có thể có trong tuần, theo cấu hình chung */
export function allSlots(config) {
  const out = [];
  getDays(config.soNgay).forEach((d) =>
    getSessions(config.soBuoi).forEach((s) =>
      getTiets(config.soTiet).forEach((t) => out.push(slotKey(d, s, t))),
    ),
  );
  return out;
}
