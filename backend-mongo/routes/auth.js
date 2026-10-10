const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const auth = require("../middleware/auth");

const router = express.Router();

function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "30d" });
}

router.post("/register", async (req, res) => {
  try {
    const { username, password, name, school } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Thiếu username hoặc password." });
    }
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Vui lòng nhập họ và tên." });
    }
    if (!school || !school.trim()) {
      return res.status(400).json({ error: "Vui lòng nhập tên trường." });
    }

    const existed = await User.findOne({ username: username.toLowerCase() });
    if (existed)
      return res.status(409).json({ error: "Username này đã tồn tại." });

    const isFirstUser = (await User.countDocuments()) === 0;
    const user = await User.create({
      username,
      password,
      name: name.trim(),
      school: school.trim(),
      role: isFirstUser ? "admin" : "giao_vien",
    });

    res.json({ token: signToken(user._id), user: user.toPublicJSON() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi máy chủ khi đăng ký." });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({
      username: (username || "").toLowerCase(),
    }).select("+password");
    if (!user)
      return res.status(401).json({ error: "Sai username hoặc password." });

    const ok = await user.comparePassword(password || "");
    if (!ok)
      return res.status(401).json({ error: "Sai username hoặc password." });

    res.json({ token: signToken(user._id), user: user.toPublicJSON() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi máy chủ khi đăng nhập." });
  }
});

router.get("/me", auth, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user)
    return res.status(404).json({ error: "Không tìm thấy tài khoản." });
  res.json(user.toPublicJSON());
});

module.exports = router;
