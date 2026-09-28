/* ================= tiện ích xử lý chuỗi ================= */

/** Viết tắt họ tên: giữ nguyên tên cuối, viết tắt họ + tên đệm. Vd: Nguyễn Văn An -> N.V.An */
export function abbreviateName(fullName) {
  const parts = String(fullName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  const last = parts[parts.length - 1];
  const initials = parts
    .slice(0, -1)
    .map((p) => p.charAt(0).toLocaleUpperCase("vi-VN"))
    .join(".");
  return initials + "." + last;
}

/** Chuẩn hóa tên sheet Excel: bỏ ký tự không hợp lệ, giới hạn 31 ký tự */
export function safeSheetName(name) {
  return String(name)
    .replace(/[\\/?*[\]:]/g, "-")
    .slice(0, 31);
}

/** Chuyển văn bản có dấu thành slug an toàn cho tên file */
export function slugify(text) {
  return (
    String(text || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "thoi-khoa-bieu"
  );
}
