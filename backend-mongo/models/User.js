// models/User.js
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
      // "admin": toàn quyền, kể cả quản lý tài khoản.
      // "giao_vien" / "to_truong": tài khoản thường, muốn xếp TKB phải có VIP còn hạn.
      enum: ["admin", "giao_vien", "to_truong"],
      default: "giao_vien",
    },
    // null/ở quá khứ = không có VIP hoặc đã hết hạn. Còn trong tương lai = đang VIP.
    // Không dùng role="vip" riêng vì VIP có ngày hết hạn, còn role là quyền cố định.
    vipUntil: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }, // tự thêm createdAt, updatedAt
);

// Tự động băm mật khẩu mỗi khi tạo mới hoặc đổi mật khẩu.
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function (plainPassword) {
  return bcrypt.compare(plainPassword, this.password);
};

/** true nếu VIP còn hạn tại thời điểm gọi hàm */
userSchema.methods.isVipActive = function () {
  return !!this.vipUntil && this.vipUntil.getTime() > Date.now();
};

/** admin luôn có quyền; tài khoản thường phải đang còn hạn VIP */
userSchema.methods.canManageTimetables = function () {
  return this.role === "admin" || this.isVipActive();
};

/** Dữ liệu an toàn để trả về client (không có password) */
userSchema.methods.toPublicJSON = function () {
  return {
    id: this._id,
    username: this.username,
    name: this.name,
    className: this.className,
    role: this.role,
    vipUntil: this.vipUntil,
    isVip: this.isVipActive(),
  };
};

module.exports = mongoose.model("User", userSchema);
