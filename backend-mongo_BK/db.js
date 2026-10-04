const mongoose = require("mongoose");

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Đã kết nối MongoDB");

    // Đồng bộ index theo schema: gỡ index cũ "owner + name unique" (nếu đã lỡ tạo)
    // để cho phép nhiều thời khóa biểu trùng tên.
    await require("./models/Timetable").syncIndexes();
  } catch (err) {
    console.error("❌ Lỗi kết nối MongoDB:", err.message);
    process.exit(1);
  }
}

module.exports = connectDB;
