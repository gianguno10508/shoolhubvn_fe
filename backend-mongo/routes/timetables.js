const express = require("express");
const Timetable = require("../models/Timetable");
const auth = require("../middleware/auth");

const router = express.Router();

// Mọi route đều đi qua `auth` và MỌI truy vấn đều lọc theo `owner: req.userId`
// -> tài khoản này không đọc/sửa/xóa được thời khóa biểu của tài khoản khác.

const ACTIVE = { deletedAt: null }; // chưa vào thùng rác
const TRASHED = { deletedAt: { $ne: null } }; // đang trong thùng rác

function fail(res, err, fallback) {
  if (err && (err.name === "CastError" || err.name === "BSONError")) {
    return res.status(400).json({ error: "Mã thời khóa biểu không hợp lệ." });
  }
  console.error(err);
  return res.status(500).json({ error: fallback });
}

/* Danh sách TKB (không kèm "data" cho nhẹ). ?trash=1 -> danh sách trong thùng rác */
router.get("/", auth, async (req, res) => {
  try {
    const trash = req.query.trash === "1";
    const list = await Timetable.find({ owner: req.userId, ...(trash ? TRASHED : ACTIVE) })
      .select("name createdAt updatedAt deletedAt")
      .sort(trash ? { deletedAt: -1 } : { createdAt: -1 });
    res.json(list);
  } catch (err) {
    fail(res, err, "Lỗi máy chủ khi lấy danh sách.");
  }
});

/* Lấy đầy đủ 1 bản TKB (chỉ bản chưa vào thùng rác) */
router.get("/:id", auth, async (req, res) => {
  try {
    const doc = await Timetable.findOne({ _id: req.params.id, owner: req.userId, ...ACTIVE });
    if (!doc) return res.status(404).json({ error: "Không tìm thấy thời khóa biểu." });
    res.json(doc);
  } catch (err) {
    fail(res, err, "Lỗi máy chủ khi tải thời khóa biểu.");
  }
});

/* Tạo mới. body: { name, data }. _id do MongoDB tự sinh, duy nhất. */
router.post("/", auth, async (req, res) => {
  try {
    const { name, data } = req.body;
    if (!name || !data) {
      return res.status(400).json({ error: "Thiếu tên hoặc dữ liệu thời khóa biểu." });
    }
    const doc = await Timetable.create({ owner: req.userId, name, data });
    res.json({ _id: doc._id, name: doc.name, createdAt: doc.createdAt });
  } catch (err) {
    fail(res, err, "Lỗi máy chủ khi tạo thời khóa biểu.");
  }
});

/* Cập nhật (ghi đè) 1 bản TKB. body: { name?, data? } */
router.put("/:id", auth, async (req, res) => {
  try {
    const { name, data } = req.body;
    const doc = await Timetable.findOneAndUpdate(
      { _id: req.params.id, owner: req.userId, ...ACTIVE },
      { ...(name ? { name } : {}), ...(data ? { data } : {}) },
      { new: true },
    ).select("name updatedAt");
    if (!doc) return res.status(404).json({ error: "Không tìm thấy thời khóa biểu." });
    res.json(doc);
  } catch (err) {
    fail(res, err, "Lỗi máy chủ khi lưu thời khóa biểu.");
  }
});

/* Nhân bản: sao chép toàn bộ cấu hình + dữ liệu sang 1 bản mới có _id riêng */
router.post("/:id/duplicate", auth, async (req, res) => {
  try {
    const src = await Timetable.findOne({ _id: req.params.id, owner: req.userId, ...ACTIVE });
    if (!src) return res.status(404).json({ error: "Không tìm thấy thời khóa biểu." });

    const name = `${src.name} (bản sao)`;
    const data = JSON.parse(JSON.stringify(src.data || {})); // sao chép sâu, không dùng chung tham chiếu
    if (data.config) data.config.tenTKB = name; // để tên trong cấu hình khớp với tên bản mới

    const copy = await Timetable.create({ owner: req.userId, name, data });
    res.json({ _id: copy._id, name: copy.name, createdAt: copy.createdAt });
  } catch (err) {
    fail(res, err, "Lỗi máy chủ khi nhân bản.");
  }
});

/* Xóa = chuyển vào thùng rác (xóa mềm, vẫn khôi phục được) */
router.delete("/:id", auth, async (req, res) => {
  try {
    const doc = await Timetable.findOneAndUpdate(
      { _id: req.params.id, owner: req.userId, ...ACTIVE },
      { deletedAt: new Date() },
    );
    if (!doc) return res.status(404).json({ error: "Không tìm thấy thời khóa biểu." });
    res.json({ ok: true });
  } catch (err) {
    fail(res, err, "Lỗi máy chủ khi xóa.");
  }
});

/* Khôi phục từ thùng rác */
router.post("/:id/restore", auth, async (req, res) => {
  try {
    const doc = await Timetable.findOneAndUpdate(
      { _id: req.params.id, owner: req.userId, ...TRASHED },
      { deletedAt: null },
    );
    if (!doc) return res.status(404).json({ error: "Không tìm thấy trong thùng rác." });
    res.json({ ok: true });
  } catch (err) {
    fail(res, err, "Lỗi máy chủ khi khôi phục.");
  }
});

/* Xóa vĩnh viễn (chỉ áp dụng cho bản đang nằm trong thùng rác) */
router.delete("/:id/permanent", auth, async (req, res) => {
  try {
    const result = await Timetable.deleteOne({ _id: req.params.id, owner: req.userId, ...TRASHED });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Không tìm thấy trong thùng rác." });
    }
    res.json({ ok: true });
  } catch (err) {
    fail(res, err, "Lỗi máy chủ khi xóa vĩnh viễn.");
  }
});

module.exports = router;
