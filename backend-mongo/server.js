require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./db");
const authRoutes = require("./routes/auth");
const timetableRoutes = require("./routes/timetables");

const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN || "*" }));
app.use(express.json({ limit: "5mb" })); // state TKB có thể khá lớn, tăng giới hạn mặc định 100kb

app.use("/api/auth", authRoutes);
app.use("/api/timetables", timetableRoutes);

app.get("/", (req, res) => res.send("TKB backend (MongoDB) đang chạy ✅"));

connectDB().then(() => {
  const port = process.env.PORT || 3001;
  app.listen(port, () => console.log(`🚀 Server chạy tại http://localhost:${port}`));
});
