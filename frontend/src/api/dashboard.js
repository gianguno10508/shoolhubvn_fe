// api/dashboard.js — số liệu trang Giáo viên
import { apiFetch } from "./client";

export function getDashboard() {
  return apiFetch("/dashboard");
}
