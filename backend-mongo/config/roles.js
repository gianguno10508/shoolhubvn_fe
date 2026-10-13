// Danh sách chức danh (role) và quyền (permission) dùng chung cho toàn bộ backend.

const ROLES = {
  ADMIN: "admin", // Quản trị hệ thống (không thuộc trường nào, cấp VIP cho trường)
  SCHOOL_ADMIN: "school_admin", // Tài khoản chính của trường (tạo khi đăng ký)
  PRINCIPAL: "principal", // Ban giám hiệu
  HOMEROOM_TEACHER: "homeroom_teacher", // Giáo viên chủ nhiệm
  TEACHER: "teacher", // Giáo viên bộ môn
  RED_FLAG: "red_flag", // Cờ đỏ
  YOUTH_UNION: "youth_union", // Đoàn thanh niên
  STUDENT: "student", // Học sinh
};

const ALL_ROLES = Object.values(ROLES);

const PERMISSIONS = {
  SCHOOL_MANAGE: "school.manage", // sửa thông tin + cấu hình từng mục của trường
  USERS_MANAGE: "users.manage", // tạo / sửa / xóa mọi tài khoản trong trường
  USERS_VIEW: "users.view", // xem danh sách tài khoản trong trường
  CLASSES_MANAGE: "classes.manage", // tạo / sửa / xóa lớp
  OWN_CLASS_STUDENTS_MANAGE: "students.manage_own_class", // GVCN tạo tài khoản HS lớp mình
  TIMETABLE_MANAGE: "timetable.manage",
  TIMETABLE_VIEW: "timetable.view",
  DISCIPLINE_CONFIG: "discipline.config", // cấu hình tiêu chí thi đua
  DISCIPLINE_SCORE: "discipline.score", // chấm thi đua / nề nếp
  DISCIPLINE_VIEW: "discipline.view",
  ASSIGNMENT_MANAGE: "assignment.manage", // giao bài tập
  ASSIGNMENT_SUBMIT: "assignment.submit", // làm bài tập
  EXAM_MANAGE: "exam.manage", // tạo đề / trộn đề
  NOTIFY_SCHOOL: "notification.send_school", // gửi thông báo toàn trường / theo chức danh / theo lớp
  NOTIFY_CLASS: "notification.send_class", // GVCN gửi thông báo cho lớp mình
};

const P = PERMISSIONS;

const ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: Object.values(P),
  [ROLES.SCHOOL_ADMIN]: Object.values(P).filter((p) => p !== P.ASSIGNMENT_SUBMIT),
  [ROLES.PRINCIPAL]: [
    P.USERS_VIEW,
    P.NOTIFY_SCHOOL,
    P.TIMETABLE_MANAGE,
    P.TIMETABLE_VIEW,
    P.DISCIPLINE_VIEW,
    P.ASSIGNMENT_MANAGE,
    P.EXAM_MANAGE,
  ],
  [ROLES.HOMEROOM_TEACHER]: [
    P.OWN_CLASS_STUDENTS_MANAGE,
    P.NOTIFY_CLASS,
    P.TIMETABLE_VIEW,
    P.DISCIPLINE_VIEW,
    P.ASSIGNMENT_MANAGE,
    P.EXAM_MANAGE,
  ],
  [ROLES.TEACHER]: [P.TIMETABLE_VIEW, P.ASSIGNMENT_MANAGE, P.EXAM_MANAGE],
  [ROLES.YOUTH_UNION]: [
    P.TIMETABLE_VIEW,
    P.DISCIPLINE_CONFIG,
    P.DISCIPLINE_SCORE,
    P.DISCIPLINE_VIEW,
    P.ASSIGNMENT_MANAGE,
    P.NOTIFY_SCHOOL,
  ],
  // Cờ đỏ cũng là học sinh nên vẫn làm bài tập
  [ROLES.RED_FLAG]: [P.TIMETABLE_VIEW, P.DISCIPLINE_SCORE, P.DISCIPLINE_VIEW, P.ASSIGNMENT_SUBMIT],
  [ROLES.STUDENT]: [P.TIMETABLE_VIEW, P.ASSIGNMENT_SUBMIT],
};

// Chức danh nào được tạo tài khoản với chức danh nào (trong cùng trường)
const CREATABLE_ROLES = {
  [ROLES.ADMIN]: ALL_ROLES,
  [ROLES.SCHOOL_ADMIN]: [
    ROLES.PRINCIPAL,
    ROLES.HOMEROOM_TEACHER,
    ROLES.TEACHER,
    ROLES.RED_FLAG,
    ROLES.YOUTH_UNION,
    ROLES.STUDENT,
  ],
  [ROLES.HOMEROOM_TEACHER]: [ROLES.STUDENT],
};

// Các chức danh bắt buộc phải gắn với 1 lớp
const ROLES_WITH_CLASS = [ROLES.HOMEROOM_TEACHER, ROLES.STUDENT, ROLES.RED_FLAG];

function permissionsOf(role) {
  return ROLE_PERMISSIONS[role] || [];
}

function hasPermission(role, permission) {
  return permissionsOf(role).includes(permission);
}

function creatableRolesOf(role) {
  return CREATABLE_ROLES[role] || [];
}

module.exports = {
  ROLES,
  ALL_ROLES,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  ROLES_WITH_CLASS,
  permissionsOf,
  hasPermission,
  creatableRolesOf,
};
