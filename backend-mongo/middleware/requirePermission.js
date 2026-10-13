/** Chạy sau loadUser: chặn nếu chức danh hiện tại không có 1 trong các quyền yêu cầu */
function requirePermission(...permissions) {
  return (req, res, next) => {
    const user = req.currentUser;
    if (!user || !permissions.some((p) => user.hasPermission(p))) {
      return res.status(403).json({ error: "Chức danh của bạn không có quyền thực hiện thao tác này." });
    }
    next();
  };
}

module.exports = requirePermission;
