const mongoose = require("mongoose");

const { Schema } = mongoose;

/* Tệp đính kèm của thông báo (PDF, Word, Excel...). Lưu nội dung riêng từng tệp
 * để danh sách thông báo không phải tải cả dữ liệu tệp; Notification.attachments chỉ giữ tên, loại, dung lượng. */
const notificationAttachmentSchema = new Schema(
  {
    school: { type: Schema.Types.ObjectId, ref: "School", required: true },
    notification: { type: Schema.Types.ObjectId, ref: "Notification", default: null },
    name: { type: String, required: true },
    mimeType: { type: String, default: "application/octet-stream" },
    size: { type: Number, default: 0 },
    data: { type: Buffer, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

notificationAttachmentSchema.index({ notification: 1 });

module.exports = mongoose.model("NotificationAttachment", notificationAttachmentSchema);
