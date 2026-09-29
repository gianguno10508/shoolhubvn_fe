// api/admin.js
import { apiFetch } from "./client";

export function listUsers() {
  return apiFetch("/admin/users");
}

/** years: 1 | 2 | 3 */
export function grantVip(userId, years) {
  return apiFetch(`/admin/users/${userId}/vip`, {
    method: "POST",
    body: { years },
  });
}

export function revokeVip(userId) {
  return apiFetch(`/admin/users/${userId}/vip/revoke`, { method: "POST" });
}

/** role: "admin" | "giao_vien" | "to_truong" */
export function setUserRole(userId, role) {
  return apiFetch(`/admin/users/${userId}/role`, {
    method: "PATCH",
    body: { role },
  });
}
