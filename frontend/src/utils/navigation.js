// utils/navigation.js — menu chính theo chức danh
import {
  Bell,
  BookOpenCheck,
  CalendarDays,
  ClipboardCheck,
  Dices,
  LayoutDashboard,
  MessageCircleQuestion,
  ShieldCheck,
  Shuffle,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import {
  canAccessDiscipline,
  canAccessSchoolUsers,
  canManageAssignments,
  canMakeLessonPlans,
  canManageTimetables,
  hasPermission,
  isAdmin,
  isLearner,
} from "./permissions";

/** Trả về các nhóm menu: [{ title, items: [{ to, label, icon (component lucide), end?, badge? }] }] */
export function buildNav(user) {
  if (!user) return [];
  const hasSchool = !!user.schoolId;

  if (isLearner(user)) {
    return [
      {
        title: "Học tập",
        items: [{ to: "/bai-tap", label: "Bài tập", icon: BookOpenCheck }],
      },
      { title: "Liên lạc", items: [{ to: "/thong-bao", label: "Thông báo", icon: Bell, badge: "unread" }] },
      { title: "Hỗ trợ", items: [{ to: "/lien-he", label: "Liên hệ", icon: MessageCircleQuestion }] },
    ];
  }

  const groups = [
    {
      title: "Tổng quan",
      items: [...(hasSchool ? [{ to: "/giao-vien", label: "Trang chủ", icon: LayoutDashboard, end: true }] : [])],
    },
    {
      title: "Giảng dạy",
      items: [
        ...(canManageTimetables(user) || isAdmin(user) ? [{ to: "/tkb", label: "Thời khóa biểu", icon: CalendarDays }] : []),
        ...(hasSchool && canManageAssignments(user) ? [{ to: "/giao-vien/bai-tap", label: "Bài tập & Tự chấm", icon: ClipboardCheck }] : []),
        ...(hasPermission(user, "exam.manage") ? [{ to: "/giao-vien/tron-de", label: "Trộn đề kiểm tra", icon: Shuffle }] : []),
        ...(canManageAssignments(user) ? [{ to: "/giao-vien/goi-ten", label: "Gọi tên ngẫu nhiên", icon: Dices }] : []),
        ...(canMakeLessonPlans(user) ? [{ to: "/giao-vien/giao-an", label: "Giáo án AI", icon: Sparkles }] : []),
        ...(hasSchool && canAccessDiscipline(user) ? [{ to: "/thi-dua", label: "Thi đua & Nề nếp", icon: Trophy }] : []),
      ],
    },
    {
      title: "Liên lạc",
      items: hasSchool ? [{ to: "/thong-bao", label: "Thông báo", icon: Bell, badge: "unread" }] : [],
    },
    {
      title: "Quản lý",
      items: [
        ...(canAccessSchoolUsers(user) ? [{ to: "/truong/tai-khoan", label: "Tài khoản trường", icon: Users }] : []),
        ...(isAdmin(user) ? [{ to: "/admin/users", label: "Quản trị hệ thống", icon: ShieldCheck }] : []),
      ],
    },
    { title: "Hỗ trợ", items: [{ to: "/lien-he", label: "Liên hệ & nâng cấp", icon: MessageCircleQuestion }] },
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
    [/^\/giao-vien\/goi-ten/, "Gọi tên ngẫu nhiên"],
    [/^\/giao-vien\/giao-an/, "Giáo án AI"],
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
