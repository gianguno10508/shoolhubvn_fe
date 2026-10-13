const express = require("express");
const mongoose = require("mongoose");
const User = require("../models/User");
const School = require("../models/School");
const Class = require("../models/Class");
const NotificationReceipt = require("../models/NotificationReceipt");
const auth = require("../middleware/auth");
const loadUser = require("../middleware/loadUser");
const requirePermission = require("../middleware/requirePermission");
const requireSchoolVip = require("../middleware/requireSchoolVip");
const { ROLES, PERMISSIONS: P, ROLES_WITH_CLASS, creatableRolesOf } = require("../config/roles");

const router = express.Router();

// Mọi route ở đây đều thao tác trên trường của người đang đăng nhập
router.use(auth, loadUser, (req, res, next) => {
  if (!req.currentUser.school) {
    return res.status(400).json({ error: "Tài khoản này không thuộc trường nào." });
  }
  req.school = req.currentUser.school;
  next();
});

// Trường chưa có / hết hạn VIP: khóa toàn bộ chức năng (admin hệ thống luôn qua)
router.use(requireSchoolVip);

function fail(res, err, fallback) {
  if (err && (err.name === "CastError" || err.name === "BSONError")) {
    return res.status(400).json({ error: "Mã không hợp lệ." });
  }
  if (err && err.name === "ValidationError") {
    return res.status(400).json({ error: err.message });
  }
  if (err && err.code === 11000) {
    return res.status(409).json({ error: "Dữ liệu bị trùng." });
  }
  console.error(err);
  return res.status(500).json({ error: fallback });
}

const isGlobalManager = (user) => user.hasPermission(P.USERS_MANAGE);
const ownClassId = (user) => (user.classId ? String(user.classId._id || user.classId) : null);

/* =========================================
   THÔNG TIN + CẤU HÌNH TRƯỜNG
========================================= */

router.get("/", (req, res) => {
  res.json(req.school.toPublicJSON());
});

const SCHOOL_INFO_FIELDS = ["name", "code", "level", "address", "province", "phone", "email", "academicYear"];

router.patch("/", requirePermission(P.SCHOOL_MANAGE), async (req, res) => {
  try {
    for (const f of SCHOOL_INFO_FIELDS) {
      if (req.body[f] !== undefined) req.school[f] = req.body[f];
    }
    if (req.body.modules) req.school.modules = { ...req.school.modules.toObject(), ...req.body.modules };
    await req.school.save();
    res.json(req.school.toPublicJSON());
  } catch (err) {
    fail(res, err, "Lỗi máy chủ khi cập nhật thông tin trường.");
  }
});

// Cấu hình riêng từng mục: timetable | assignments | exams
// (thi đua có API riêng: /api/discipline/config)
const SETTINGS_PERMISSION = {
  timetable: [P.SCHOOL_MANAGE],
  assignments: [P.SCHOOL_MANAGE],
  exams: [P.SCHOOL_MANAGE],
};

router.put("/settings/:section", async (req, res) => {
  const { section } = req.params;
  const allowed = SETTINGS_PERMISSION[section];
  if (!allowed) return res.status(404).json({ error: "Mục cấu hình không tồn tại." });
  if (!allowed.some((p) => req.currentUser.hasPermission(p))) {
    return res.status(403).json({ error: "Bạn không có quyền sửa cấu hình mục này." });
  }
  try {
    req.school.settings[section] = req.body;
    await req.school.save();
    res.json(req.school.toPublicJSON().settings[section]);
  } catch (err) {
    fail(res, err, "Lỗi máy chủ khi lưu cấu hình.");
  }
});

/* =========================================
   LỚP HỌC
========================================= */

router.get("/classes", async (req, res) => {
  try {
    const classes = await Class.find({ school: req.school._id, deletedAt: null }).sort({ grade: 1, name: 1 });
    const homerooms = await User.find({
      school: req.school._id,
      role: ROLES.HOMEROOM_TEACHER,
      classId: { $in: classes.map((c) => c._id) },
    }).select("name username classId");
    const byClass = new Map(homerooms.map((u) => [String(u.classId), u]));
    res.json(
      classes.map((c) => {
        const t = byClass.get(String(c._id));
        return {
          ...c.toPublicJSON(),
          homeroomTeacher: t ? { id: t._id, name: t.name, username: t.username } : null,
        };
      }),
    );
  } catch (err) {
    fail(res, err, "Lỗi máy chủ khi lấy danh sách lớp.");
  }
});

