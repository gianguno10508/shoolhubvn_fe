// utils/passwordPolicy.js — yêu cầu mật khẩu khi đăng ký / đổi mật khẩu (máy chủ kiểm tra lại y hệt: backend-mongo/utils/passwordPolicy.js)

export const PASSWORD_RULES = [
  { key: "length", label: "Ít nhất 8 ký tự", test: (p) => p.length >= 8 },
  { key: "lower", label: "Có chữ thường (a-z)", test: (p) => /[a-z]/.test(p) },
  { key: "upper", label: "Có chữ in hoa (A-Z)", test: (p) => /[A-Z]/.test(p) },
  { key: "special", label: "Có ký tự đặc biệt (! @ # $ % ...)", test: (p) => /[^A-Za-z0-9\s]/.test(p) },
];

/** Câu báo lỗi tiếng Việt, hoặc "" nếu mật khẩu đạt yêu cầu */
export function passwordError(password, username = "") {
  const p = String(password || "");
  if (p.length > 128) return "Mật khẩu tối đa 128 ký tự.";
  if (/\s/.test(p)) return "Mật khẩu không được chứa khoảng trắng.";
  const missing = PASSWORD_RULES.filter((r) => !r.test(p));
  if (missing.length) return `Mật khẩu chưa đạt: ${missing.map((r) => r.label.toLowerCase()).join(", ")}.`;
  const u = String(username || "").toLowerCase();
  if (u.length >= 3 && p.toLowerCase().includes(u)) return "Mật khẩu không được chứa tên đăng nhập.";
  return "";
}
