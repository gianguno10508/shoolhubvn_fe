// pages/TeacherPage.jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getDashboard } from "../api/dashboard";
import { useAuth } from "../context/AuthContext";
import useUnreadCount from "../hooks/useUnreadCount";
import {
  ROLE_LABEL,
  canAccessDiscipline,
  canAccessSchoolUsers,
  canMakeLessonPlans,
  canManageAssignments,
  hasPermission,
} from "../utils/permissions";
import { timeAgo } from "../utils/time";
import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  ClipboardCheck,
  Dices,
  FilePlus2,
  FileSpreadsheet,
  GraduationCap,
  Inbox,
  Lightbulb,
  Megaphone,
  PencilLine,
  Shuffle,
  Sparkles,
  Trophy,
  UserPlus,
  Users,
} from "lucide-react";

const canSendNotice = (user) =>
  hasPermission(user, "notification.send_school") || hasPermission(user, "notification.send_class");

const hasSchoolLessonPlans = canMakeLessonPlans;

const pad2 = (n) => String(n ?? 0).padStart(2, "0");

/** Các mục chức năng + số liệu lấy từ server; ẩn mục mà chức danh không dùng được */
function buildModules(user, d, unread) {
  const disc = d?.discipline;
  return [
    canAccessDiscipline(user) && {
      id: "thi-dua",
      icon: Trophy,
      title: "Thi đua & Nề nếp",
      subtitle: "Quản lý nề nếp học sinh",
      description:
        "Chấm thi đua cờ đỏ, ghi nhận vi phạm, điểm cộng và theo dõi kết quả rèn luyện của từng lớp theo tuần, tháng.",
      path: "/thi-dua",
      color: "orange",
      stats: disc
        ? disc.myClass
          ? `Lớp ${disc.myClass.className}: ${disc.myClass.score} điểm · hạng ${disc.myClass.rank}/${disc.myClass.totalClasses}`
          : `${disc.classesTracked} lớp · hôm nay đã chấm ${disc.recordedToday}`
        : "…",
    },
    canManageAssignments(user) && {
      id: "bai-tap",
      icon: ClipboardCheck,
      title: "Bài tập & Tự chấm",
      subtitle: "Giao bài trực tuyến",
      description: "Giao bài trắc nghiệm từ file PDF. Học sinh làm bài trực tuyến và được hệ thống chấm điểm tự động.",
      path: "/giao-vien/bai-tap",
      color: "blue",
      stats: d ? `${pad2(d.assignments.active)} bài đang mở · ${d.assignments.submissionsThisWeek} lượt nộp tuần này` : "…",
    },
    hasSchoolLessonPlans(user) && {
      id: "giao-an",
      icon: Sparkles,
      title: "Giáo án AI",
      subtitle: "Soạn giáo án từ ảnh SGK",
      description: "Chụp ảnh các trang sách giáo khoa, AI soạn kế hoạch bài dạy theo mẫu Công văn 5512. Sửa và xuất Word.",
      path: "/giao-vien/giao-an",
      color: "orange",
      stats: "Miễn phí · xuất file Word",
    },
    canAccessSchoolUsers(user) && {
      id: "hoc-sinh",
      icon: Users,
      title: "Quản lý học sinh",
      subtitle: "Tài khoản & danh sách",
      description: "Tạo tài khoản, quản lý thông tin và theo dõi danh sách học sinh thuộc các lớp phụ trách.",
      path: "/truong/tai-khoan",
      color: "green",
      stats: d ? `${d.students.count} học sinh${d.students.scope === "class" ? ` lớp ${d.user.className}` : ""}` : "…",
    },
    {
      id: "thong-bao",
      icon: Bell,
      title: "Thông báo",
      subtitle: "Nhắn tin nội bộ",
      description: canSendNotice(user)
        ? "Gửi thông báo đến giáo viên, học sinh theo trường, chức danh hoặc lớp. Theo dõi số người đã đọc."
        : "Nhận thông báo từ Ban giám hiệu, Đoàn trường và giáo viên chủ nhiệm.",
      path: "/thong-bao",
      color: "teal",
      stats: unread ? `${unread} thông báo chưa đọc` : "Không có thông báo mới",
    },
    {
      id: "tron-de",
      icon: FileSpreadsheet,
      title: "Kiểm tra & Đánh giá",
      subtitle: "Đề kiểm tra & trộn đề",
      description: "Trộn đề PDF thành nhiều mã đề, hoặc tạo ma trận, bản đặc tả và đề kiểm tra kèm đáp án với AI.",
      path: "/giao-vien/tron-de",
      color: "purple",
      stats: "Trộn đề · Tạo đề với AI",
    },
    canManageAssignments(user) && {
      id: "goi-ten",
      icon: Dices,
      title: "Gọi tên ngẫu nhiên",
      subtitle: "Trò chơi gọi học sinh",
      description:
        "Nhập danh sách lớp rồi gọi tên bằng vòng quay may mắn, đua xe, lồng cầu xổ số, lật thẻ, bắn bóng bay... và cộng điểm ngay.",
      path: "/giao-vien/goi-ten",
      color: "teal",
      stats: "11 trò chơi · trình chiếu toàn màn hình",
    },
  ].filter(Boolean);
}

