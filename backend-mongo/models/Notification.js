const mongoose = require("mongoose");

const { Schema } = mongoose;

/* Thông báo nội bộ trường.
 * Người nhận được xác định theo `audience` tại lúc đọc (không nhân bản thông báo cho từng người),
 * trạng thái đã đọc lưu riêng ở NotificationReceipt.
 *
 * audience.type:
 *   staff  : toàn bộ giáo viên & cán bộ (mọi chức danh trừ học sinh, cờ đỏ)
 *   all    : toàn trường
 *   roles  : theo chức danh (audience.roles)
 *   classes: học sinh + cờ đỏ của các lớp (audience.classIds), kèm GVCN các lớp đó */

const notificationSchema = new Schema(
  {
    school: { type: Schema.Types.ObjectId, ref: "School", required: true },
    sender: { type: Schema.Types.ObjectId, ref: "User", required: true },
    senderName: { type: String, default: "" },
    senderRole: { type: String, default: "" },

    title: { type: String, required: true, trim: true, maxlength: 150 },
    body: { type: String, default: "", trim: true, maxlength: 5000 },
    priority: { type: String, enum: ["normal", "important"], default: "normal" },

    audience: {
      type: { type: String, enum: ["staff", "all", "roles", "classes"], required: true },
      roles: [{ type: String }],
      classIds: [{ type: Schema.Types.ObjectId, ref: "Class" }],
    },
    audienceLabel: { type: String, default: "" }, // "Toàn trường", "Lớp 10A1, 10A2"…
    recipientCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

notificationSchema.index({ school: 1, createdAt: -1 });
notificationSchema.index({ sender: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);
