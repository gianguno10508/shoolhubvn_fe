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

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.warn("⚠️  JWT_SECRET trong .env quá ngắn (nên ≥ 32 ký tự ngẫu nhiên) — token đăng nhập dễ bị giả mạo.");
}

const app = express();
app.disable("x-powered-by");
// Chạy sau proxy (Nginx, Render...) thì đặt TRUST_PROXY=1 để giới hạn đăng nhập theo đúng IP người dùng
if (process.env.TRUST_PROXY) app.set("trust proxy", Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);

// Header bảo mật cơ bản cho mọi response của API
app.use((req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Cross-Origin-Resource-Policy": "cross-origin",
  });
  next();
});

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
