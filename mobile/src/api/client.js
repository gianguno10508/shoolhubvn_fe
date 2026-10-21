// api/client.js — gọi API backend dùng chung với bản web
import * as SecureStore from "expo-secure-store";

// Địa chỉ backend: đặt EXPO_PUBLIC_API_URL trong file .env (xem .env.example).
// Mặc định là 1 IP LAN mẫu — điện thoại không gọi được "localhost" của máy tính.
export const BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://192.168.1.10:3001/api";

const TOKEN_KEY = "tkb_token";
let token = null;
let onUnauthorized = null;

export async function loadToken() {
  token = await SecureStore.getItemAsync(TOKEN_KEY);
  return token;
}

export async function saveToken(value) {
  token = value;
  if (value) await SecureStore.setItemAsync(TOKEN_KEY, value);
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

/** AuthContext đăng ký hàm đăng xuất khi token hết hạn (401) */
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

/**
 * Gọi API: tự gắn token, parse JSON, ném Error có message tiếng Việt khi lỗi.
 * err.status = mã HTTP, err.code = mã lỗi backend (VD: VIP_REQUIRED).
 */
export async function apiFetch(path, { method = "GET", body } = {}) {
  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw Object.assign(new Error(`Không kết nối được máy chủ (${BASE_URL}). Kiểm tra mạng hoặc địa chỉ backend.`), {
      status: 0,
    });
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    // không có body JSON — bỏ qua
  }

  if (!res.ok) {
    if (res.status === 401 && token && onUnauthorized) onUnauthorized();
    let message = data?.error || `Lỗi máy chủ (${res.status})`;
    if (res.status === 404 && !data?.error) message = "Máy chủ chưa có chức năng này (404). Hãy cập nhật backend.";
    if (data?.code === "VIP_REQUIRED") message = `🔒 ${message}`;
    throw Object.assign(new Error(message), { status: res.status, code: data?.code });
  }
  return data;
}

const qs = (params) => {
  const parts = Object.entries(params || {})
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  return parts.length ? `?${parts.join("&")}` : "";
};

export const api = {
  /* ---------- Tài khoản ---------- */
  login: (username, password) => apiFetch("/auth/login", { method: "POST", body: { username, password } }),
  me: () => apiFetch("/auth/me"),
  updateMe: (body) => apiFetch("/auth/me", { method: "PATCH", body }),
  changePassword: (currentPassword, newPassword) =>
    apiFetch("/auth/change-password", { method: "POST", body: { currentPassword, newPassword } }),

  /* ---------- Thông báo ---------- */
  notifications: (limit = 50) => apiFetch(`/notifications${qs({ limit })}`),
  unreadCount: () => apiFetch("/notifications/unread-count"),
  markRead: (id) => apiFetch(`/notifications/${id}/read`, { method: "POST" }),
  markAllRead: () => apiFetch("/notifications/read-all", { method: "POST" }),
  audiences: () => apiFetch("/notifications/audiences"),
  sendNotification: (body) => apiFetch("/notifications", { method: "POST", body }),
  sentNotifications: () => apiFetch("/notifications/sent"),

  /* ---------- Thi đua ---------- */
  disciplineConfig: () => apiFetch("/discipline/config"),
  disciplineRecords: (params) => apiFetch(`/discipline/records${qs(params)}`),
  saveDisciplineRecord: (classId, date, body) =>
    apiFetch(`/discipline/records/${classId}/${date}`, { method: "PUT", body }),
  deleteDisciplineRecord: (classId, date) => apiFetch(`/discipline/records/${classId}/${date}`, { method: "DELETE" }),
  disciplineSummary: (period, date) => apiFetch(`/discipline/summary${qs({ period, date })}`),
  disciplineStudents: (params) => apiFetch(`/discipline/students${qs(params)}`),
  myScoring: () => apiFetch("/discipline/my-scoring"),
  classes: () => apiFetch("/school/classes"),

  /* ---------- Thông báo đẩy (điện thoại) ---------- */
  registerPushToken: (token) => apiFetch("/auth/push-token", { method: "POST", body: { token } }),
  removePushToken: (token) => apiFetch("/auth/push-token/remove", { method: "POST", body: { token } }),

  /* ---------- Thời khóa biểu ---------- */
  /** params: { teacherId?, classId? } — classId chỉ dùng cho tài khoản trường, BGH, Đoàn TN */
  myTimetable: (params) => apiFetch(`/my-timetable${qs(params)}`),

  /* ---------- Bài tập (người giao bài) ---------- */
  assignments: () => apiFetch("/assignments"),
  assignmentSubmissions: (id) => apiFetch(`/assignments/${id}/submissions`),

  /* ---------- Bài thi (học sinh, cờ đỏ) ---------- */
  myAssignments: () => apiFetch("/assignments/my"),
  startAssignment: (id) => apiFetch(`/assignments/${id}/start`, { method: "POST" }),
  saveAnswers: (sid, answers) => apiFetch(`/assignments/submissions/${sid}/answers`, { method: "PUT", body: { answers } }),
  submitAssignment: (sid, answers) =>
    apiFetch(`/assignments/submissions/${sid}/submit`, { method: "POST", body: { answers } }),
  submission: (sid) => apiFetch(`/assignments/submissions/${sid}`),
  /** Bài trò chơi: chốt 1 câu → { correct, correctAnswer? }. body: { questionNumber, answer } | { questionNumber, timeout: true } */
  checkAnswer: (sid, body) => apiFetch(`/assignments/submissions/${sid}/check`, { method: "POST", body }),
  /** Ai là triệu phú: type = fifty → { hidden: [key] } | audience → { votes: { key: % } } | phone → { key, confidence } */
  lifeline: (sid, questionNumber, type) =>
    apiFetch(`/assignments/submissions/${sid}/lifeline`, { method: "POST", body: { questionNumber, type } }),
};
