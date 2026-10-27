const mongoose = require("mongoose");

const { Schema } = mongoose;

/* Mục lục SGK (chương / bài) do AI liệt kê cho "Tạo đề với AI".
 * Lưu đệm theo khối + môn + bộ sách để mọi giáo viên dùng chung, không tốn lượt AI mỗi lần mở. */
const examCurriculumSchema = new Schema(
  {
    key: { type: String, required: true, unique: true }, // "10|toán|kết nối tri thức với cuộc sống"
    grade: { type: String, required: true },
    subject: { type: String, required: true },
    bookSeries: { type: String, required: true },
    chapters: [
      {
        _id: false,
        title: { type: String, default: "" },
        semester: { type: Number, default: 1 },
        lessons: [{ type: String }],
      },
    ],
    model: { type: String, default: "" },
  },
  { timestamps: true },
);

module.exports = mongoose.model("ExamCurriculum", examCurriculumSchema);
