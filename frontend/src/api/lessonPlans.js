// api/lessonPlans.js — Giáo án AI (soạn từ ảnh sách giáo khoa)
import { apiFetch } from "./client";

export function listLessonPlans() {
  return apiFetch("/lesson-plans");
}

/** { used, limit, maxImages } — số lượt soạn đã dùng hôm nay */
export function getLessonPlanQuota() {
  return apiFetch("/lesson-plans/quota");
}

/** @param {{title,subject,grade,bookSeries,periods,notes,images:[{mimeType,data}]}} payload — data là base64 */
export function generateLessonPlan(payload) {
  return apiFetch("/lesson-plans/generate", { method: "POST", body: payload });
}

export function getLessonPlan(id) {
  return apiFetch(`/lesson-plans/${id}`);
}

export function updateLessonPlan(id, payload) {
  return apiFetch(`/lesson-plans/${id}`, { method: "PATCH", body: payload });
}

export function deleteLessonPlan(id) {
  return apiFetch(`/lesson-plans/${id}`, { method: "DELETE" });
}
