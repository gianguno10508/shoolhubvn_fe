// constants/brand.js — tên, khẩu hiệu, thông tin bản quyền & nhà phát triển (sửa tại đây để đổi toàn bộ web)

export const BRAND = {
  name: "SchoolHub",
  tagline: "Nền tảng quản lý trường học số",
  description: "Thời khóa biểu, bài tập, kiểm tra, giáo án AI, thi đua và thông báo — tất cả trong một.",
  developer: "vxphuongictu",
  since: 2025,
  version: "1.0.0",
};

/** "© 2025–2026 SchoolHub" */
export function copyrightText(now = new Date()) {
  const year = now.getFullYear();
  const range = year > BRAND.since ? `${BRAND.since}–${year}` : String(year);
  return `© ${range} ${BRAND.name}`;
}
