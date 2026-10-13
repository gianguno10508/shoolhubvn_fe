/* Chuyển dữ liệu cũ (mỗi user tự có VIP, role giao_vien / to_truong) sang mô hình theo trường:
 * mỗi tài khoản cũ không phải admin -> 1 trường mới + tài khoản đó thành school_admin,
 * VIP chuyển từ user sang trường, TKB của user gắn vào trường đó.
 * Chạy 1 lần: node scripts/migrate-to-schools.js */
require("dotenv").config();
const mongoose = require("mongoose");
const School = require("../models/School");
const Timetable = require("../models/Timetable");

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const users = mongoose.connection.collection("users");

  const legacy = await users.find({ role: { $ne: "admin" }, school: { $in: [null, undefined] } }).toArray();
  console.log(`Tìm thấy ${legacy.length} tài khoản cần chuyển.`);

  for (const u of legacy) {
    const school = await School.create({
      name: u.className ? `Trường của ${u.name || u.username} (${u.className})` : `Trường của ${u.name || u.username}`,
      owner: u._id,
      vipUntil: u.vipUntil || null,
    });
    await users.updateOne(
      { _id: u._id },
      { $set: { school: school._id, role: "school_admin", status: "active" }, $unset: { vipUntil: "", className: "" } },
    );
    const moved = await Timetable.updateMany({ owner: u._id }, { $set: { school: school._id } });
    console.log(`- ${u.username} -> trường "${school.name}" (${moved.modifiedCount} TKB)`);
  }

  await users.updateMany({ role: "admin" }, { $unset: { vipUntil: "", className: "" } });
  await mongoose.disconnect();
  console.log("Xong.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
