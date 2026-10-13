const express = require("express");
const User = require("../models/User");
const School = require("../models/School");
const Class = require("../models/Class");
const Timetable = require("../models/Timetable");
const Assignment = require("../models/Assignment");
const Submission = require("../models/Submission");
const DisciplineRecord = require("../models/DisciplineRecord");
const Notification = require("../models/Notification");
const NotificationReceipt = require("../models/NotificationReceipt");
const auth = require("../middleware/auth");
const requireAdmin = require("../middleware/requireAdmin");
const { ALL_ROLES, ROLES } = require("../config/roles");

const router = express.Router();

router.use(auth, requireAdmin);

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

async function publicUser(id) {
  const user = await User.findById(id).populate("school").populate("classId");
  return user ? user.toPublicJSON() : null;
}

router.get("/users", async (req, res) => {
  const filter = req.query.schoolId ? { school: req.query.schoolId } : {};
  const users = await User.find(filter).populate("school").populate("classId").sort({ createdAt: -1 });
  res.json(users.map((u) => u.toPublicJSON()));
});

router.get("/schools", async (req, res) => {
  const schools = await School.find().populate("owner", "username name").sort({ createdAt: -1 });
  const counts = await User.aggregate([{ $match: { school: { $ne: null } } }, { $group: { _id: "$school", n: { $sum: 1 } } }]);
  const byId = new Map(counts.map((c) => [String(c._id), c.n]));
  res.json(
    schools.map((s) => ({
      ...s.toPublicJSON(),
      owner: s.owner ? { id: s.owner._id, username: s.owner.username, name: s.owner.name } : null,
      userCount: byId.get(String(s._id)) || 0,
    })),
  );
});

/* VIP gắn với trường: gia hạn cho 1 tài khoản = gia hạn cho trường của tài khoản đó */
async function extendSchoolVip(school, years) {
  const now = Date.now();
  const base = school.vipUntil && school.vipUntil.getTime() > now ? school.vipUntil.getTime() : now;
  school.vipUntil = new Date(base + years * ONE_YEAR_MS);
  await school.save();
}

function parseYears(req, res) {
  const years = Number(req.body.years);
  if (![1, 2, 3].includes(years)) {
    res.status(400).json({ error: "Số năm nâng cấp phải là 1, 2 hoặc 3." });
    return null;
  }
  return years;
}

router.post("/schools/:id/vip", async (req, res) => {
  const years = parseYears(req, res);
  if (!years) return;
  const school = await School.findById(req.params.id);
  if (!school) return res.status(404).json({ error: "Không tìm thấy trường." });
  await extendSchoolVip(school, years);
  res.json(school.toPublicJSON());
});

router.post("/schools/:id/vip/revoke", async (req, res) => {
  const school = await School.findByIdAndUpdate(req.params.id, { vipUntil: null }, { new: true });
  if (!school) return res.status(404).json({ error: "Không tìm thấy trường." });
  res.json(school.toPublicJSON());
});

router.post("/users/:id/vip", async (req, res) => {
  const years = parseYears(req, res);
  if (!years) return;
  const user = await User.findById(req.params.id).populate("school");
  if (!user) return res.status(404).json({ error: "Không tìm thấy tài khoản." });
  if (!user.school) return res.status(400).json({ error: "Tài khoản này không thuộc trường nào." });
  await extendSchoolVip(user.school, years);
  res.json(await publicUser(user._id));
});

router.post("/users/:id/vip/revoke", async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: "Không tìm thấy tài khoản." });
  if (!user.school) return res.status(400).json({ error: "Tài khoản này không thuộc trường nào." });
  await School.updateOne({ _id: user.school }, { vipUntil: null });
  res.json(await publicUser(user._id));
});

router.patch("/users/:id/role", async (req, res) => {
  const { role } = req.body;
  if (!ALL_ROLES.includes(role)) {
    return res.status(400).json({ error: "Quyền không hợp lệ." });
  }
  if (String(req.params.id) === String(req.currentUser._id) && role !== ROLES.ADMIN) {
    return res.status(400).json({ error: "Không thể tự hạ quyền admin của chính mình." });
  }
  const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true });
  if (!user) return res.status(404).json({ error: "Không tìm thấy tài khoản." });
  res.json(await publicUser(user._id));
});

/* =========================================
   XÓA
========================================= */

router.delete("/users/:id", async (req, res) => {
  try {
    if (String(req.params.id) === String(req.currentUser._id)) {
      return res.status(400).json({ error: "Không thể tự xóa tài khoản của chính mình." });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "Không tìm thấy tài khoản." });
    if (user.school && (await School.exists({ _id: user.school, owner: user._id }))) {
      return res.status(409).json({
        error: "Đây là tài khoản chính của trường. Hãy dùng “Xóa trường” để xóa trường cùng toàn bộ tài khoản.",
      });
    }
    // Bài làm / phiếu chấm giữ lại (đã lưu tên học sinh), chỉ xóa trạng thái đọc thông báo
    await NotificationReceipt.deleteMany({ user: user._id });
    await user.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi máy chủ khi xóa tài khoản." });
  }
});

/* Xóa trường: xóa toàn bộ tài khoản + dữ liệu của trường. Cần gửi đúng tên trường để xác nhận. */
router.delete("/schools/:id", async (req, res) => {
  try {
    const school = await School.findById(req.params.id);
    if (!school) return res.status(404).json({ error: "Không tìm thấy trường." });
    if ((req.body.confirmName || "").trim() !== school.name) {
      return res.status(400).json({ error: "Tên trường xác nhận không khớp." });
    }
    const userIds = await User.find({ school: school._id }).distinct("_id");
    const notificationIds = await Notification.find({ school: school._id }).distinct("_id");
    const result = await Promise.all([
      User.deleteMany({ school: school._id }),
      Class.deleteMany({ school: school._id }),
      Timetable.deleteMany({ school: school._id }),
      Assignment.deleteMany({ school: school._id }),
      Submission.deleteMany({ school: school._id }),
      DisciplineRecord.deleteMany({ school: school._id }),
      Notification.deleteMany({ school: school._id }),
      NotificationReceipt.deleteMany({ $or: [{ user: { $in: userIds } }, { notification: { $in: notificationIds } }] }),
    ]);
    await school.deleteOne();
    res.json({ ok: true, deletedUsers: result[0].deletedCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi máy chủ khi xóa trường." });
  }
});

module.exports = router;
