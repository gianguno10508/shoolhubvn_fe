const User = require("../models/User");

async function requireAdmin(req, res, next) {
  const user = await User.findById(req.userId);
  if (!user) return res.status(401).json({ error: "Không tìm thấy tài khoản." });
  if (user.role !== "admin") {
    return res.status(403).json({ error: "Chỉ quản trị viên mới được thực hiện thao tác này." });
  }
  req.currentUser = user;
  next();
}

module.exports = requireAdmin;
