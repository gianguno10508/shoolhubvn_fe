const mongoose = require("mongoose");

const { Schema } = mongoose;

/* Bài tập trắc nghiệm giao từ file PDF (cùng định dạng với trộn đề:
 * "Câu 1. ...", phương án "A. ... D.", đáp án đúng gạch chân "_A."). */

const optionSchema = new Schema(
  {
    letter: { type: String, enum: ["A", "B", "C", "D"], required: true },
    text: { type: String, default: "" },
  },
  { _id: false },
);

const questionSchema = new Schema(
  {
    number: { type: Number, required: true }, // thứ tự gốc trong file, dùng làm khóa khi chấm
    text: { type: String, required: true },
    options: { type: [optionSchema], default: [] },
    correctAnswer: { type: String, enum: ["A", "B", "C", "D"], required: true },
  },
  { _id: false },
);

const assignmentSchema = new Schema(
  {
    school: { type: Schema.Types.ObjectId, ref: "School", required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },

    title: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    sourceFileName: { type: String, default: "" },
    questions: {
      type: [questionSchema],
      validate: [(v) => v.length > 0, "Bài tập phải có ít nhất 1 câu hỏi."],
    },

    // Cấu hình
    classIds: [{ type: Schema.Types.ObjectId, ref: "Class" }], // các lớp được giao
    totalPoints: { type: Number, default: 10, min: 1, max: 1000 }, // thang điểm
    durationMinutes: { type: Number, default: 45, min: 1, max: 600 }, // thời gian làm bài
    openAt: { type: Date, default: Date.now }, // thời điểm bắt đầu cho làm
    dueAt: { type: Date, required: true }, // hạn chót (deadline)
    maxAttempts: { type: Number, default: 1, min: 1, max: 10 },
    shuffleQuestions: { type: Boolean, default: false },
    shuffleOptions: { type: Boolean, default: false },
    showAnswers: { type: Boolean, default: false }, // cho xem đáp án sau khi nộp

    status: { type: String, enum: ["published", "closed"], default: "published" },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

assignmentSchema.index({ school: 1, deletedAt: 1, dueAt: -1 });
assignmentSchema.index({ school: 1, classIds: 1, status: 1 });

assignmentSchema.methods.isOpen = function (now = Date.now()) {
  return this.status === "published" && this.openAt.getTime() <= now && this.dueAt.getTime() > now;
};

/** Thông tin chung, không kèm câu hỏi */
assignmentSchema.methods.toSummaryJSON = function () {
  return {
    id: this._id,
    title: this.title,
    description: this.description,
    sourceFileName: this.sourceFileName,
    questionCount: this.questions.length,
    classIds: this.classIds,
    totalPoints: this.totalPoints,
    durationMinutes: this.durationMinutes,
    openAt: this.openAt,
    dueAt: this.dueAt,
    maxAttempts: this.maxAttempts,
    shuffleQuestions: this.shuffleQuestions,
    shuffleOptions: this.shuffleOptions,
    showAnswers: this.showAnswers,
    status: this.status,
    isOpen: this.isOpen(),
    createdBy: this.createdBy,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model("Assignment", assignmentSchema);
