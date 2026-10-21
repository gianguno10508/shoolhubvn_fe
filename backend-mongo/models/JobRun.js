const mongoose = require("mongoose");

/* Đánh dấu tác vụ định kỳ đã chạy (VD "reminders:2026-10-21"), để khởi động lại server
 * hay chạy nhiều tiến trình cũng không gửi trùng thông báo. */
const jobRunSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
  },
  { timestamps: true },
);

// Tự xóa sau 30 ngày
jobRunSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model("JobRun", jobRunSchema);
