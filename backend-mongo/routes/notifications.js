const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const Notification = require("../models/Notification");
const NotificationReceipt = require("../models/NotificationReceipt");
const NotificationAttachment = require("../models/NotificationAttachment");
const User = require("../models/User");
const Class = require("../models/Class");
const auth = require("../middleware/auth");
const loadUser = require("../middleware/loadUser");
const requireSchoolVip = require("../middleware/requireSchoolVip");
const { PERMISSIONS: P, ROLES, ALL_ROLES } = require("../config/roles");
const { pushToUsers, viDateTime } = require("../utils/push");

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

/* ----- Tệp đính kèm ----- */

const MAX_FILES = 5;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_BYTES = 25 * 1024 * 1024;
const FILE_TYPES = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odt: "application/vnd.oasis.opendocument.text",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  rtf: "application/rtf",
  txt: "text/plain",
  csv: "text/csv",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  zip: "application/zip",
  rar: "application/vnd.rar",
};
// Link tải tệp: token ngắn hạn riêng (khác khoá token đăng nhập) để mở bằng trình duyệt / app mà không cần header
const FILE_LINK_TTL = "10m";
const fileSecret = () => `${process.env.JWT_SECRET}:notification-file`;

/** Tên tệp không dấu cho header Content-Disposition (trình duyệt cũ) */
const asciiName = (name) =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^\x20-\x7e]|["\\]/g, "_");

// Tải tệp qua link đã ký — đặt trước middleware đăng nhập
router.get("/files/:token", async (req, res) => {
  try {
    let payload;
    try {
      payload = jwt.verify(req.params.token, fileSecret(), { algorithms: ["HS256"] });
    } catch {
      return res.status(401).json({ error: "Link tải đã hết hạn, vui lòng bấm tải lại." });
    }
    const file = await NotificationAttachment.findOne({ _id: payload.aid, notification: payload.nid });
    if (!file) return res.status(404).json({ error: "Tệp không còn tồn tại (thông báo có thể đã bị thu hồi)." });
    res.set({
      "Content-Type": file.mimeType || "application/octet-stream",
      "Content-Length": file.data.length,
      "Content-Disposition": `attachment; filename="${asciiName(file.name)}"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "Cache-Control": "private, no-store",
    });
    res.end(file.data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi máy chủ khi tải tệp." });
  }
});

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
    attachments: (n.attachments || []).map((a) => ({ id: a._id, name: a.name, mimeType: a.mimeType, size: a.size })),
    createdAt: n.createdAt,
    read,
  };
}

/** Đọc danh sách tệp gửi lên dạng [{ name, data (base64) }] */
function readAttachments(list) {
  if (list === undefined || list === null) return [];
  if (!Array.isArray(list)) throw httpError(400, "Tệp đính kèm không hợp lệ.");
  if (list.length > MAX_FILES) throw httpError(400, `Tối đa ${MAX_FILES} tệp đính kèm.`);
  let total = 0;
  return list.map((f, i) => {
    const name = String(f?.name || "")
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_")
      .trim()
      .slice(0, 180);
    const ext = name.includes(".") ? name.split(".").pop().toLowerCase() : "";
    if (!name || !FILE_TYPES[ext]) {
      throw httpError(400, `Tệp ${name || i + 1} không được hỗ trợ (chỉ nhận PDF, Word, Excel, PowerPoint, ảnh, TXT, ZIP...).`);
    }
    const base64 = typeof f?.data === "string" ? f.data.replace(/^data:[^;]*;base64,/, "") : "";
    if (!base64 || !/^[A-Za-z0-9+/=]+$/.test(base64)) throw httpError(400, `Tệp ${name} bị lỗi dữ liệu.`);
    const data = Buffer.from(base64, "base64");
    if (!data.length) throw httpError(400, `Tệp ${name} rỗng.`);
    if (data.length > MAX_FILE_BYTES) throw httpError(400, `Tệp ${name} quá lớn (tối đa 10MB mỗi tệp).`);
    total += data.length;
    if (total > MAX_TOTAL_BYTES) throw httpError(400, "Tổng dung lượng tệp đính kèm tối đa 25MB.");
    return { _id: new mongoose.Types.ObjectId(), name, mimeType: FILE_TYPES[ext], size: data.length, data };
  });
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
    const files = readAttachments(req.body.attachments);
    const { audience, label } = await cleanAudience(user, req.body.audience, req.school._id);
    const recipientCount = await User.countDocuments(recipientFilter(req.school._id, audience, user._id));
    if (!recipientCount) throw httpError(400, "Không có ai trong nhóm người nhận đã chọn.");
    const n = new Notification({
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
      attachments: files.map(({ _id, name, mimeType, size }) => ({ _id, name, mimeType, size })),
    });
    // Lưu tệp trước, thông báo sau: người nhận chỉ thấy thông báo khi tệp đã sẵn sàng
    if (files.length) {
      await NotificationAttachment.insertMany(files.map((f) => ({ ...f, school: req.school._id, notification: n._id })));
    }
    try {
      await n.save();
    } catch (err) {
      await NotificationAttachment.deleteMany({ notification: n._id });
      throw err;
    }
    res.json(toJSON(n, true));

    // Đẩy ngay về điện thoại của người nhận, kèm ngày giờ đã đặt (không chờ, lỗi không ảnh hưởng việc gửi)
    const lines = [
      eventAt ? `🕒 ${viDateTime(eventAt)}` : "",
      n.body,
      files.length ? `📎 ${files.length} tệp đính kèm` : "",
    ].filter(Boolean);
    pushToUsers(recipientFilter(req.school._id, audience, user._id), {
      title: `${n.priority === "important" ? "❗ " : "📢 "}${n.title}`,
      body: lines.join("\n").slice(0, 500) || `Thông báo từ ${n.senderName}`,
      data: { type: "notification", id: String(n._id) },
    });
  } catch (err) {
    fail(res, err, "Lỗi máy chủ khi gửi thông báo.");
  }
});

// Lấy link tải 1 tệp đính kèm (người nhận, người gửi hoặc quản lý tài khoản trường)
router.get("/:id/attachments/:fileId/link", async (req, res) => {
  try {
    const user = req.currentUser;
    const n = await Notification.findOne({ _id: req.params.id, school: req.school._id });
    if (!n) throw httpError(404, "Không tìm thấy thông báo.");
    const file = n.attachments.find((a) => String(a._id) === String(req.params.fileId));
    if (!file) throw httpError(404, "Không tìm thấy tệp đính kèm.");
    const allowed =
      String(n.sender) === String(user._id) ||
      user.hasPermission(P.USERS_MANAGE) ||
      (await Notification.exists({ _id: n._id, ...inboxFilter(user) }));
    if (!allowed) throw httpError(403, "Bạn không phải người nhận thông báo này.");
    const token = jwt.sign({ aid: String(file._id), nid: String(n._id) }, fileSecret(), {
      algorithm: "HS256",
      expiresIn: FILE_LINK_TTL,
    });
    // Đường dẫn tính từ gốc API (VD: http://host/api) — web / app tự ghép
    res.json({ path: `/notifications/files/${token}`, name: file.name });
  } catch (err) {
    fail(res, err, "Lỗi máy chủ khi lấy link tải tệp.");
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
    await NotificationAttachment.deleteMany({ notification: n._id });
    await n.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    fail(res, err, "Lỗi máy chủ khi thu hồi thông báo.");
  }
});

module.exports = router;
