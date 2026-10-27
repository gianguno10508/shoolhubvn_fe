// Gọi Google Gemini API (gói miễn phí: lấy key tại https://aistudio.google.com/apikey)
// Biến môi trường: GEMINI_API_KEY (bắt buộc), GEMINI_MODEL (mặc định gemini-flash-latest = bản Flash mới nhất),
//   GEMINI_FALLBACK_MODELS (mặc định gemini-flash-lite-latest; nhiều mô hình cách nhau dấu phẩy, "none" = tắt)
// Gemini hay báo 503 "model is currently experiencing high demand" lúc cao điểm: tự thử lại vài lần
// (chờ tăng dần), vẫn lỗi thì chuyển sang mô hình dự phòng.

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const TIMEOUT_MS = 180 * 1000;
const RETRY_DELAYS_MS = [2000, 5000]; // số lần thử lại mỗi mô hình khi quá tải
const OVERLOAD_STATUS = new Set([500, 502, 503, 504]);

function geminiModel() {
  return process.env.GEMINI_MODEL || "gemini-flash-latest";
}

function modelChain() {
  const raw = process.env.GEMINI_FALLBACK_MODELS ?? "gemini-flash-lite-latest";
  const fallbacks = raw.trim().toLowerCase() === "none" ? [] : raw.split(",").map((m) => m.trim()).filter(Boolean);
  return [...new Set([geminiModel(), ...fallbacks])];
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

/**
 * @param {{ system: string, prompt: string, images?: { mimeType: string, data: string }[], json?: boolean }} input — data là base64;
 *   json = true: yêu cầu AI trả về JSON thuần
 * @returns {Promise<{ text: string, truncated: boolean, model: string }>}
 */
async function generateFromImages({ system, prompt, images = [], json = false }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw httpError(503, "Máy chủ chưa cấu hình GEMINI_API_KEY nên chưa soạn được giáo án.");

  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [
      {
        role: "user",
        parts: [...images.map((img) => ({ inlineData: { mimeType: img.mimeType, data: img.data } })), { text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 32768,
      ...(json ? { responseMimeType: "application/json" } : {}),
    },
  };

  const chain = modelChain();
  let res;
  let data;
  let model;
  outer: for (const [mi, m] of chain.entries()) {
    model = m;
    for (let attempt = 0; ; attempt++) {
      try {
        res = await fetch(`${API_BASE}/${encodeURIComponent(model)}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch (err) {
        if (err.name === "TimeoutError") throw httpError(504, "AI phản hồi quá lâu, vui lòng thử lại với ít ảnh hơn.");
        throw httpError(502, "Không kết nối được tới Gemini API.");
      }
      data = await res.json().catch(() => null);
      if (res.ok) break outer;

      const lastModel = mi === chain.length - 1;
      if (OVERLOAD_STATUS.has(res.status) && attempt < RETRY_DELAYS_MS.length) {
        console.warn(`Gemini ${model} báo ${res.status}, thử lại sau ${RETRY_DELAYS_MS[attempt] / 1000}s`);
        await sleep(RETRY_DELAYS_MS[attempt]);
        continue;
      }
      // Quá tải / hết lượt / không có mô hình → thử mô hình dự phòng (mỗi mô hình có hạn mức riêng)
      if (!lastModel && (OVERLOAD_STATUS.has(res.status) || res.status === 429 || res.status === 404)) {
        console.warn(`Gemini ${model} báo ${res.status}, chuyển sang ${chain[mi + 1]}`);
        continue outer;
      }
      break outer;
    }
  }

  if (!res.ok) {
    const message = data?.error?.message || "";
    console.error("Gemini API lỗi", model, res.status, message);
    if (res.status === 429) {
      throw httpError(429, "Đã hết lượt dùng AI miễn phí trong lúc này. Vui lòng đợi ít phút (hoặc sang ngày mai) rồi thử lại.");
    }
    if (res.status === 400 && /api key/i.test(message)) throw httpError(503, "GEMINI_API_KEY không hợp lệ.");
    if (res.status === 404) throw httpError(503, `Không tìm thấy mô hình "${model}". Kiểm tra GEMINI_MODEL.`);
    if (res.status === 403) {
      const reason = data?.error?.details?.find((d) => d.reason)?.reason;
      if (reason === "CONSUMER_SUSPENDED") {
        throw httpError(503, "Project Google chứa GEMINI_API_KEY đã bị Google tạm khoá. Hãy tạo API key mới ở project khác.");
      }
      throw httpError(503, "API key không có quyền dùng Gemini API (hoặc khu vực không hỗ trợ).");
    }
    if (OVERLOAD_STATUS.has(res.status)) {
      throw httpError(503, "Máy chủ AI của Google đang quá tải (nhiều người dùng cùng lúc). Vui lòng thử lại sau 1–2 phút.");
    }
    throw httpError(502, "Gemini API báo lỗi, vui lòng thử lại sau.");
  }

  const candidate = data?.candidates?.[0];
  const text = (candidate?.content?.parts || [])
    .filter((p) => !p.thought)
    .map((p) => p.text || "")
    .join("")
    .trim();

  if (!text) {
    if (data?.promptFeedback?.blockReason || candidate?.finishReason === "SAFETY") {
      throw httpError(422, "AI từ chối xử lý ảnh này. Hãy thử ảnh khác.");
    }
    throw httpError(502, "AI không trả về nội dung, vui lòng thử lại.");
  }

  return { text, truncated: candidate?.finishReason === "MAX_TOKENS", model };
}

module.exports = { generateFromImages, geminiModel };
