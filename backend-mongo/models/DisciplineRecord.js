const mongoose = require("mongoose");

const { Schema } = mongoose;

/* Phiếu chấm thi đua: 1 lớp × 1 ngày.
 * Mỗi dòng lưu kèm tên mục / điểm tại thời điểm chấm, nên Đoàn thanh niên
 * đổi hay xóa mục trong cấu hình cũng không làm sai điểm các tuần trước. */

const entrySchema = new Schema(
  {
    categoryId: { type: Schema.Types.ObjectId, required: true },
    categoryName: { type: String, required: true },
    itemId: { type: Schema.Types.ObjectId, required: true },
    itemName: { type: String, required: true },
    kind: { type: String, enum: ["penalty", "bonus"], required: true },
    inputType: { type: String, enum: ["checkbox", "names", "count"], required: true },
    points: { type: Number, required: true }, // điểm cho 1 lần
    quantity: { type: Number, required: true, min: 1 }, // số lần (checkbox = 1, names = số tên)
    studentNames: { type: [String], default: [] },
    note: { type: String, default: "" },
    total: { type: Number, required: true }, // points × quantity (luôn dương)
  },
  { _id: false },
);

const disciplineRecordSchema = new Schema(
  {
    school: { type: Schema.Types.ObjectId, ref: "School", required: true },
    classId: { type: Schema.Types.ObjectId, ref: "Class", required: true },
    className: { type: String, default: "" },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ }, // ngày chấm, theo giờ VN
    weekStart: { type: String, required: true }, // ngày đầu tuần chứa `date`, để tổng hợp nhanh
    entries: { type: [entrySchema], default: [] },
    totalPenalty: { type: Number, default: 0 },
    totalBonus: { type: Number, default: 0 },
    note: { type: String, default: "" },
    recordedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    recordedByName: { type: String, default: "" },
  },
  { timestamps: true },
);

disciplineRecordSchema.index({ school: 1, classId: 1, date: 1 }, { unique: true });
disciplineRecordSchema.index({ school: 1, date: 1 });
disciplineRecordSchema.index({ school: 1, weekStart: 1 });

disciplineRecordSchema.methods.toPublicJSON = function () {
  return {
    id: this._id,
    classId: this.classId,
    className: this.className,
    date: this.date,
    weekStart: this.weekStart,
    entries: this.entries,
    totalPenalty: this.totalPenalty,
    totalBonus: this.totalBonus,
    net: this.totalBonus - this.totalPenalty,
    note: this.note,
    recordedBy: this.recordedBy,
    recordedByName: this.recordedByName,
    updatedAt: this.updatedAt,
  };
};

module.exports = mongoose.model("DisciplineRecord", disciplineRecordSchema);
