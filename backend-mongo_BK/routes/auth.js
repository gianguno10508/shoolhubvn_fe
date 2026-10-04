// routes/auth.js
const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const auth = require("../middleware/auth");

const router = express.Router();

function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "30d" });
}

/* Đăng ký tài khoản mới
 * body: { username, password, name, className } */
router.post("/register", async (req, res) => {
  try {
    const { username, password, name, className } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Thiếu username hoặc password." });
    }

    const existed = await User.findOne({ username: username.toLowerCase() });
    if (existed) {
      return res.status(409).json({ error: "Username này đã tồn tại." });
    }

    // Không tin role do client gửi lên (ai cũng có thể tự nhận admin).
    // Tài khoản đầu tiên của hệ thống là admin, các tài khoản sau mặc định
    // là "giao_vien" và chưa có VIP; muốn xếp TKB phải được admin cấp VIP.
    const isFirstUser = (await User.countDocuments()) === 0;

    const user = await User.create({
      username,
      password, // tự động được băm bởi hook pre("save") trong models/User.js
      name,
      className,
      role: isFirstUser ? "admin" : "giao_vien",
    });

    res.json({ token: signToken(user._id), user: user.toPublicJSON() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi máy chủ khi đăng ký." });
  }
});

/* Đăng nhập
 * body: { username, password } */
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({
      username: (username || "").toLowerCase(),
    }).select("+password");
    if (!user) {
      return res.status(401).json({ error: "Sai username hoặc password." });
    }

    const ok = await user.comparePassword(password || "");
    if (!ok) {
      return res.status(401).json({ error: "Sai username hoặc password." });
    }

    res.json({ token: signToken(user._id), user: user.toPublicJSON() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi máy chủ khi đăng nhập." });
  }
});

/* Lấy thông tin tài khoản đang đăng nhập (dùng khi mở lại app còn phiên) */
router.get("/me", auth, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user)
    return res.status(404).json({ error: "Không tìm thấy tài khoản." });
  res.json(user.toPublicJSON());
});

module.exports = router;
