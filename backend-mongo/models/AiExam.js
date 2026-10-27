const mongoose = require("mongoose");

const { Schema } = mongoose;

/* Đề kiểm tra do AI soạn (Trộn đề → Tạo đề với AI): cấu hình + bản đặc tả + câu hỏi.
 * Ma trận được tính lại từ câu hỏi (mỗi câu gắn bài + mức độ) nên không lưu riêng.
 * Xoá mềm để vẫn tính vào lượt dùng trong ngày. */

const LEVEL = { type: String, enum: ["nb", "th", "vd", "vdc"], required: true };

const aiExamSchema = new Schema(
  {
    school: { type: Schema.Types.ObjectId, ref: "School", required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, trim: true, maxlength: 250 },

    config: {
      level: { type: String, required: true }, // primary | lower_secondary | upper_secondary | gdtx
      grade: { type: String, required: true },
      subject: { type: String, required: true },
      bookSeries: { type: String, default: "" },
      examName: { type: String, default: "" },
      duration: { type: Number, default: 45 },
      lessons: [{ _id: false, chapter: String, title: String }],
      ratios: { nb: Number, th: Number, vd: Number, vdc: Number },
      objectivePercent: { type: Number, default: 70 },
      mcPercent: { type: Number, default: 75 },
      mcPoints: { type: Number, default: 0.25 },
      essayCount: { type: Number, default: 0 },
      notes: { type: String, default: "" },
    },
    counts: { mc: Number, tf: Number, essay: Number, essayPoints: Number },

    specification: [
      {
        _id: false,
        lesson: Number, // chỉ số trong config.lessons
        requirements: { nb: String, th: String, vd: String, vdc: String },
      },
    ],
    mcQuestions: [
      {
        _id: false,
        lesson: Number,
        level: LEVEL,
        question: String,
        options: [String],
        answer: { type: String, enum: ["A", "B", "C", "D"] },
      },
    ],
    tfQuestions: [
      {
        _id: false,
        lesson: Number,
        stem: String,
        statements: [{ _id: false, text: String, correct: Boolean, level: LEVEL }],
      },
    ],
    essayQuestions: [
      {
        _id: false,
        lesson: Number,
        level: LEVEL,
        points: Number,
        question: String,
        answerGuide: String,
      },
    ],
    warnings: [{ type: String }],
    model: { type: String, default: "" },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

aiExamSchema.index({ createdBy: 1, deletedAt: 1, createdAt: -1 });

module.exports = mongoose.model("AiExam", aiExamSchema);
