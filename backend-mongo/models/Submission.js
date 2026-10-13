const mongoose = require("mongoose");

const { Schema } = mongoose;

/* Một lượt làm bài của học sinh. Lưu kèm thông tin tài khoản + tên học sinh
 * tại thời điểm làm bài, để kết quả vẫn đúng kể cả khi tài khoản bị đổi / xóa. */

const answerSchema = new Schema(
  {
    questionNumber: { type: Number, required: true },
    answer: { type: String, enum: ["A", "B", "C", "D"], required: true },
  },
  { _id: false },
);

const submissionSchema = new Schema(
  {
    assignment: { type: Schema.Types.ObjectId, ref: "Assignment", required: true },
    school: { type: Schema.Types.ObjectId, ref: "School", required: true },
    student: { type: Schema.Types.ObjectId, ref: "User", required: true },
    attempt: { type: Number, default: 1 },

    // Ảnh chụp thông tin tài khoản lúc làm bài
    studentName: { type: String, default: "" },
    studentUsername: { type: String, default: "" },
    studentCode: { type: String, default: "" },
    classId: { type: Schema.Types.ObjectId, ref: "Class", default: null },
    className: { type: String, default: "" },

    // Thứ tự hiển thị riêng cho học sinh này (khi bật trộn câu / trộn phương án)
    questionOrder: [{ type: Number }], // danh sách questionNumber
    optionOrder: { type: Map, of: [String], default: {} }, // questionNumber -> ["C","A","D","B"]

    answers: { type: [answerSchema], default: [] },

    startedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true }, // min(startedAt + thời gian làm, hạn chót)
    submittedAt: { type: Date, default: null },
    status: { type: String, enum: ["in_progress", "submitted"], default: "in_progress" },
    autoSubmitted: { type: Boolean, default: false }, // hệ thống tự nộp khi hết giờ

    correctCount: { type: Number, default: 0 },
    totalQuestions: { type: Number, default: 0 },
    score: { type: Number, default: null },
  },
  { timestamps: true },
);

submissionSchema.index({ assignment: 1, student: 1, attempt: 1 }, { unique: true });
submissionSchema.index({ assignment: 1, status: 1 });
submissionSchema.index({ student: 1, status: 1 });

submissionSchema.methods.toResultJSON = function () {
  return {
    id: this._id,
    assignmentId: this.assignment,
    studentId: this.student,
    studentName: this.studentName,
    studentUsername: this.studentUsername,
    studentCode: this.studentCode,
    classId: this.classId,
    className: this.className,
    attempt: this.attempt,
    status: this.status,
    autoSubmitted: this.autoSubmitted,
    startedAt: this.startedAt,
    expiresAt: this.expiresAt,
    submittedAt: this.submittedAt,
    durationSeconds:
      this.submittedAt ? Math.round((this.submittedAt.getTime() - this.startedAt.getTime()) / 1000) : null,
    correctCount: this.correctCount,
    totalQuestions: this.totalQuestions,
    score: this.score,
  };
};

module.exports = mongoose.model("Submission", submissionSchema);
