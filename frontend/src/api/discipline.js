// api/discipline.js — Thi đua & Nề nếp
import { apiFetch } from "./client";

export function getDisciplineConfig() {
  return apiFetch("/discipline/config");
}

/** @param {{basePoints,weekStartDay,scoreDays,categories:[{id?,name,active,items:[{id?,name,kind,points,inputType,active}]}]}} config */
export function saveDisciplineConfig(config) {
  return apiFetch("/discipline/config", { method: "PUT", body: config });
}

/** Phiếu chấm: { date } hoặc { from, to, classId } — ngày dạng YYYY-MM-DD */
export function listDisciplineRecords(params) {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
  return apiFetch(`/discipline/records?${q}`);
}

/** entries: [{ itemId, checked? , quantity?, studentNames? , note? }] */
export function saveDisciplineRecord(classId, date, entries, note) {
  return apiFetch(`/discipline/records/${classId}/${date}`, { method: "PUT", body: { entries, note } });
}

export function deleteDisciplineRecord(classId, date) {
  return apiFetch(`/discipline/records/${classId}/${date}`, { method: "DELETE" });
}

/** period: "week" | "month" */
export function getDisciplineSummary(period, date) {
  return apiFetch(`/discipline/summary?period=${period}&date=${date}`);
}

/** Học sinh bị ghi tên trong sổ thi đua của lớp (GVCN: lớp mình) → { className, start, end, students: [...] } */
export function getDisciplineStudents(period, date, classId) {
  const q = new URLSearchParams({ period, date, ...(classId ? { classId } : {}) }).toString();
  return apiFetch(`/discipline/students?${q}`);
}

/** Phân công chấm chéo → { pairs: [{ scorerClassId, targetClassIds }] } */
export function getScoringPairs() {
  return apiFetch("/discipline/pairs");
}

export function saveScoringPairs(pairs) {
  return apiFetch("/discipline/pairs", { method: "PUT", body: { pairs } });
}
