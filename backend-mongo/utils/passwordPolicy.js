// utils/passwordPolicy.js — yêu cầu mật khẩu khi đăng ký / đổi mật khẩu (giống frontend/src/utils/passwordPolicy.js và app mobile)
//   ≥ 8 ký tự, có chữ thường, chữ in hoa, ký tự đặc biệt; không chứa tên đăng nhập

const RULES = [
  { test: (p) => p.length >= 8, message: "ít nhất 8 ký tự" },
  { test: (p) => /[a-z]/.test(p), message: "có chữ thường (a-z)" },
  { test: (p) => /[A-Z]/.test(p), message: "có chữ in hoa (A-Z)" },
  { test: (p) => /[^A-Za-z0-9\s]/.test(p), message: "có ký tự đặc biệt (VD: ! @ # $ %)" },
];

/** Trả về câu báo lỗi tiếng Việt, hoặc null nếu mật khẩu đạt yêu cầu */
function passwordError(password, username = "") {
  const p = String(password || "");
  if (p.length > 128) return "Mật khẩu tối đa 128 ký tự.";
  if (/\s/.test(p)) return "Mật khẩu không được chứa khoảng trắng.";
  const missing = RULES.filter((r) => !r.test(p)).map((r) => r.message);
  if (missing.length) return `Mật khẩu cần ${missing.join(", ")}.`;
  const u = String(username || "").toLowerCase();
  if (u.length >= 3 && p.toLowerCase().includes(u)) return "Mật khẩu không được chứa tên đăng nhập.";
  return null;
}

module.exports = { passwordError };
