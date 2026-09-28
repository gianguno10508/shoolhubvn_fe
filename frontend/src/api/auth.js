import { apiFetch } from "./client";

/** @param {{username:string,password:string,name?:string,className?:string,role?:string}} payload */
export function register(payload) {
  return apiFetch("/auth/register", { method: "POST", body: payload });
}

export function login({ username, password }) {
  return apiFetch("/auth/login", { method: "POST", body: { username, password } });
}

export function me(token) {
  return apiFetch("/auth/me", { token });
}
