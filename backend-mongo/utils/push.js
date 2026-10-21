// utils/push.js — gửi thông báo đẩy về điện thoại (app SchoolHub) qua Expo Push Service.
// App gửi Expo push token lên /api/auth/push-token sau khi đăng nhập; token lưu ở User.pushTokens.
// Mọi hàm ở đây không ném lỗi ra ngoài: gửi thông báo đẩy hỏng không được làm hỏng thao tác chính.
const User = require("../models/User");

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const CHUNK = 100; // Expo nhận tối đa 100 tin / request
const TOKEN_RE = /^Expo(nent)?PushToken\[.+\]$/;

const isPushToken = (t) => TOKEN_RE.test(String(t || ""));

/** "dd/mm/yyyy" theo giờ Việt Nam */
function viDate(value) {
  const d = new Date(new Date(value).getTime() + 7 * 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

/** "14:00 dd/mm/yyyy" theo giờ Việt Nam */
function viDateTime(value) {
  const d = new Date(new Date(value).getTime() + 7 * 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} ${viDate(value)}`;
}

/**
 * Gửi tin cho danh sách tin nhắn đã có token.
 * messages: [{ to, title, body, data }]
 */
async function sendMessages(messages) {
  const dead = new Set();
  for (let i = 0; i < messages.length; i += CHUNK) {
    const chunk = messages.slice(i, i + CHUNK).map((m) => ({ sound: "default", channelId: "default", priority: "high", ...m }));
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(process.env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {}),
        },
        body: JSON.stringify(chunk),
      });
      const json = await res.json().catch(() => null);
      (json?.data || []).forEach((ticket, k) => {
        // Gỡ app / thu hồi quyền: Expo báo DeviceNotRegistered → xóa token đó
        if (ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered") dead.add(chunk[k].to);
      });
      if (!res.ok) console.warn("Expo push lỗi", res.status, json?.errors || "");
    } catch (err) {
      console.warn("Không gửi được thông báo đẩy:", err.message);
    }
  }
  if (dead.size) {
    await User.updateMany({ pushTokens: { $in: [...dead] } }, { $pull: { pushTokens: { $in: [...dead] } } }).catch(() => {});
  }
}

/**
 * Gửi 1 nội dung cho nhiều người.
 * users: mảng tài khoản đã có trường pushTokens (hoặc filter MongoDB để tự tìm)
 */
async function pushToUsers(users, { title, body, data }) {
  try {
    const list = Array.isArray(users) ? users : await User.find({ ...users, "pushTokens.0": { $exists: true } }).select("pushTokens");
    const tokens = [...new Set(list.flatMap((u) => u.pushTokens || []).filter(isPushToken))];
    await sendMessages(tokens.map((to) => ({ to, title, body, data })));
    return tokens.length;
  } catch (err) {
    console.warn("Lỗi gửi thông báo đẩy:", err.message);
    return 0;
  }
}

module.exports = { isPushToken, pushToUsers, sendMessages, viDate, viDateTime };
