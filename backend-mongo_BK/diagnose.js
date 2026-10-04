/**
 * CÁCH DÙNG:
 * 1. Copy file này vào thư mục backend-mongo (cùng cấp với server.js).
 * 2. Chạy:  node diagnose.js
 * 3. Gửi lại TOÀN BỘ nội dung in ra cho mình.
 *
 * File này không sửa gì cả, chỉ đọc và báo cáo.
 */

const path = require("path");

function check(label, relativePath) {
  const full = path.join(__dirname, relativePath);
  console.log("----------------------------------------------------");
  console.log("Kiểm tra:", label, " (" + relativePath + ")");
  try {
    delete require.cache[require.resolve(full)];
  } catch {
    // chưa load lần nào, bỏ qua
  }
  let mod;
  try {
    mod = require(full);
  } catch (err) {
    console.log("  ❌ KHÔNG REQUIRE ĐƯỢC FILE NÀY.");
    console.log("  Lỗi gốc:", err.message);
    return null;
  }
  console.log("  typeof module.exports =", typeof mod);
  if (typeof mod === "function") {
    console.log("  ✅ ĐÚNG — file này export ra một hàm/Router hợp lệ.");
  } else {
    console.log("  ❌ SAI — đáng lẽ phải export ra một HÀM, nhưng lại export ra:", typeof mod);
    console.log("  Nội dung thực tế export ra là:");
    try {
      console.log(
        "  " + JSON.stringify(mod, null, 2).split("\n").join("\n  "),
      );
    } catch {
      console.log("  ", mod);
    }
  }
  return mod;
}

console.log("======================================================");
console.log(" CHẨN ĐOÁN LỖI: Router.use() requires a middleware function");
console.log("======================================================");

check("middleware/auth.js", "middleware/auth.js");
check("middleware/requireAdmin.js", "middleware/requireAdmin.js");
check("middleware/requireTimetableAccess.js", "middleware/requireTimetableAccess.js");
check("routes/auth.js", "routes/auth.js");
check("routes/timetables.js", "routes/timetables.js");
check("routes/admin.js", "routes/admin.js");

console.log("----------------------------------------------------");
console.log("Xong. Nhìn lên trên, dòng nào có ❌ thì đó là file bị lỗi.");
console.log("Gửi lại TOÀN BỘ nội dung in ra ở trên cho mình.");
