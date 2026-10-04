const mongoose = require("mongoose");

const timetableSchema = new mongoose.Schema(
  {
    // Chủ sở hữu bản ghi, dùng để lọc "chỉ thấy TKB của chính mình"
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Tên thời khóa biểu, ví dụ "TUẦN 01 NH 2025-2026" (khớp config.tenTKB bên React).
    // Được phép trùng tên: mỗi bản đã có _id riêng để phân biệt.
    name: {
      type: String,
      required: true,
      trim: true,
    },

    // Toàn bộ state React: { config, subjects, teachers, classes, assignments, schedule, ... }
    data: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },

    // null = đang dùng; có giá trị = đang nằm trong thùng rác (xóa mềm, khôi phục được)
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }, // createdAt = lúc tạo, updatedAt = lần lưu gần nhất
);

timetableSchema.index({ owner: 1, deletedAt: 1, createdAt: -1 });

module.exports = mongoose.model("Timetable", timetableSchema);
