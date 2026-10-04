// routes/admin.js
const express = require("express");
const User = require("../models/User");
const auth = require("../middleware/auth");
const requireAdmin = require("../middleware/requireAdmin");

const router = express.Router();

// Toàn bộ route dưới đây chỉ admin mới gọi được.
router.use(auth, requireAdmin);

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

/* Danh sách toàn bộ tài khoản trong hệ thống */
router.get("/users", async (req, res) => {
  const users = await User.find().sort({ createdAt: -1 });
  res.json(users.map((u) => u.toPublicJSON()));
});

/* Cấp / gia hạn VIP cho 1 tài khoản.
 * body: { years: 1 | 2 | 3 }
 * Nếu tài khoản đang VIP còn hạn thì CỘNG DỒN thêm từ ngày hết hạn hiện tại,
 * nếu hết hạn (hoặc chưa từng VIP) thì tính từ thời điểm hiện tại. */
router.post("/users/:id/vip", async (req, res) => {
  const years = Number(req.body.years);
  if (![1, 2, 3].includes(years)) {
    return res
      .status(400)
      .json({ error: "Số năm nâng cấp phải là 1, 2 hoặc 3." });
  }

  const user = await User.findById(req.params.id);
  if (!user)
    return res.status(404).json({ error: "Không tìm thấy tài khoản." });

  const now = Date.now();
  const base =
    user.vipUntil && user.vipUntil.getTime() > now
      ? user.vipUntil.getTime()
      : now;
  user.vipUntil = new Date(base + years * ONE_YEAR_MS);
  await user.save();

  res.json(user.toPublicJSON());
});

/* Thu hồi VIP ngay lập tức */
router.post("/users/:id/vip/revoke", async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user)
    return res.status(404).json({ error: "Không tìm thấy tài khoản." });

  user.vipUntil = null;
  await user.save();

  res.json(user.toPublicJSON());
});

/* Đổi quyền admin / tài khoản thường.
 * body: { role: "admin" | "giao_vien" | "to_truong" } */
router.patch("/users/:id/role", async (req, res) => {
  const { role } = req.body;
  if (!["admin", "giao_vien", "to_truong"].includes(role)) {
    return res.status(400).json({ error: "Quyền không hợp lệ." });
  }
  if (
    String(req.params.id) === String(req.currentUser._id) &&
    role !== "admin"
  ) {
    return res
      .status(400)
      .json({ error: "Không thể tự hạ quyền admin của chính mình." });
  }

  const user = await User.findByIdAndUpdate(
    req.params.id,
    { role },
    { new: true },
  );
  if (!user)
    return res.status(404).json({ error: "Không tìm thấy tài khoản." });

  res.json(user.toPublicJSON());
});

module.exports = router;
