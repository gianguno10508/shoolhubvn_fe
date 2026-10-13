const User = require("../models/User");

/** Chạy sau auth: nạp user (kèm trường + lớp) vào req.currentUser */
async function loadUser(req, res, next) {
  try {
    const user = await User.findById(req.userId).populate("school").populate("classId");
    if (!user) return res.status(401).json({ error: "Không tìm thấy tài khoản." });
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
