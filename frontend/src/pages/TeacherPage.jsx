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
  canManageAssignments,
  hasPermission,
} from "../utils/permissions";
import { timeAgo } from "../utils/time";

const canSendNotice = (user) =>
  hasPermission(user, "notification.send_school") || hasPermission(user, "notification.send_class");

const hasSchoolLessonPlans = (user) =>
  !!user?.schoolId && (hasPermission(user, "exam.manage") || hasPermission(user, "assignment.manage"));

const pad2 = (n) => String(n ?? 0).padStart(2, "0");

/** Các mục chức năng + số liệu lấy từ server; ẩn mục mà chức danh không dùng được */
function buildModules(user, d, unread) {
  const disc = d?.discipline;
  return [
    canAccessDiscipline(user) && {
      id: "thi-dua",
      icon: "🏆",
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
      icon: "📝",
      title: "Bài tập & Tự chấm",
      subtitle: "Giao bài trực tuyến",
      description: "Giao bài trắc nghiệm từ file PDF. Học sinh làm bài trực tuyến và được hệ thống chấm điểm tự động.",
      path: "/giao-vien/bai-tap",
      color: "blue",
      stats: d ? `${pad2(d.assignments.active)} bài đang mở · ${d.assignments.submissionsThisWeek} lượt nộp tuần này` : "…",
    },
    hasSchoolLessonPlans(user) && {
      id: "giao-an",
      icon: "📖",
      title: "Giáo án AI",
      subtitle: "Soạn giáo án từ ảnh SGK",
      description: "Chụp ảnh các trang sách giáo khoa, AI soạn kế hoạch bài dạy theo mẫu Công văn 5512. Sửa và xuất Word.",
      path: "/giao-vien/giao-an",
      color: "orange",
      stats: "Miễn phí · xuất file Word",
    },
    canAccessSchoolUsers(user) && {
      id: "hoc-sinh",
      icon: "👥",
      title: "Quản lý học sinh",
      subtitle: "Tài khoản & danh sách",
      description: "Tạo tài khoản, quản lý thông tin và theo dõi danh sách học sinh thuộc các lớp phụ trách.",
      path: "/truong/tai-khoan",
      color: "green",
      stats: d ? `${d.students.count} học sinh${d.students.scope === "class" ? ` lớp ${d.user.className}` : ""}` : "…",
    },
    {
      id: "thong-bao",
      icon: "🔔",
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
      icon: "📊",
      title: "Kiểm tra & Đánh giá",
      subtitle: "Đề kiểm tra & trộn đề",
      description: "Tải đề PDF, tự động đảo câu hỏi và phương án để tạo nhiều mã đề, xuất PDF / Word / đáp án Excel.",
      path: "/giao-vien/tron-de",
      color: "purple",
      stats: "Trộn đề ngay trên trình duyệt",
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
    canManageAssignments(user) && { icon: "➕", title: "Giao bài mới", path: "/giao-vien/bai-tap/moi" },
    canAccessDiscipline(user) && { icon: "🏆", title: "Xem / chấm thi đua", path: "/thi-dua" },
    canSendNotice(user) && { icon: "📣", title: "Gửi thông báo", path: "/thong-bao" },
    canAccessSchoolUsers(user) && { icon: "👤", title: "Tạo tài khoản học sinh", path: "/truong/tai-khoan" },
    hasSchoolLessonPlans(user) && { icon: "📖", title: "Soạn giáo án AI", path: "/giao-vien/giao-an" },
    { icon: "📄", title: "Trộn đề kiểm tra", path: "/giao-vien/tron-de" },
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
              <div>🎓</div>
              <div>📚</div>
              <div>✏️</div>
            </div>
          </section>

          {/* =================================================
              STATISTICS
          ================================================= */}

          <section className="teacher-overview">
            {[
              {
                icon: "👥",
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
                icon: "📝",
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
                icon: "📥",
                color: "purple",
                label: "Lượt nộp bài",
                value: data?.assignments.submissionsThisWeek,
                sub: "trong 7 ngày qua",
              },
              myClass
                ? {
                    icon: "🏆",
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
                    icon: "🏆",
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
                <div className={`overview-icon ${s.color}`}>{s.icon}</div>
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
                    <div className="module-icon">{module.icon}</div>

                    <span className="module-arrow">↗</span>
                  </div>

                  <span className="module-subtitle">{module.subtitle}</span>

                  <h3>{module.title}</h3>

                  <p>{module.description}</p>

                  <div className="module-card-footer">
                    <span>{module.stats}</span>

                    <span className="module-open">Mở chức năng →</span>
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
                    <span className="quick-action-icon">{action.icon}</span>

                    <span>{action.title}</span>

                    <b>→</b>
                  </Link>
                ))}
              </div>
            </div>
          </section>

          {/* FOOTER INFO */}

          <div className="teacher-footer-note">
            <span>💡</span>

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
