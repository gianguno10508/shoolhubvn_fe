const express = require("express");
const Notification = require("../models/Notification");
const NotificationReceipt = require("../models/NotificationReceipt");
const User = require("../models/User");
const Class = require("../models/Class");
const auth = require("../middleware/auth");
const loadUser = require("../middleware/loadUser");
const requireSchoolVip = require("../middleware/requireSchoolVip");
const { PERMISSIONS: P, ROLES, ALL_ROLES } = require("../config/roles");

const router = express.Router();

const STUDENT_ROLES = [ROLES.STUDENT, ROLES.RED_FLAG];
const STAFF_ROLES = ALL_ROLES.filter((r) => r !== ROLES.ADMIN && !STUDENT_ROLES.includes(r));

const ROLE_LABEL = {
  school_admin: "Tài khoản trường",
  principal: "Ban giám hiệu",
  homeroom_teacher: "Giáo viên chủ nhiệm",
  teacher: "Giáo viên",
  red_flag: "Cờ đỏ",
  youth_union: "Đoàn thanh niên",
  student: "Học sinh",
};

router.use(auth, loadUser, (req, res, next) => {
  if (!req.currentUser.school) return res.status(400).json({ error: "Tài khoản này không thuộc trường nào." });
  req.school = req.currentUser.school;
  next();
});

// Trường chưa có / hết hạn VIP: khóa toàn bộ chức năng (admin hệ thống luôn qua)
router.use(requireSchoolVip);

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

function fail(res, err, fallback) {
  if (err.status) return res.status(err.status).json({ error: err.message });
  if (err.name === "CastError" || err.name === "BSONError") return res.status(400).json({ error: "Mã không hợp lệ." });
  if (err.name === "ValidationError") return res.status(400).json({ error: err.message });
  console.error(err);
  return res.status(500).json({ error: fallback });
}

const canSendSchool = (u) => u.hasPermission(P.NOTIFY_SCHOOL);
const canSendClass = (u) => u.hasPermission(P.NOTIFY_CLASS) && !!u.classId;
const ownClassId = (u) => (u.classId ? String(u.classId._id || u.classId) : null);

/** Điều kiện lọc các thông báo mà `user` là người nhận */
function inboxFilter(user) {
  const or = [{ "audience.type": "all" }, { "audience.type": "roles", "audience.roles": user.role }];
  if (STAFF_ROLES.includes(user.role)) or.push({ "audience.type": "staff" });
  if (user.classId) or.push({ "audience.type": "classes", "audience.classIds": user.classId._id || user.classId });
  return { school: user.school._id, sender: { $ne: user._id }, $or: or };
}

/** Điều kiện lọc người dùng nhận 1 thông báo (để đếm số người nhận lúc gửi) */
function recipientFilter(schoolId, audience, senderId) {
  const base = { school: schoolId, _id: { $ne: senderId }, status: "active" };
  if (audience.type === "all") return base;
  if (audience.type === "staff") return { ...base, role: { $in: STAFF_ROLES } };
  if (audience.type === "roles") return { ...base, role: { $in: audience.roles } };
  return { ...base, classId: { $in: audience.classIds } };
}

function toJSON(n, read) {
  return {
    id: n._id,
    title: n.title,
    body: n.body,
    priority: n.priority,
    eventAt: n.eventAt || null,
    senderName: n.senderName,
    senderRole: n.senderRole,
    senderRoleLabel: ROLE_LABEL[n.senderRole] || "",
    audienceType: n.audience.type,
    audienceLabel: n.audienceLabel,
    recipientCount: n.recipientCount,
    createdAt: n.createdAt,
    read,
  };
}

/* =========================================
   HỘP THƯ ĐẾN
========================================= */

router.get("/", async (req, res) => {
  try {
    const user = req.currentUser;
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
    const filter = inboxFilter(user);
    if (req.query.before) filter.createdAt = { $lt: new Date(req.query.before) };
    const list = await Notification.find(filter).sort({ createdAt: -1 }).limit(limit);
    const receipts = await NotificationReceipt.find({ user: user._id, notification: { $in: list.map((n) => n._id) } });
    const read = new Set(receipts.map((r) => String(r.notification)));
    res.json(list.map((n) => toJSON(n, read.has(String(n._id)))));
  } catch (err) {
    fail(res, err, "Lỗi máy chủ khi tải thông báo.");
  }
});

router.get("/unread-count", async (req, res) => {
  try {
    const user = req.currentUser;
    const latest = await Notification.find(inboxFilter(user)).sort({ createdAt: -1 }).limit(200).select("_id");
    const ids = latest.map((n) => n._id);
    const readCount = await NotificationReceipt.countDocuments({ user: user._id, notification: { $in: ids } });
    res.json({ count: ids.length - readCount });
  } catch (err) {
    fail(res, err, "Lỗi máy chủ.");
  }
});

router.post("/read-all", async (req, res) => {
  try {
    const user = req.currentUser;
    const ids = await Notification.find(inboxFilter(user)).distinct("_id");
    if (ids.length) {
      await NotificationReceipt.bulkWrite(
        ids.map((id) => ({
          updateOne: { filter: { notification: id, user: user._id }, update: { $setOnInsert: { readAt: new Date() } }, upsert: true },
        })),
      );
    }
    res.json({ ok: true });
  } catch (err) {
    fail(res, err, "Lỗi máy chủ.");
  }
});

router.post("/:id/read", async (req, res) => {
  try {
    const n = await Notification.findOne({ _id: req.params.id, ...inboxFilter(req.currentUser) });
    if (!n) throw httpError(404, "Không tìm thấy thông báo.");
    await NotificationReceipt.updateOne(
      { notification: n._id, user: req.currentUser._id },
      { $setOnInsert: { readAt: new Date() } },
      { upsert: true },
    );
    res.json({ ok: true });
  } catch (err) {
    fail(res, err, "Lỗi máy chủ.");
  }
});

