// utils/permissions.js
/** admin luôn có quyền; tài khoản thường phải đang còn hạn VIP (backend đã tự tính isVip, ở đây chỉ đọc lại) */
export function canManageTimetables(user) {
  if (!user) return false;
  return user.role === "admin" || !!user.isVip;
}

export function isAdmin(user) {
  return !!user && user.role === "admin";
}

export function formatVipUntil(vipUntil) {
  if (!vipUntil) return "Chưa có VIP";
  return new Date(vipUntil).toLocaleDateString("vi-VN");
}
