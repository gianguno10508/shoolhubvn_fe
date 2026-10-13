const mongoose = require("mongoose");

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Đã kết nối MongoDB");
    await require("./models/Timetable").syncIndexes();
    await require("./models/User").syncIndexes();
    await require("./models/Class").syncIndexes();
    await require("./models/School").syncIndexes();
    await require("./models/Assignment").syncIndexes();
    await require("./models/Submission").syncIndexes();
    await require("./models/DisciplineRecord").syncIndexes();
    await require("./models/Notification").syncIndexes();
    await require("./models/NotificationReceipt").syncIndexes();
  } catch (err) {
    console.error("❌ Lỗi kết nối MongoDB:", err.message);
    process.exit(1);
  }
}

module.exports = connectDB;
