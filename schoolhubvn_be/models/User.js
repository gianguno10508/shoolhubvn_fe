const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true, // tránh trùng do khác hoa/thường
    },
    password: {
      type: String,
      required: true, // lưu bản đã băm (hash), KHÔNG BAO GIỜ lưu chữ thường
      select: false, // mặc định không trả field này khi query, tránh lộ ra ngoài
    },
    name: {
      type: String, // họ tên đầy đủ, ví dụ "Nguyễn Văn A"
      default: "",
    },
    className: {
      type: String, // tên lớp phụ trách (nếu có), ví dụ "10A1"
      default: "",
    },
    role: {
      type: String,
      // Tùy chỉnh danh sách này theo nhu cầu thực tế của bạn
      enum: ["admin", "giao_vien", "to_truong"],
      default: "giao_vien",
    },
  },
  { timestamps: true }, // tự thêm createdAt, updatedAt
);

// Tự động băm mật khẩu mỗi khi tạo mới hoặc đổi mật khẩu — không cần nhớ gọi
// bcrypt.hash() tay ở từng chỗ trong route.
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Method tiện dùng ở route login: user.comparePassword("123456")
userSchema.methods.comparePassword = function (plainPassword) {
  return bcrypt.compare(plainPassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
