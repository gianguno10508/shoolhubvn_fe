const express = require("express");
const Timetable = require("../models/Timetable");
const auth = require("../middleware/auth");

const router = express.Router();

// Mọi route bên dưới đều đi qua `auth` trước, và MỌI truy vấn đều lọc
// theo `owner: req.userId` -> tài khoản này không bao giờ đọc/sửa/xóa được
// thời khóa biểu của tài khoản khác.

/* Danh sách các bản TKB của tài khoản đang đăng nhập (không kèm "data" đầy đủ
 * cho nhẹ — chỉ hiện tên + thời gian cập nhật, giống danh sách file). */
router.get("/", auth, async (req, res) => {
  const list = await Timetable.find({ owner: req.userId })
    .select("name updatedAt createdAt")
    .sort({ updatedAt: -1 });
  res.json(list);
});

/* Lấy đầy đủ 1 bản TKB theo id (chỉ khi đúng chủ sở hữu) */
router.get("/:id", auth, async (req, res) => {
  try {
    const doc = await Timetable.findOne({ _id: req.params.id, owner: req.userId });
    if (!doc) return res.status(404).json({ error: "Không tìm thấy thời khóa biểu." });
    res.json(doc);
  } catch (err) {
    res.status(400).json({ error: "Mã thời khóa biểu không hợp lệ." });
  }
});

/* Tạo mới 1 bản TKB
 * body: { name, data } — data là nguyên state React */
router.post("/", auth, async (req, res) => {
  try {
    const { name, data } = req.body;
    if (!name || !data) {
      return res.status(400).json({ error: "Thiếu tên hoặc dữ liệu thời khóa biểu." });
    }
    const doc = await Timetable.create({ owner: req.userId, name, data });
    res.json(doc);
  } catch (err) {
    if (err.code === 11000) {
      return res
        .status(409)
        .json({ error: "Bạn đã có 1 thời khóa biểu trùng tên này rồi." });
    }
    console.error(err);
    res.status(500).json({ error: "Lỗi máy chủ khi tạo thời khóa biểu." });
  }
});

/* Cập nhật (ghi đè) 1 bản TKB đã có, theo id
 * body: { name?, data } */
router.put("/:id", auth, async (req, res) => {
  try {
    const { name, data } = req.body;
    const doc = await Timetable.findOneAndUpdate(
      { _id: req.params.id, owner: req.userId }, // chỉ update nếu đúng chủ sở hữu
      { ...(name ? { name } : {}), ...(data ? { data } : {}) },
      { new: true },
    ).select("name updatedAt"); // không trả lại cả khối data lớn
    if (!doc) return res.status(404).json({ error: "Không tìm thấy thời khóa biểu." });
    res.json(doc);
  } catch (err) {
    if (err.code === 11000) {
      return res
        .status(409)
        .json({ error: "Bạn đã có 1 thời khóa biểu trùng tên này rồi." });
    }
    console.error(err);
    res.status(500).json({ error: "Lỗi máy chủ khi lưu thời khóa biểu." });
  }
});

/* Xóa 1 bản TKB theo id */
router.delete("/:id", auth, async (req, res) => {
  try {
    const result = await Timetable.deleteOne({ _id: req.params.id, owner: req.userId });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Không tìm thấy thời khóa biểu." });
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: "Mã thời khóa biểu không hợp lệ." });
  }
});

module.exports = router;
