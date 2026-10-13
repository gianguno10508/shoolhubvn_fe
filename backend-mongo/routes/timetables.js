const express = require("express");
const Timetable = require("../models/Timetable");
const auth = require("../middleware/auth");
const requireTimetableAccess = require("../middleware/requireTimetableAccess");

const router = express.Router();

router.use(auth, requireTimetableAccess);

const ACTIVE = { deletedAt: null };
const TRASHED = { deletedAt: { $ne: null } };

/** Tài khoản thuộc trường: thấy TKB của cả trường; admin hệ thống: chỉ TKB của mình */
function scope(req) {
  const user = req.currentUser;
  return user.school ? { school: user.school._id } : { owner: user._id };
}

function newDocFields(req) {
  const user = req.currentUser;
  return { owner: user._id, school: user.school ? user.school._id : null };
}

function fail(res, err, fallback) {
  if (err && (err.name === "CastError" || err.name === "BSONError")) {
    return res.status(400).json({ error: "Mã thời khóa biểu không hợp lệ." });
  }
  console.error(err);
  return res.status(500).json({ error: fallback });
}

router.get("/", async (req, res) => {
  try {
    const trash = req.query.trash === "1";
    const list = await Timetable.find({ ...scope(req), ...(trash ? TRASHED : ACTIVE) })
      .select("name createdAt updatedAt deletedAt")
      .sort(trash ? { deletedAt: -1 } : { createdAt: -1 });
    res.json(list);
  } catch (err) {
    fail(res, err, "Lỗi máy chủ khi lấy danh sách.");
  }
});

router.get("/:id", async (req, res) => {
  try {
    const doc = await Timetable.findOne({ _id: req.params.id, ...scope(req), ...ACTIVE });
    if (!doc) return res.status(404).json({ error: "Không tìm thấy thời khóa biểu." });
    res.json(doc);
  } catch (err) {
    fail(res, err, "Lỗi máy chủ khi tải thời khóa biểu.");
  }
});

router.post("/", async (req, res) => {
  try {
    const { name, data } = req.body;
    if (!name || !data) {
      return res.status(400).json({ error: "Thiếu tên hoặc dữ liệu thời khóa biểu." });
    }
    const doc = await Timetable.create({ ...newDocFields(req), name, data });
    res.json({ _id: doc._id, name: doc.name, createdAt: doc.createdAt });
  } catch (err) {
    fail(res, err, "Lỗi máy chủ khi tạo thời khóa biểu.");
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { name, data } = req.body;
    const doc = await Timetable.findOneAndUpdate(
      { _id: req.params.id, ...scope(req), ...ACTIVE },
      { ...(name ? { name } : {}), ...(data ? { data } : {}) },
      { new: true },
    ).select("name updatedAt");
    if (!doc) return res.status(404).json({ error: "Không tìm thấy thời khóa biểu." });
    res.json(doc);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "Bạn đã có 1 thời khóa biểu trùng tên này rồi." });
    }
    console.error(err);
    res.status(500).json({ error: "Lỗi máy chủ khi lưu thời khóa biểu." });
  }
});

router.post("/:id/duplicate", async (req, res) => {
  try {
    const src = await Timetable.findOne({ _id: req.params.id, ...scope(req), ...ACTIVE });
    if (!src) return res.status(404).json({ error: "Không tìm thấy thời khóa biểu." });

    const name = `${src.name} (bản sao)`;
    const data = JSON.parse(JSON.stringify(src.data || {}));
    if (data.config) data.config.tenTKB = name;

    const copy = await Timetable.create({ ...newDocFields(req), name, data });
    res.json({ _id: copy._id, name: copy.name, createdAt: copy.createdAt });
  } catch (err) {
    fail(res, err, "Lỗi máy chủ khi nhân bản.");
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const doc = await Timetable.findOneAndUpdate(
      { _id: req.params.id, ...scope(req), ...ACTIVE },
      { deletedAt: new Date() },
    );
    if (!doc) return res.status(404).json({ error: "Không tìm thấy thời khóa biểu." });
    res.json({ ok: true });
  } catch (err) {
    fail(res, err, "Lỗi máy chủ khi xóa.");
  }
});

router.post("/:id/restore", async (req, res) => {
  try {
    const doc = await Timetable.findOneAndUpdate(
      { _id: req.params.id, ...scope(req), ...TRASHED },
      { deletedAt: null },
    );
    if (!doc) return res.status(404).json({ error: "Không tìm thấy trong thùng rác." });
    res.json({ ok: true });
  } catch (err) {
    fail(res, err, "Lỗi máy chủ khi khôi phục.");
  }
});

router.delete("/:id/permanent", async (req, res) => {
  try {
    const result = await Timetable.deleteOne({ _id: req.params.id, ...scope(req), ...TRASHED });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Không tìm thấy trong thùng rác." });
    }
    res.json({ ok: true });
  } catch (err) {
    fail(res, err, "Lỗi máy chủ khi xóa vĩnh viễn.");
  }
});

module.exports = router;
