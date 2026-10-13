const mongoose = require("mongoose");

/* Lớp học thuộc 1 trường. GVCN của lớp = User có role "homeroom_teacher" và classId trỏ tới lớp này. */
const classSchema = new mongoose.Schema(
  {
    school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },
    name: { type: String, required: true, trim: true }, // ví dụ: 10A1
    grade: { type: String, default: "", trim: true }, // ví dụ: Khối 10
    academicYear: { type: String, required: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

classSchema.index({ school: 1, academicYear: 1, name: 1 }, { unique: true });

classSchema.methods.toPublicJSON = function () {
  return {
    id: this._id,
    name: this.name,
    grade: this.grade,
    academicYear: this.academicYear,
  };
};

module.exports = mongoose.model("Class", classSchema);
