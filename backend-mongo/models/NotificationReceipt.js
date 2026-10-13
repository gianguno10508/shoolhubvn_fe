const mongoose = require("mongoose");

/* Trạng thái đã đọc của 1 người với 1 thông báo (chưa có bản ghi = chưa đọc) */
const receiptSchema = new mongoose.Schema({
  notification: { type: mongoose.Schema.Types.ObjectId, ref: "Notification", required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  readAt: { type: Date, default: Date.now },
});

receiptSchema.index({ notification: 1, user: 1 }, { unique: true });
receiptSchema.index({ user: 1 });

module.exports = mongoose.model("NotificationReceipt", receiptSchema);
