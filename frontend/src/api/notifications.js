// api/notifications.js — thông báo nội bộ trường
import { apiFetch } from "./client";

export function listNotifications({ limit = 30, before } = {}) {
  const q = new URLSearchParams({ limit, ...(before ? { before } : {}) }).toString();
  return apiFetch(`/notifications?${q}`);
}

export function getUnreadCount() {
  return apiFetch("/notifications/unread-count");
}

export function markNotificationRead(id) {
  return apiFetch(`/notifications/${id}/read`, { method: "POST" });
}

export function markAllNotificationsRead() {
  return apiFetch("/notifications/read-all", { method: "POST" });
}

/** Các nhóm người nhận được phép chọn: { canSend, types, roles, classes, ownClass } */
export function getNotificationAudiences() {
  return apiFetch("/notifications/audiences");
}

/** audience: { type: "staff" | "all" | "roles" | "classes", roles?, classIds? } */
export function sendNotification({ title, body, priority, audience }) {
  return apiFetch("/notifications", { method: "POST", body: { title, body, priority, audience } });
}

export function listSentNotifications(scope) {
  return apiFetch(`/notifications/sent${scope === "all" ? "?scope=all" : ""}`);
}

export function deleteNotification(id) {
  return apiFetch(`/notifications/${id}`, { method: "DELETE" });
}

/* Báo cho chuông / menu cập nhật lại số chưa đọc */
export const NOTIFICATIONS_CHANGED = "notifications:changed";
export function emitNotificationsChanged() {
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));
}
