// utils/navigation.js — menu chính theo chức danh
import {
  canAccessDiscipline,
  canAccessSchoolUsers,
  canManageAssignments,
  canManageTimetables,
  hasPermission,
  isAdmin,
  isLearner,
} from "./permissions";

/** Trả về các nhóm menu: [{ title, items: [{ to, label, icon, end?, badge? }] }] */
export function buildNav(user) {
  if (!user) return [];
  const hasSchool = !!user.schoolId;

  if (isLearner(user)) {
    return [
      {
        title: "Học tập",
        items: [
          { to: "/bai-tap", label: "Bài tập", icon: "📚" },
          ...(canAccessDiscipline(user) ? [{ to: "/thi-dua", label: "Chấm thi đua", icon: "🏆" }] : []),
        ],
      },
      { title: "Liên lạc", items: [{ to: "/thong-bao", label: "Thông báo", icon: "🔔", badge: "unread" }] },
      { title: "Hỗ trợ", items: [{ to: "/lien-he", label: "Liên hệ", icon: "💬" }] },
    ];
  }

  const groups = [
    {
      title: "Tổng quan",
      items: [...(hasSchool ? [{ to: "/giao-vien", label: "Trang chủ", icon: "🏠", end: true }] : [])],
    },
    {
      title: "Giảng dạy",
      items: [
        ...(canManageTimetables(user) || isAdmin(user) ? [{ to: "/tkb", label: "Thời khóa biểu", icon: "🗓️" }] : []),
        ...(hasSchool && canManageAssignments(user) ? [{ to: "/giao-vien/bai-tap", label: "Bài tập & Tự chấm", icon: "📝" }] : []),
        ...(hasPermission(user, "exam.manage") ? [{ to: "/giao-vien/tron-de", label: "Trộn đề kiểm tra", icon: "🔀" }] : []),
        ...(hasSchool && canAccessDiscipline(user) ? [{ to: "/thi-dua", label: "Thi đua & Nề nếp", icon: "🏆" }] : []),
      ],
    },
    {
      title: "Liên lạc",
      items: hasSchool ? [{ to: "/thong-bao", label: "Thông báo", icon: "🔔", badge: "unread" }] : [],
    },
    {
      title: "Quản lý",
      items: [
        ...(canAccessSchoolUsers(user) ? [{ to: "/truong/tai-khoan", label: "Tài khoản trường", icon: "👥" }] : []),
        ...(isAdmin(user) ? [{ to: "/admin/users", label: "Quản trị hệ thống", icon: "🛡️" }] : []),
      ],
    },
    { title: "Hỗ trợ", items: [{ to: "/lien-he", label: "Liên hệ & nâng cấp", icon: "💬" }] },
  ];
  return groups.filter((g) => g.items.length);
}

/** Tiêu đề trang hiển thị trên thanh trên cùng */
export function pageTitle(pathname) {
  const rules = [
    [/^\/tkb\/.+/, "Soạn thời khóa biểu"],
    [/^\/tkb/, "Thời khóa biểu"],
    [/^\/giao-vien\/bai-tap\/moi/, "Giao bài tập mới"],
    [/^\/giao-vien\/bai-tap\/.+/, "Kết quả bài tập"],
    [/^\/giao-vien\/bai-tap/, "Bài tập & Tự chấm"],
    [/^\/giao-vien\/tron-de/, "Trộn đề kiểm tra"],
    [/^\/giao-vien/, "Trang chủ"],
    [/^\/bai-tap\/ket-qua/, "Kết quả bài làm"],
    [/^\/bai-tap/, "Bài tập"],
    [/^\/thi-dua/, "Thi đua & Nề nếp"],
    [/^\/thong-bao/, "Thông báo"],
    [/^\/truong\/tai-khoan/, "Tài khoản trường"],
    [/^\/admin/, "Quản trị hệ thống"],
    [/^\/lien-he/, "Liên hệ & nâng cấp"],
    [/^\/ca-nhan/, "Thông tin cá nhân"],
  ];
  const hit = rules.find(([re]) => re.test(pathname));
  return hit ? hit[1] : "";
}
