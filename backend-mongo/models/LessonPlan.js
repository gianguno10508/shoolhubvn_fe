const mongoose = require("mongoose");

const { Schema } = mongoose;

/* Giáo án (kế hoạch bài dạy) do AI soạn từ ảnh sách giáo khoa, giáo viên có thể sửa lại.
 * Nội dung lưu dạng Markdown để hiển thị trên web và xuất Word. */

const lessonPlanSchema = new Schema(
  {
    school: { type: Schema.Types.ObjectId, ref: "School", required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },

    title: { type: String, required: true, trim: true, maxlength: 200 },
    subject: { type: String, default: "", trim: true, maxlength: 80 },
    grade: { type: String, default: "", trim: true, maxlength: 20 },
    bookSeries: { type: String, default: "", trim: true, maxlength: 80 }, // bộ sách
    periods: { type: Number, default: 1, min: 1, max: 10 }, // số tiết
    notes: { type: String, default: "", trim: true, maxlength: 2000 }, // yêu cầu thêm của giáo viên
    digitalCompetence: { type: Boolean, default: false }, // tích hợp năng lực số (theo bảng mã docx)

    content: { type: String, default: "" },
    imageCount: { type: Number, default: 0 },
    model: { type: String, default: "" },

    // Dàn ý slide trình chiếu do AI tạo từ giáo án (trình duyệt dựng file .pptx từ đây)
    slides: { type: [Schema.Types.Mixed], default: undefined },
    slidesAt: { type: Date, default: null },
    slidesCount: { type: Number, default: 0 }, // số lần đã tạo slide cho giáo án này

    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

lessonPlanSchema.index({ school: 1, createdBy: 1, deletedAt: 1, createdAt: -1 });

module.exports = mongoose.model("LessonPlan", lessonPlanSchema);
