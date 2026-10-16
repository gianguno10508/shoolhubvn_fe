import { apiFetch } from "./client";

/** @param {{username:string,password:string,name?:string,schoolName:string}} payload */
export function register(payload) {
  return apiFetch("/auth/register", { method: "POST", body: payload });
}

export function login({ username, password }) {
  return apiFetch("/auth/login", { method: "POST", body: { username, password } });
}

export function me(token) {
  return apiFetch("/auth/me", { token });
}

/** Tự sửa thông tin cá nhân: { name, email, phone, birthDate } */
export function updateProfile(payload) {
  return apiFetch("/auth/me", { method: "PATCH", body: payload });
}

export function changePassword({ currentPassword, newPassword }) {
  return apiFetch("/auth/change-password", { method: "POST", body: { currentPassword, newPassword } });
}