/* =========================================
   GỬI THÔNG BÁO
========================================= */

// Các lựa chọn người nhận mà tài khoản hiện tại được dùng
router.get("/audiences", async (req, res) => {
  try {
    const user = req.currentUser;
    const school = canSendSchool(user);
    const ownClass = canSendClass(user) ? { id: ownClassId(user), name: user.classId.name } : null;
    const classes = school
      ? (await Class.find({ school: req.school._id, deletedAt: null }).sort({ grade: 1, name: 1 })).map((c) => ({
          id: c._id,
          name: c.name,
        }))
      : [];
    res.json({
      canSend: school || !!ownClass,
      types: school ? ["staff", "all", "roles", "classes"] : ownClass ? ["classes"] : [],
      roles: Object.entries(ROLE_LABEL).map(([value, label]) => ({ value, label })),
      classes: school ? classes : ownClass ? [ownClass] : [],
      ownClass,
    });
  } catch (err) {
    fail(res, err, "Lỗi máy chủ.");
  }
});

async function cleanAudience(user, raw, schoolId) {
  const type = raw && raw.type;
  if (!canSendSchool(user)) {
    // GVCN: chỉ gửi cho lớp mình
    if (!canSendClass(user)) throw httpError(403, "Chức danh của bạn không được gửi thông báo.");
    if (type !== "classes") throw httpError(403, "Giáo viên chủ nhiệm chỉ gửi thông báo cho lớp mình.");
    return { audience: { type, classIds: [ownClassId(user)], roles: [] }, label: `Lớp ${user.classId.name}` };
  }
  if (type === "all") return { audience: { type, roles: [], classIds: [] }, label: "Toàn trường" };
  if (type === "staff") return { audience: { type, roles: [], classIds: [] }, label: "Toàn bộ giáo viên & cán bộ" };
  if (type === "roles") {
    const roles = [...new Set((raw.roles || []).filter((r) => ROLE_LABEL[r]))];
    if (!roles.length) throw httpError(400, "Chọn ít nhất 1 chức danh.");
    return { audience: { type, roles, classIds: [] }, label: roles.map((r) => ROLE_LABEL[r]).join(", ") };
  }
  if (type === "classes") {
    const ids = [...new Set((raw.classIds || []).map(String))];
    const classes = await Class.find({ _id: { $in: ids }, school: schoolId, deletedAt: null }).sort({ name: 1 });
    if (!classes.length || classes.length !== ids.length) throw httpError(400, "Chọn lớp hợp lệ.");
    return {
      audience: { type, roles: [], classIds: classes.map((c) => c._id) },
      label: `Lớp ${classes.map((c) => c.name).join(", ")}`,
    };
  }
  throw httpError(400, "Chưa chọn người nhận.");
}

router.post("/", async (req, res) => {
  try {
    const user = req.currentUser;
    const title = String(req.body.title || "").trim();
    if (!title) throw httpError(400, "Vui lòng nhập tiêu đề.");
    let eventAt = null;
    if (req.body.eventAt) {
      eventAt = new Date(req.body.eventAt);
      if (Number.isNaN(eventAt.getTime())) throw httpError(400, "Ngày giờ không hợp lệ.");
    }
    const { audience, label } = await cleanAudience(user, req.body.audience, req.school._id);
    const recipientCount = await User.countDocuments(recipientFilter(req.school._id, audience, user._id));
    if (!recipientCount) throw httpError(400, "Không có ai trong nhóm người nhận đã chọn.");
    const n = await Notification.create({
      school: req.school._id,
      sender: user._id,
      senderName: user.name || user.username,
      senderRole: user.role,
      title,
      body: String(req.body.body || "").trim(),
      priority: req.body.priority === "important" ? "important" : "normal",
      eventAt,
      audience,
      audienceLabel: label,
      recipientCount,
    });
    res.json(toJSON(n, true));
  } catch (err) {
    fail(res, err, "Lỗi máy chủ khi gửi thông báo.");
  }
});

// Thông báo mình đã gửi + số người đã đọc
router.get("/sent", async (req, res) => {
  try {
    const user = req.currentUser;
    const filter = { school: req.school._id };
    if (!(user.hasPermission(P.USERS_MANAGE) && req.query.scope === "all")) filter.sender = user._id;
    const list = await Notification.find(filter).sort({ createdAt: -1 }).limit(100);
    const counts = await NotificationReceipt.aggregate([
      { $match: { notification: { $in: list.map((n) => n._id) } } },
      { $group: { _id: "$notification", n: { $sum: 1 } } },
    ]);
    const by = new Map(counts.map((c) => [String(c._id), c.n]));
    res.json(list.map((n) => ({ ...toJSON(n, true), readCount: by.get(String(n._id)) || 0 })));
  } catch (err) {
    fail(res, err, "Lỗi máy chủ khi tải thông báo đã gửi.");
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const user = req.currentUser;
    const n = await Notification.findOne({ _id: req.params.id, school: req.school._id });
    if (!n) throw httpError(404, "Không tìm thấy thông báo.");
    if (String(n.sender) !== String(user._id) && !user.hasPermission(P.USERS_MANAGE)) {
      throw httpError(403, "Chỉ người gửi mới được thu hồi thông báo.");
    }
    await NotificationReceipt.deleteMany({ notification: n._id });
    await n.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    fail(res, err, "Lỗi máy chủ khi thu hồi thông báo.");
  }
});

module.exports = router;
