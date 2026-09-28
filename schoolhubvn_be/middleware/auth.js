const jwt = require("jsonwebtoken");

// Chạy trước mọi route cần đăng nhập. Gắn req.userId = đúng tài khoản đang
// đăng nhập, dùng để lọc dữ liệu (owner: req.userId) ở mọi truy vấn phía sau.
function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Thiếu token, vui lòng đăng nhập lại." });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Token không hợp lệ hoặc đã hết hạn." });
  }
}

module.exports = auth;