router.post("/classes", requirePermission(P.CLASSES_MANAGE), requireSchoolVip, async (req, res) => {
  try {
    const { name, grade, academicYear } = req.body;
    if (!(name || "").trim()) return res.status(400).json({ error: "Vui lòng nhập tên lớp." });
    const cls = await Class.create({
      school: req.school._id,
      name: name.trim(),
      grade: (grade || "").trim(),
      academicYear: academicYear || req.school.academicYear,
    });
    res.json({ ...cls.toPublicJSON(), homeroomTeacher: null });
  } catch (err) {
    if (err && err.code === 11000) return res.status(409).json({ error: "Lớp này đã tồn tại trong năm học." });
    fail(res, err, "Lỗi máy chủ khi tạo lớp.");
  }
});

router.patch("/classes/:id", requirePermission(P.CLASSES_MANAGE), requireSchoolVip, async (req, res) => {
  try {
    const update = {};
    for (const f of ["name", "grade", "academicYear"]) {
      if (req.body[f] !== undefined) update[f] = String(req.body[f]).trim();
    }
    const cls = await Class.findOneAndUpdate(
      { _id: req.params.id, school: req.school._id, deletedAt: null },
      update,
      { new: true, runValidators: true },
    );
    if (!cls) return res.status(404).json({ error: "Không tìm thấy lớp." });
    res.json(cls.toPublicJSON());
  } catch (err) {
    fail(res, err, "Lỗi máy chủ khi cập nhật lớp.");
  }
});

router.delete("/classes/:id", requirePermission(P.CLASSES_MANAGE), requireSchoolVip, async (req, res) => {
  try {
    const inUse = await User.countDocuments({ school: req.school._id, classId: req.params.id });
    if (inUse > 0) {
      return res.status(409).json({ error: "Lớp vẫn còn tài khoản (GVCN / học sinh), hãy chuyển hoặc xóa trước." });
    }
    const cls = await Class.findOneAndUpdate(
      { _id: req.params.id, school: req.school._id, deletedAt: null },
      { deletedAt: new Date() },
    );
    if (!cls) return res.status(404).json({ error: "Không tìm thấy lớp." });
    res.json({ ok: true });
  } catch (err) {
    fail(res, err, "Lỗi máy chủ khi xóa lớp.");
  }
});

/* =========================================
   TÀI KHOẢN TRONG TRƯỜNG
========================================= */

/** Điều kiện lọc các tài khoản mà người đang đăng nhập được xem */
function visibleUsersFilter(user) {
  const base = { school: user.school._id };
  if (isGlobalManager(user) || user.hasPermission(P.USERS_VIEW)) return base;
  if (user.hasPermission(P.OWN_CLASS_STUDENTS_MANAGE) && ownClassId(user)) {
    return { ...base, classId: ownClassId(user), role: { $in: [ROLES.STUDENT, ROLES.RED_FLAG] } };
  }
  return null;
}

/** Người đang đăng nhập có được sửa / xóa tài khoản target không */
function canManageTarget(user, target) {
  if (String(target.school) !== String(user.school._id)) return false;
  if (String(target._id) === String(user._id)) return false;
  if (!creatableRolesOf(user.role).includes(target.role)) return false;
  if (!isGlobalManager(user)) {
    return !!ownClassId(user) && String(target.classId) === ownClassId(user);
  }
  return true;
}

/** Kiểm tra role + lớp hợp lệ, trả về { role, classId } hoặc ném lỗi có status */
async function resolveRoleAndClass(user, role, classId, targetId = null) {
  const httpError = (status, message) => Object.assign(new Error(message), { status });

  if (!creatableRolesOf(user.role).includes(role)) {
    throw httpError(403, "Bạn không được tạo / gán chức danh này.");
  }
  // GVCN chỉ tạo được học sinh cho lớp mình
  if (!isGlobalManager(user)) {
    if (!ownClassId(user)) throw httpError(400, "Bạn chưa được gán lớp chủ nhiệm.");
    classId = ownClassId(user);
  }

  if (!ROLES_WITH_CLASS.includes(role)) return { role, classId: null };
  if (!classId) throw httpError(400, "Chức danh này cần chọn lớp.");

  const cls = await Class.findOne({ _id: classId, school: user.school._id, deletedAt: null });
  if (!cls) throw httpError(400, "Lớp không thuộc trường của bạn.");

  if (role === ROLES.HOMEROOM_TEACHER) {
    const other = await User.findOne({
      school: user.school._id,
      role: ROLES.HOMEROOM_TEACHER,
      classId: cls._id,
      ...(targetId ? { _id: { $ne: targetId } } : {}),
    });
    if (other) throw httpError(409, `Lớp ${cls.name} đã có GVCN (${other.name || other.username}).`);
  }
  return { role, classId: cls._id };
}

