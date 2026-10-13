/** Chạy sau loadUser: chỉ cho qua khi user thuộc 1 trường còn hạn VIP (admin hệ thống luôn qua) */
function requireSchoolVip(req, res, next) {
  const user = req.currentUser;
  if (user.isAdmin()) return next();
  if (!user.school) {
    return res.status(403).json({ error: "Tài khoản chưa thuộc trường nào." });
  }
  if (!user.isVipActive()) {
    const expired = !!user.school.vipUntil;
    return res.status(403).json({
      error: expired
        ? "Gói VIP của trường đã hết hạn. Các chức năng tạm khóa cho đến khi gia hạn."
        : "Trường chưa nâng cấp VIP. Các chức năng sẽ mở khi trường được kích hoạt VIP.",
      code: "VIP_REQUIRED",
    });
  }
  next();
}

module.exports = requireSchoolVip;
