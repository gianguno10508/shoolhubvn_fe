const loadUser = require("./loadUser");

async function requireAdmin(req, res, next) {
  loadUser(req, res, () => {
    if (!req.currentUser.isAdmin()) {
      return res.status(403).json({ error: "Chỉ quản trị viên mới được thực hiện thao tác này." });
    }
    next();
  });
}

module.exports = requireAdmin;
