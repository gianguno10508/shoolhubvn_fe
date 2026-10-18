const mongoose = require("mongoose");

const { Schema } = mongoose;

/* Cấu hình riêng của từng mục, lấy theo giá trị đang để cứng ở front-end
 * (constants/config.js, TeacherPage, ShuffleExamPage). */

// Mục "Thời khóa biểu": giá trị mặc định khi trường tạo 1 TKB mới
const timetableSettingsSchema = new Schema(
  {
    daysPerWeek: { type: Number, default: 6, min: 1, max: 7 }, // soNgay
    sessionsPerDay: { type: Number, default: 2, min: 1, max: 3 }, // soBuoi
    periodsPerSession: { type: Number, default: 5, min: 1, max: 10 }, // soTiet
    variance: { type: Number, default: 1 }, // phuongSai
    algorithm: { type: String, default: "Thuật toán 4 (tối ưu)" }, // thuatToan
    constraints: {
      noGaps: { type: Boolean, default: true }, // khongTietTrong
      maxPeriodsPerSession: { type: Number, default: 5 }, // lopToiDaTietTrenBuoi
      coreSubjectsInMorning: { type: Boolean, default: false }, // uuTienMonChinhBuoiSang
      flagCeremonyFirstPeriodMonday: { type: Boolean, default: true }, // chaoCoTiet1Thu2
    },
  },
  { _id: false },
);

// Mục "Thi đua & Nề nếp" — Đoàn thanh niên tự cấu hình:
//   mục lớn (Sĩ số, Truy bài, Vệ sinh…) → mục nhỏ (Vắng không phép, Đi muộn…)
//   mỗi mục nhỏ có điểm trừ/cộng và kiểu nhập khi chấm:
//     checkbox : tick là trừ 1 lần
//     names    : ghi tên học sinh, mỗi tên trừ 1 lần
//     count    : nhập số lần, trừ theo số lần
const disciplineItemSchema = new Schema({
  name: { type: String, required: true, trim: true },
  kind: { type: String, enum: ["penalty", "bonus"], default: "penalty" },
  points: { type: Number, default: 1, min: 0, max: 1000 },
  inputType: { type: String, enum: ["checkbox", "names", "count"], default: "checkbox" },
  active: { type: Boolean, default: true },
});

const disciplineCategorySchema = new Schema({
  name: { type: String, required: true, trim: true },
  active: { type: Boolean, default: true },
  items: { type: [disciplineItemSchema], default: [] },
});

// Phân công chấm chéo: cờ đỏ lớp `scorer` chấm các lớp `targets` (vd 11A1 chấm 11A2)
const scoringPairSchema = new Schema(
  {
    scorer: { type: Schema.Types.ObjectId, ref: "Class", required: true },
    targets: [{ type: Schema.Types.ObjectId, ref: "Class" }],
  },
  { _id: false },
);

const disciplineSettingsSchema = new Schema(
  {
    configured: { type: Boolean, default: false }, // false = chưa lưu lần nào, dùng mẫu mặc định
    basePoints: { type: Number, default: 100, min: 0 }, // điểm khởi đầu mỗi tuần
    weekStartDay: { type: Number, default: 1, min: 0, max: 6 }, // 1 = thứ 2
    scoreDays: { type: [Number], default: [1, 2, 3, 4, 5, 6] }, // các ngày trong tuần có chấm (0 = CN)
    categories: { type: [disciplineCategorySchema], default: [] },
    weekOneStart: { type: String, default: "" }, // YYYY-MM-DD: ngày thuộc tuần 1 của năm học (trống = tự tính từ 05/09)
    scoringPairs: { type: [scoringPairSchema], default: [] },
  },
  { _id: false },
);

// Mục "Bài tập & Tự chấm"
const assignmentSettingsSchema = new Schema(
  {
    autoGrade: { type: Boolean, default: true },
    allowLateSubmission: { type: Boolean, default: false },
    maxAttempts: { type: Number, default: 1, min: 1 },
  },
  { _id: false },
);

// Mục "Kiểm tra & Đánh giá" (trộn đề)
const examSettingsSchema = new Schema(
  {
    shuffleQuestions: { type: Boolean, default: true },
    shuffleOptions: { type: Boolean, default: true },
    versionCount: { type: Number, default: 4, min: 1 }, // examCount
    startCode: { type: Number, default: 101 },
  },
  { _id: false },
);

// Bật / tắt từng mục cho trường
const modulesSchema = new Schema(
  {
    timetable: { type: Boolean, default: true },
    discipline: { type: Boolean, default: true },
    assignments: { type: Boolean, default: true },
    students: { type: Boolean, default: true },
    exams: { type: Boolean, default: true },
  },
  { _id: false },
);

const schoolSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true, lowercase: true, unique: true, sparse: true },
    level: { type: String, enum: ["primary", "secondary", "high_school", "other"], default: "high_school" },
    address: { type: String, default: "" },
    province: { type: String, default: "" },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    academicYear: { type: String, default: "2025-2026" },

    owner: { type: Schema.Types.ObjectId, ref: "User", default: null }, // tài khoản school_admin
    vipUntil: { type: Date, default: null }, // VIP tính theo trường, không theo từng user
    status: { type: String, enum: ["active", "suspended"], default: "active" },

    modules: { type: modulesSchema, default: () => ({}) },
    settings: {
      timetable: { type: timetableSettingsSchema, default: () => ({}) },
      discipline: { type: disciplineSettingsSchema, default: () => ({}) },
      assignments: { type: assignmentSettingsSchema, default: () => ({}) },
      exams: { type: examSettingsSchema, default: () => ({}) },
    },
  },
  { timestamps: true },
);

schoolSchema.methods.isVipActive = function () {
  return this.status === "active" && !!this.vipUntil && this.vipUntil.getTime() > Date.now();
};

schoolSchema.methods.toPublicJSON = function () {
  return {
    id: this._id,
    name: this.name,
    code: this.code,
    level: this.level,
    address: this.address,
    province: this.province,
    phone: this.phone,
    email: this.email,
    academicYear: this.academicYear,
    status: this.status,
    vipUntil: this.vipUntil,
    isVip: this.isVipActive(),
    modules: this.modules,
    settings: this.settings,
  };
};

module.exports = mongoose.model("School", schoolSchema);
