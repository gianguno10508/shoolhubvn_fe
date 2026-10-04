const mongoose = require("mongoose");

const timetableSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true },
    data: { type: mongoose.Schema.Types.Mixed, required: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

timetableSchema.index({ owner: 1, deletedAt: 1, createdAt: -1 });

module.exports = mongoose.model("Timetable", timetableSchema);
