const mongoose = require("mongoose");

const timetableSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    // TKB thuộc về trường: mọi tài khoản có quyền xếp TKB trong trường đều dùng chung
    school: { type: mongoose.Schema.Types.ObjectId, ref: "School", default: null },
    name: { type: String, required: true, trim: true },
    data: { type: mongoose.Schema.Types.Mixed, required: true },
    // TKB đang áp dụng của trường (mỗi trường tối đa 1) — giáo viên, học sinh xem trên app di động
    published: { type: Boolean, default: false },
    publishedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

timetableSchema.index({ owner: 1, deletedAt: 1, createdAt: -1 });
timetableSchema.index({ school: 1, deletedAt: 1, createdAt: -1 });

module.exports = mongoose.model("Timetable", timetableSchema);
