// routes/timetables.js — chỉ 12 dòng đầu thay đổi so với bản trước
const express = require("express");
const Timetable = require("../models/Timetable");
const auth = require("../middleware/auth");
const requireTimetableAccess = require("../middleware/requireTimetableAccess");

const router = express.Router();

// Mọi route đều đi qua `auth` (đăng nhập) rồi `requireTimetableAccess`
// (admin hoặc VIP còn hạn) trước khi chạm vào dữ liệu, và MỌI truy vấn đều
// lọc theo `owner: req.userId` -> tài khoản này không đọc/sửa/xóa được thời
// khóa biểu của tài khoản khác.
router.use(auth, requireTimetableAccess);

// (phần còn lại của file giữ nguyên như bản trước, chỉ khác: mỗi
//  router.get/post/put/delete(...) bỏ tham số `auth,` đi vì đã có
//  router.use(auth, ...) ở trên lo việc đó rồi — ví dụ:
//  router.get("/", async (req, res) => { ... })
//  router.post("/:id/duplicate", async (req, res) => { ... })
