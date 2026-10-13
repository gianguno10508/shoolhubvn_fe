const { PERMISSIONS } = require("../config/roles");
const loadUser = require("./loadUser");
const requireSchoolVip = require("./requireSchoolVip");

/** Xếp TKB: cần quyền timetable.manage và trường còn hạn VIP */
function requireTimetableAccess(req, res, next) {
  loadUser(req, res, () => {
    if (!req.currentUser.hasPermission(PERMISSIONS.TIMETABLE_MANAGE)) {
      return res.status(403).json({ error: "Chức danh của bạn không có quyền xếp thời khóa biểu." });
    }
    requireSchoolVip(req, res, next);
  });
}

module.exports = requireTimetableAccess;
