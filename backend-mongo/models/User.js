const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const { ALL_ROLES, ROLES, permissionsOf, creatableRolesOf } = require("../config/roles");

const { Schema } = mongoose;

const userSchema = new Schema(
  {
    username: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, required: true, select: false },
    name: { type: String, default: "" },
    email: { type: String, default: "", trim: true },
    phone: { type: String, default: "", trim: true },

    // admin hệ thống không thuộc trường nào (school = null)
    school: { type: Schema.Types.ObjectId, ref: "School", default: null },
    role: { type: String, enum: ALL_ROLES, default: ROLES.TEACHER },
    // GVCN: lớp chủ nhiệm; học sinh / cờ đỏ: lớp đang học
    classId: { type: Schema.Types.ObjectId, ref: "Class", default: null },
    studentCode: { type: String, default: "", trim: true },

    status: { type: String, enum: ["active", "locked"], default: "active" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

userSchema.index({ school: 1, role: 1 });
userSchema.index({ school: 1, classId: 1 });

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function (plainPassword) {
  return bcrypt.compare(plainPassword, this.password);
};

userSchema.methods.isAdmin = function () {
  return this.role === ROLES.ADMIN;
};

/** VIP tính theo trường. Cần populate("school") trước khi gọi. */
userSchema.methods.isVipActive = function () {
  if (this.isAdmin()) return true;
  const school = this.school;
  return !!school && typeof school.isVipActive === "function" && school.isVipActive();
};

userSchema.methods.hasPermission = function (permission) {
  return permissionsOf(this.role).includes(permission);
};

/** Cần populate("school") và populate("classId") để trả đủ thông tin */
userSchema.methods.toPublicJSON = function () {
  const school = this.school && this.school.name ? this.school : null;
  const cls = this.classId && this.classId.name ? this.classId : null;
  return {
    id: this._id,
    username: this.username,
    name: this.name,
    email: this.email,
    phone: this.phone,
    role: this.role,
    status: this.status,
    studentCode: this.studentCode,
    school: school ? { id: school._id, name: school.name } : null,
    schoolId: school ? school._id : this.school || null,
    classId: cls ? cls._id : this.classId || null,
    className: cls ? cls.name : "",
    vipUntil: school ? school.vipUntil : null,
    isVip: this.isVipActive(),
    permissions: permissionsOf(this.role),
    creatableRoles: creatableRolesOf(this.role),
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model("User", userSchema);
