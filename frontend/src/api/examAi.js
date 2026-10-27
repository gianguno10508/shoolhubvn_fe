// api/examAi.js — Tạo đề kiểm tra với AI (ma trận, bản đặc tả, đề + đáp án)
import { apiFetch } from "./client";

/** { used, limit } — số đề đã tạo hôm nay */
export function getExamAiQuota() {
  return apiFetch("/exam-ai/quota");
}

/** Mục lục SGK: { chapters: [{ title, semester, lessons: [string] }], cached } */
export function getCurriculum({ grade, subject, bookSeries, refresh = false }) {
  return apiFetch("/exam-ai/curriculum", { method: "POST", body: { grade, subject, bookSeries, refresh } });
}

export function generateAiExam(config) {
  return apiFetch("/exam-ai/generate", { method: "POST", body: config });
}

export function listAiExams() {
  return apiFetch("/exam-ai");
}

export function getAiExam(id) {
  return apiFetch(`/exam-ai/${id}`);
}

export function deleteAiExam(id) {
  return apiFetch(`/exam-ai/${id}`, { method: "DELETE" });
}
