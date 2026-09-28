import { apiFetch } from "./client";

/** Danh sách TKB (chỉ gồm _id, name, createdAt...). trash=true -> danh sách trong thùng rác */
export function listTimetables(trash = false) {
  return apiFetch(`/timetables${trash ? "?trash=1" : ""}`);
}

/** Lấy đầy đủ 1 bản TKB (gồm cả `data`) */
export function getTimetable(id) {
  return apiFetch(`/timetables/${id}`);
}

/** Tạo mới 1 bản TKB. `data` là toàn bộ state của app. */
export function createTimetable(name, data) {
  return apiFetch("/timetables", { method: "POST", body: { name, data } });
}

/** Ghi đè 1 bản TKB đã có */
export function updateTimetable(id, name, data) {
  return apiFetch(`/timetables/${id}`, { method: "PUT", body: { name, data } });
}

/** Nhân bản: server sao chép toàn bộ cấu hình + dữ liệu sang bản mới */
export function duplicateTimetable(id) {
  return apiFetch(`/timetables/${id}/duplicate`, { method: "POST" });
}

/** Xóa = chuyển vào thùng rác (khôi phục được) */
export function trashTimetable(id) {
  return apiFetch(`/timetables/${id}`, { method: "DELETE" });
}

export function restoreTimetable(id) {
  return apiFetch(`/timetables/${id}/restore`, { method: "POST" });
}

/** Xóa vĩnh viễn (chỉ dùng cho bản đang ở thùng rác) */
export function deleteTimetableForever(id) {
  return apiFetch(`/timetables/${id}/permanent`, { method: "DELETE" });
}
