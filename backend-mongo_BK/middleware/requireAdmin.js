// middleware/requireAdmin.js
const User = require("../models/User");

/** Chỉ tài khoản role "admin" mới được đi tiếp. Đặt SAU middleware `auth`. */
async function requireAdmin(req, res, next) {
  const user = await User.findById(req.userId);
  if (!user) {
    return res.status(401).json({ error: "Không tìm thấy tài khoản." });
  }
  if (user.role !== "admin") {
    return res
      .status(403)
      .json({ error: "Chỉ quản trị viên mới được thực hiện thao tác này." });
  }
  req.currentUser = user; // để route sau không phải truy vấn lại
  next();
}

module.exports = requireAdmin;
