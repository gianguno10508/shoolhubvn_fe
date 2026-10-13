// utils/permissions.js
/* Chức danh + quyền: khớp với backend-mongo/config/roles.js.
 * Backend trả sẵn user.permissions và user.creatableRoles, ở đây chỉ đọc lại. */

export const ROLE_LABEL = {
  admin: "Quản trị hệ thống",
  school_admin: "Tài khoản trường",
  principal: "Ban giám hiệu",
  homeroom_teacher: "Giáo viên chủ nhiệm",
  teacher: "Giáo viên",
  red_flag: "Cờ đỏ",
  youth_union: "Đoàn thanh niên",
  student: "Học sinh",
};

export const ROLE_ICON = {
  admin: "👑",
  school_admin: "🏫",
  principal: "🎖️",
  homeroom_teacher: "🧑‍🏫",
  teacher: "👨‍🏫",
  red_flag: "🚩",
  youth_union: "🔰",
  student: "🎒",
};

/* Chức danh bắt buộc phải gắn với 1 lớp */
export const ROLES_WITH_CLASS = ["homeroom_teacher", "student", "red_flag"];

export function hasPermission(user, permission) {
  return !!user && Array.isArray(user.permissions) && user.permissions.includes(permission);
}

export function isAdmin(user) {
  return !!user && user.role === "admin";
}

/** Có quyền timetable.manage và trường còn hạn VIP (backend đã tự tính isVip) */
export function canManageTimetables(user) {
  if (!user) return false;
  return isAdmin(user) || (hasPermission(user, "timetable.manage") && !!user.isVip);
}

/** Được vào trang quản lý tài khoản của trường */
export function canAccessSchoolUsers(user) {
  return (
    !!user &&
    !!user.schoolId &&
    (hasPermission(user, "users.view") ||
      hasPermission(user, "users.manage") ||
      hasPermission(user, "students.manage_own_class"))
  );
}

export function formatVipUntil(vipUntil) {
  if (!vipUntil) return "Chưa có VIP";
  return new Date(vipUntil).toLocaleDateString("vi-VN");
}

/** Người giao bài tập: mọi chức danh trừ học sinh và cờ đỏ */
export function canManageAssignments(user) {
  return hasPermission(user, "assignment.manage");
}

/** Học sinh / cờ đỏ: làm bài tập được giao */
export function canDoAssignments(user) {
  return hasPermission(user, "assignment.submit");
}

/** Học sinh / cờ đỏ (làm bài nhưng không giao bài) — dùng để đổi menu & trang mặc định */
export function isLearner(user) {
  return canDoAssignments(user) && !canManageAssignments(user);
}

export function homePath(user) {
  if (isLearner(user)) return "/bai-tap";
  if (user?.schoolId) return "/giao-vien";
  return isAdmin(user) ? "/admin/users" : "/tkb";
}

/** Được vào mục Thi đua & Nề nếp (xem / chấm / cấu hình) */
export function canAccessDiscipline(user) {
  return ["discipline.view", "discipline.score", "discipline.config"].some((p) => hasPermission(user, p));
}

/** Trường chưa có / hết hạn VIP: khóa toàn bộ chức năng (admin hệ thống không bị khóa) */
export function isVipLocked(user) {
  return !!user && !isAdmin(user) && !user.isVip;
}
