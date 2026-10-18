require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./db");
const authRoutes = require("./routes/auth");
const timetableRoutes = require("./routes/timetables");
const adminRoutes = require("./routes/admin");
const schoolRoutes = require("./routes/school");
const assignmentRoutes = require("./routes/assignments");
const disciplineRoutes = require("./routes/discipline");
const dashboardRoutes = require("./routes/dashboard");
const notificationRoutes = require("./routes/notifications");
const lessonPlanRoutes = require("./routes/lessonPlans");
const myTimetableRoutes = require("./routes/myTimetable");

const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN || "*" }));
// Giáo án AI nhận nhiều ảnh SGK (base64) nên cần giới hạn lớn hơn — đặt trước express.json chung
app.use("/api/lesson-plans", express.json({ limit: "45mb" }), lessonPlanRoutes);
app.use(express.json({ limit: "5mb" }));

app.use("/api/auth", authRoutes);
app.use("/api/timetables", timetableRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/school", schoolRoutes);
app.use("/api/assignments", assignmentRoutes);
app.use("/api/discipline", disciplineRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/my-timetable", myTimetableRoutes);

app.get("/", (req, res) => res.send("TKB backend (MongoDB) đang chạy ✅"));

connectDB().then(() => {
  const port = process.env.PORT || 3001;
  app.listen(port, () => console.log(`🚀 Server chạy tại http://localhost:${port}`));
});
