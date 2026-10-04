const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, required: true, select: false },
    name: { type: String, default: "" },
    className: { type: String, default: "" },
    role: { type: String, enum: ["admin", "giao_vien", "to_truong"], default: "giao_vien" },
    vipUntil: { type: Date, default: null },
  },
  { timestamps: true },
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function (plainPassword) {
  return bcrypt.compare(plainPassword, this.password);
};

userSchema.methods.isVipActive = function () {
  return !!this.vipUntil && this.vipUntil.getTime() > Date.now();
};

userSchema.methods.canManageTimetables = function () {
  return this.role === "admin" || this.isVipActive();
};

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
