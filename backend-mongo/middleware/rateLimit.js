// middleware/rateLimit.js — chặn dò mật khẩu: đếm số lần thất bại theo khóa (IP + tên đăng nhập), lưu trong bộ nhớ

/**
 * @param {{ max: number, windowMs: number }} opts
 * Trả về { check(key) → số giây phải chờ (0 = được thử), fail(key), reset(key) }
 */
function createLimiter({ max, windowMs }) {
  const hits = new Map(); // key → { count, until }

  // Dọn các khóa đã hết hạn mỗi 10 phút để Map không phình mãi
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.until <= now) hits.delete(k);
  }, 10 * 60 * 1000).unref();

  return {
    check(key) {
      const v = hits.get(key);
      if (!v || v.until <= Date.now()) return 0;
      return v.count >= max ? Math.ceil((v.until - Date.now()) / 1000) : 0;
    },
    fail(key) {
      const now = Date.now();
      const v = hits.get(key);
      if (!v || v.until <= now) hits.set(key, { count: 1, until: now + windowMs });
      else v.count += 1;
    },
    reset(key) {
      hits.delete(key);
    },
  };
}

/** IP thật của request (sau proxy thì cần app.set("trust proxy", ...)) */
const clientIp = (req) => req.ip || (req.socket && req.socket.remoteAddress) || "?";

module.exports = { createLimiter, clientIp };
