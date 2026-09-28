const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

/**
 * Gọi API dùng chung cho toàn bộ app.
 * - Tự gắn header Authorization nếu có token trong localStorage.
 * - Tự parse JSON, tự ném lỗi có message rõ ràng nếu response không ok.
 */
export async function apiFetch(path, { method = "GET", body, token } = {}) {
  const authToken = token || localStorage.getItem("tkb_token");

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    // response không có body JSON (ví dụ 204) — bỏ qua
  }

  if (!res.ok) {
    const message = data?.error || `Lỗi máy chủ (${res.status})`;
    throw new Error(message);
  }

  return data;
}
