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

/** role: xem ROLE_LABEL trong utils/permissions.js */
export function setUserRole(userId, role) {
  return apiFetch(`/admin/users/${userId}/role`, {
    method: "PATCH",
    body: { role },
  });
}

/* ----- Theo trường (VIP tính theo trường) ----- */

export function deleteUser(userId) {
  return apiFetch(`/admin/users/${userId}`, { method: "DELETE" });
}

/** Xóa trường + toàn bộ tài khoản, dữ liệu của trường. confirmName phải đúng tên trường. */
export function deleteSchool(schoolId, confirmName) {
  return apiFetch(`/admin/schools/${schoolId}`, { method: "DELETE", body: { confirmName } });
}

export function listSchools() {
  return apiFetch("/admin/schools");
}

export function grantSchoolVip(schoolId, years) {
  return apiFetch(`/admin/schools/${schoolId}/vip`, { method: "POST", body: { years } });
}

export function revokeSchoolVip(schoolId) {
  return apiFetch(`/admin/schools/${schoolId}/vip/revoke`, { method: "POST" });
}
