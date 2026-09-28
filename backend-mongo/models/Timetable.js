const mongoose = require("mongoose");

const timetableSchema = new mongoose.Schema(
  {
    // Chủ sở hữu bản ghi — dùng để lọc "chỉ thấy TKB của chính mình"
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Tên thời khóa biểu, ví dụ "TUẦN 01 NH 2025-2026" (lấy từ config.tenTKB bên React)
    name: {
      type: String,
      required: true,
      trim: true,
    },

    // Toàn bộ state React nhét nguyên khối vào đây, không cần định nghĩa
    // cấu trúc bên trong trước: { config, subjects, teachers, classes,
    // assignments, schedule, constraints, ... }
    data: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
  },
  { timestamps: true }, // createdAt = lúc tạo, updatedAt = lần lưu gần nhất
);

// Mỗi tài khoản không được có 2 bản TKB trùng tên
timetableSchema.index({ owner: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Timetable", timetableSchema);