export default function TeacherPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getDashboard()
      .then(setData)
      .catch((err) => setError(err.message || "Không tải được số liệu."));
  }, []);

  const [unread] = useUnreadCount(!!user?.schoolId);
  const modules = buildModules(user, data, unread);
  const quickActions = [
    canManageAssignments(user) && { icon: FilePlus2, title: "Giao bài mới", path: "/giao-vien/bai-tap/moi" },
    canAccessDiscipline(user) && { icon: Trophy, title: "Xem / chấm thi đua", path: "/thi-dua" },
    canSendNotice(user) && { icon: Megaphone, title: "Gửi thông báo", path: "/thong-bao" },
    canAccessSchoolUsers(user) && { icon: UserPlus, title: "Tạo tài khoản học sinh", path: "/truong/tai-khoan" },
    hasSchoolLessonPlans(user) && { icon: Sparkles, title: "Soạn giáo án AI", path: "/giao-vien/giao-an" },
    hasPermission(user, "exam.manage") && { icon: Shuffle, title: "Trộn đề kiểm tra", path: "/giao-vien/tron-de" },
    canManageAssignments(user) && { icon: Dices, title: "Gọi tên ngẫu nhiên", path: "/giao-vien/goi-ten" },
  ].filter(Boolean);
  const displayName = user?.name || user?.username || "Thầy/Cô";
  const myClass = data?.discipline?.myClass;

  return (
    <div className="teacher-dashboard">


      {/* =====================================================
          MAIN CONTENT
      ===================================================== */}

      <main className="teacher-main">
        <div className="teacher-container">
          {/* TOP BAR */}

          <header className="teacher-topbar">
            <div>
              <h1>Xin chào, {displayName} 👋</h1>

              <p>
                {data
                  ? `${data.school.name} · năm học ${data.school.academicYear}`
                  : "Chào mừng đến với không gian quản lý giảng dạy."}
              </p>
            </div>

          </header>

          {/* SEMESTER BANNER */}

          <section className="teacher-banner">
            <div className="teacher-banner-content">
              <span className="teacher-banner-label">
                NĂM HỌC {data?.school.academicYear?.replace("-", " - ") || "…"}
              </span>

              <h2>
                {myClass
                  ? `Lớp ${myClass.className} đang xếp hạng ${myClass.rank}/${myClass.totalClasses} tuần này`
                  : "Quản lý giảng dạy hiệu quả hơn"}
              </h2>

              <p>
                {myClass
                  ? `Điểm thi đua tuần: ${myClass.score}/${data.discipline.basePoints} · bị trừ ${myClass.penalty} điểm.`
                  : "Tập trung quản lý học sinh, giao bài, kiểm tra và theo dõi nề nếp trong một hệ thống."}
              </p>
              {error && <p className="teacher-banner-error">⚠ {error}</p>}
            </div>

            <div className="teacher-banner-decoration">
              <div>
                <GraduationCap size={30} />
              </div>
              <div>
                <BookOpen size={30} />
              </div>
              <div>
                <PencilLine size={30} />
              </div>
            </div>
          </section>

          {/* =================================================
              STATISTICS
          ================================================= */}

          <section className="teacher-overview">
            {[
              {
                icon: Users,
                color: "blue",
                label: data?.students.scope === "class" ? `Học sinh lớp ${data.user.className}` : "Học sinh",
                value: data?.students.count,
                sub: (
                  <>
                    <b>+{data?.students.newThisMonth ?? 0}</b> trong tháng này
                  </>
                ),
              },
              {
                icon: ClipboardCheck,
                color: "orange",
                label: data?.assignments.scope === "school" ? "Bài tập toàn trường" : "Bài tập đã giao",
                value: data?.assignments.total,
                sub: (
                  <>
                    <b>{pad2(data?.assignments.active)}</b> đang mở
                  </>
                ),
              },
              {
                icon: Inbox,
                color: "purple",
                label: "Lượt nộp bài",
                value: data?.assignments.submissionsThisWeek,
                sub: "trong 7 ngày qua",
              },
              myClass
                ? {
                    icon: Trophy,
                    color: "green",
                    label: "Thi đua tuần",
                    value: myClass.score,
                    sub: (
                      <>
                        hạng <b>{myClass.rank}</b>/{myClass.totalClasses} lớp
                      </>
                    ),
                  }
                : {
                    icon: Trophy,
                    color: "green",
                    label: "Thi đua",
                    value: data?.discipline.classesTracked,
                    sub: (
                      <>
                        lớp · hôm nay chấm <b>{data?.discipline.recordedToday ?? 0}</b>
                      </>
                    ),
                  },
            ].map((s) => (
              <div className="teacher-overview-card" key={s.label}>
                <div className={`overview-icon ${s.color}`}>
                  <s.icon size={22} />
                </div>
                <div className="overview-content">
                  <span>{s.label}</span>
                  <strong>{data ? (s.value ?? 0) : "…"}</strong>
                  <small>{s.sub}</small>
                </div>
              </div>
            ))}
          </section>

          {/* =================================================
              MAIN MODULES
          ================================================= */}

          <section className="teacher-section">
            <div className="teacher-section-heading">
              <div>
                <span className="teacher-section-label">CHỨC NĂNG</span>

                <h2>Công cụ giảng dạy</h2>

                <p>Các công cụ hỗ trợ Thầy/Cô trong công việc hàng ngày.</p>
              </div>
            </div>

            <div className="teacher-module-grid">
              {modules.map((module) => (
                <Link
                  key={module.id}
                  to={module.path}
                  className={`teacher-module-card ${module.color}`}
                >
                  <div className="module-card-header">
                    <div className="module-icon">
                      <module.icon size={24} />
                    </div>

                    <span className="module-arrow">
                      <ArrowUpRight size={18} />
                    </span>
                  </div>

                  <span className="module-subtitle">{module.subtitle}</span>

                  <h3>{module.title}</h3>

                  <p>{module.description}</p>

                  <div className="module-card-footer">
                    <span>{module.stats}</span>

                    <span className="module-open">
                      Mở chức năng <ArrowRight size={14} />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* =================================================
              BOTTOM AREA
          ================================================= */}

          <section className="teacher-bottom-grid">
            {/* RECENT ACTIVITIES */}

            <div className="teacher-panel">
              <div className="teacher-panel-heading">
                <div>
                  <h2>Hoạt động gần đây</h2>

                  <p>Giao bài, học sinh nộp bài, chấm thi đua</p>
                </div>
              </div>

              <div className="teacher-activities">
                {data && data.activities.length === 0 && <p className="teacher-empty">Chưa có hoạt động nào.</p>}
                {!data && <p className="teacher-empty">Đang tải...</p>}
                {data?.activities.map((activity, index) => (
                  <div className="teacher-activity" key={index}>
                    <div className={`activity-icon ${activity.type}`}>
                      {activity.icon}
                    </div>

                    <div className="activity-content">
                      <strong>{activity.title}</strong>

                      <span>{activity.description}</span>
                    </div>

                    <time>{timeAgo(activity.time)}</time>
                  </div>
                ))}
              </div>
            </div>

            {/* QUICK ACTIONS */}

            <div className="teacher-panel quick-panel">
              <div className="teacher-panel-heading">
                <div>
                  <h2>Thao tác nhanh</h2>

                  <p>Truy cập nhanh các chức năng</p>
                </div>
              </div>

              <div className="quick-actions">
                {quickActions.map((action) => (
                  <Link
                    key={action.title}
                    to={action.path}
                    className="quick-action"
                  >
                    <span className="quick-action-icon">
                      <action.icon size={18} />
                    </span>

                    <span>{action.title}</span>

                    <ArrowRight size={16} className="quick-action-arrow" />
                  </Link>
                ))}
              </div>
            </div>
          </section>

          {/* FOOTER INFO */}

          <div className="teacher-footer-note">
            <span>
              <Lightbulb size={18} />
            </span>

            <p>
              <strong>Mẹo:</strong> Thầy/Cô có thể sử dụng các thao tác nhanh để
              truy cập trực tiếp vào những chức năng thường xuyên sử dụng.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
