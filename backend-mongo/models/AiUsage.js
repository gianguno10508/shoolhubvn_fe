const mongoose = require("mongoose");

const { Schema } = mongoose;

/* Nhật ký mỗi lần gọi AI có giới hạn lượt theo ngày (hiện dùng cho tạo slide PowerPoint).
 * Giáo án đếm thẳng trên LessonPlan nên không cần ghi ở đây. */
const aiUsageSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    kind: { type: String, enum: ["slides", "curriculum"], required: true }, // curriculum: AI liệt kê mục lục SGK để tạo đề
    ref: { type: Schema.Types.ObjectId, default: null }, // vd: giáo án được tạo slide
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

aiUsageSchema.index({ user: 1, kind: 1, createdAt: -1 });

module.exports = mongoose.model("AiUsage", aiUsageSchema);
