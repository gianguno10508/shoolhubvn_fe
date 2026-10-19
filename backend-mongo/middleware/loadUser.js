const User = require("../models/User");

/** Chạy sau auth: nạp user (kèm trường + lớp) vào req.currentUser */
async function loadUser(req, res, next) {
  try {
    const user = await User.findById(req.userId).populate("school").populate("classId");
    if (!user) return res.status(401).json({ error: "Không tìm thấy tài khoản." });
    // Đã đổi / bị đặt lại mật khẩu sau khi token này được cấp → bắt đăng nhập lại (iat làm tròn giây nên trừ hao 1 giây)
    if (user.passwordChangedAt && req.tokenIssuedAt < user.passwordChangedAt.getTime() - 1000) {
      return res.status(401).json({ error: "Mật khẩu đã được thay đổi, vui lòng đăng nhập lại.", code: "PASSWORD_CHANGED" });
    }
    if (user.status === "locked") {
      return res.status(403).json({ error: "Tài khoản đã bị khóa.", code: "ACCOUNT_LOCKED" });
    }
    req.currentUser = user;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = loadUser;