router.get("/users", async (req, res) => {
  try {
    const filter = visibleUsersFilter(req.currentUser);
    if (!filter) return res.status(403).json({ error: "Bạn không có quyền xem danh sách tài khoản." });
    if (req.query.role) filter.role = req.query.role;
    if (req.query.classId && mongoose.isValidObjectId(req.query.classId) && !filter.classId) {
      filter.classId = req.query.classId;
    }
    const users = await User.find(filter).populate("school").populate("classId").sort({ role: 1, name: 1 });
    res.json(users.map((u) => u.toPublicJSON()));
  } catch (err) {
    fail(res, err, "Lỗi máy chủ khi lấy danh sách tài khoản.");
  }
});

router.post(
  "/users",
  requirePermission(P.USERS_MANAGE, P.OWN_CLASS_STUDENTS_MANAGE),
  requireSchoolVip,
  async (req, res) => {
    try {
      const { username, password, name, email, phone, studentCode } = req.body;
      if (!username || !password) return res.status(400).json({ error: "Thiếu username hoặc password." });
      const existed = await User.findOne({ username: username.toLowerCase() });
      if (existed) return res.status(409).json({ error: "Username này đã tồn tại." });

      const { role, classId } = await resolveRoleAndClass(req.currentUser, req.body.role, req.body.classId);
      const user = await User.create({
        username,
        password,
        name,
        email,
        phone,
        studentCode,
        role,
        classId,
        school: req.school._id,
        createdBy: req.currentUser._id,
      });
      await user.populate(["school", "classId"]);
      res.json(user.toPublicJSON());
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message });
      fail(res, err, "Lỗi máy chủ khi tạo tài khoản.");
    }
  },
);

router.patch(
  "/users/:id",
  requirePermission(P.USERS_MANAGE, P.OWN_CLASS_STUDENTS_MANAGE),
  requireSchoolVip,
  async (req, res) => {
    try {
      const target = await User.findById(req.params.id);
      if (!target || !canManageTarget(req.currentUser, target)) {
        return res.status(404).json({ error: "Không tìm thấy tài khoản trong phạm vi quản lý." });
      }
      for (const f of ["name", "email", "phone", "studentCode"]) {
        if (req.body[f] !== undefined) target[f] = req.body[f];
      }
      if (req.body.status !== undefined) target.status = req.body.status;
      if (req.body.password) target.password = req.body.password;
      if (req.body.role !== undefined || req.body.classId !== undefined) {
        const { role, classId } = await resolveRoleAndClass(
          req.currentUser,
          req.body.role ?? target.role,
          req.body.classId ?? target.classId,
          target._id,
        );
        target.role = role;
        target.classId = classId;
      }
      await target.save();
      await target.populate(["school", "classId"]);
      res.json(target.toPublicJSON());
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message });
      fail(res, err, "Lỗi máy chủ khi cập nhật tài khoản.");
    }
  },
);

router.delete(
  "/users/:id",
  requirePermission(P.USERS_MANAGE, P.OWN_CLASS_STUDENTS_MANAGE),
  requireSchoolVip,
  async (req, res) => {
    try {
      const target = await User.findById(req.params.id);
      if (!target || !canManageTarget(req.currentUser, target)) {
        return res.status(404).json({ error: "Không tìm thấy tài khoản trong phạm vi quản lý." });
      }
      await NotificationReceipt.deleteMany({ user: target._id });
      await target.deleteOne();
      res.json({ ok: true });
    } catch (err) {
      fail(res, err, "Lỗi máy chủ khi xóa tài khoản.");
    }
  },
);

module.exports = router;
