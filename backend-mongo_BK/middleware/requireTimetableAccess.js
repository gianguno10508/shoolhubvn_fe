// middleware/requireTimetableAccess.js
const User = require("../models/User");

/**
 * Chỉ admin hoặc tài khoản đang còn hạn VIP mới được thao tác với thời khóa
 * biểu (xem danh sách, tạo mới, sửa, nhân bản, xóa...). Đặt SAU middleware
 * `auth` vì cần req.userId đã được gắn sẵn.
 */
async function requireTimetableAccess(req, res, next) {
  const user = await User.findById(req.userId);
  if (!user) {
    return res.status(401).json({ error: "Không tìm thấy tài khoản." });
  }
  if (!user.canManageTimetables()) {
    return res.status(403).json({
      error:
        "Tài khoản của bạn chưa có quyền xếp thời khóa biểu. Vui lòng liên hệ nâng cấp VIP.",
      code: "VIP_REQUIRED",
    });
  }
  next();
}

module.exports = requireTimetableAccess;
