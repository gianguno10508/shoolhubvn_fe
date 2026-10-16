// api/school.js — các thao tác trên trường của tài khoản đang đăng nhập
import { apiFetch } from "./client";

export function getSchool() {
  return apiFetch("/school");
}

export function updateSchool(payload) {
  return apiFetch("/school", { method: "PATCH", body: payload });
}

/** section: "timetable" | "discipline" | "assignments" | "exams" */
export function updateSchoolSettings(section, settings) {
  return apiFetch(`/school/settings/${section}`, { method: "PUT", body: settings });
}

export function listClasses() {
  return apiFetch("/school/classes");
}

export function createClass(payload) {
  return apiFetch("/school/classes", { method: "POST", body: payload });
}

export function updateClass(id, payload) {
  return apiFetch(`/school/classes/${id}`, { method: "PATCH", body: payload });
}

export function deleteClass(id) {
  return apiFetch(`/school/classes/${id}`, { method: "DELETE" });
}

export function listSchoolUsers() {
  return apiFetch("/school/users");
}

/** Bỏ trống username → tự tạo từ họ tên + ngày sinh; bỏ trống password → Abc@123
 * @param {{username?,password?,name,birthDate?,role?,classId?,email?,phone?,studentCode?}} payload */
export function createSchoolUser(payload) {
  return apiFetch("/school/users", { method: "POST", body: payload });
}

/** Tạo hàng loạt: { role?, classId?, users: [{ name, birthDate, studentCode? }] } → { created, errors } */
export function bulkCreateSchoolUsers(payload) {
  return apiFetch("/school/users/bulk", { method: "POST", body: payload });
}

export function updateSchoolUser(id, payload) {
  return apiFetch(`/school/users/${id}`, { method: "PATCH", body: payload });
}

export function deleteSchoolUser(id) {
  return apiFetch(`/school/users/${id}`, { method: "DELETE" });
}
