import { apiFetch } from "./client";

/** Danh sách các bản TKB của tài khoản (chỉ gồm _id, name, updatedAt), mới nhất trước */
export function listTimetables() {
  return apiFetch("/timetables");
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

export function deleteTimetable(id) {
  return apiFetch(`/timetables/${id}`, { method: "DELETE" });
}
