// api/assignments.js — Bài tập & Tự chấm
import { apiFetch } from "./client";

/* ----- Người giao bài ----- */

/** scope: "mine" (mặc định) | "all" (tài khoản trường / BGH xem toàn trường) */
export function listAssignments(scope = "mine") {
  return apiFetch(`/assignments${scope === "all" ? "?scope=all" : ""}`);
}

export function getAssignment(id) {
  return apiFetch(`/assignments/${id}`);
}

/** @param {{title,description,sourceFileName,questions,classIds,totalPoints,durationMinutes,openAt,dueAt,maxAttempts,shuffleQuestions,shuffleOptions,showAnswers}} payload */
export function createAssignment(payload) {
  return apiFetch("/assignments", { method: "POST", body: payload });
}

export function updateAssignment(id, payload) {
  return apiFetch(`/assignments/${id}`, { method: "PATCH", body: payload });
}

export function deleteAssignment(id) {
  return apiFetch(`/assignments/${id}`, { method: "DELETE" });
}

export function getAssignmentResults(id) {
  return apiFetch(`/assignments/${id}/submissions`);
}

/* ----- Học sinh ----- */

export function listMyAssignments() {
  return apiFetch("/assignments/my");
}

export function startAssignment(id) {
  return apiFetch(`/assignments/${id}/start`, { method: "POST" });
}

/** answers: [{ questionNumber, answer }] — answer là `key` của phương án */
export function saveAnswers(submissionId, answers) {
  return apiFetch(`/assignments/submissions/${submissionId}/answers`, { method: "PUT", body: { answers } });
}

export function submitAssignment(submissionId, answers) {
  return apiFetch(`/assignments/submissions/${submissionId}/submit`, { method: "POST", body: { answers } });
}

export function getMySubmission(submissionId) {
  return apiFetch(`/assignments/submissions/${submissionId}`);
}
