import { Link } from "react-router-dom";

const teacherModules = [
  {
    id: "thi-dua",
    icon: "🏆",
    title: "Thi đua & Nề nếp",
    subtitle: "Quản lý nề nếp học sinh",
    description:
      "Chấm thi đua cờ đỏ, ghi nhận vi phạm, điểm cộng và theo dõi kết quả rèn luyện của từng lớp.",
    path: "/giao-vien/thi-dua",
    color: "orange",
    stats: "12 lớp đang theo dõi",
  },
  {
    id: "bai-tap",
    icon: "📝",
    title: "Bài tập & Tự chấm",
    subtitle: "Giao bài trực tuyến",
    description:
      "Tạo và giao bài tập cho học sinh. Hệ thống hỗ trợ học sinh làm bài và tự động chấm điểm.",
    path: "/giao-vien/bai-tap",
    color: "blue",
    stats: "08 bài đang hoạt động",
  },
  {
    id: "hoc-sinh",
    icon: "👥",
    title: "Quản lý học sinh",
    subtitle: "Tài khoản & danh sách",
    description:
      "Tạo tài khoản, quản lý thông tin và theo dõi danh sách học sinh thuộc các lớp phụ trách.",
    path: "/giao-vien/hoc-sinh",
    color: "green",
    stats: "356 học sinh",
  },
  {
    id: "tron-de",
    icon: "📊",
    title: "Kiểm tra & Đánh giá",
    subtitle: "Đề kiểm tra & trộn đề",
    description:
      "Tạo ngân hàng câu hỏi, thiết lập đề kiểm tra, trộn mã đề và theo dõi kết quả đánh giá.",
    path: "/giao-vien/tron-de",
    color: "purple",
    stats: "24 đề kiểm tra",
  },
];

const recentActivities = [
  {
    icon: "📝",
    title: "Bài tập Toán - Chương II",
    description: "35 học sinh đã hoàn thành",
    time: "10 phút trước",
    type: "blue",
  },
  {
    icon: "🏆",
    title: "Chấm thi đua lớp 10A1",
    description: "Đã cập nhật kết quả tuần 6",
    time: "35 phút trước",
    type: "orange",
  },
  {
    icon: "📊",
    title: "Kiểm tra giữa học kỳ I",
    description: "Đã tạo 4 mã đề",
    time: "Hôm qua",
    type: "purple",
  },
  {
    icon: "👥",
    title: "Tạo tài khoản học sinh",
    description: "Đã tạo 32 tài khoản mới",
    time: "Hôm qua",
    type: "green",
  },
];

const quickActions = [
  {
    icon: "➕",
    title: "Giao bài mới",
    path: "/giao-vien/bai-tap",
  },
  {
    icon: "🏆",
    title: "Chấm thi đua",
    path: "/giao-vien/thi-dua",
  },
  {
    icon: "👤",
    title: "Tạo tài khoản",
    path: "/giao-vien/hoc-sinh",
  },
  {
    icon: "📄",
    title: "Tạo đề kiểm tra",
    path: "/giao-vien/tron-de",
  },
];

export default function TeacherPage() {
  return (
    <div className="teacher-dashboard">
      {/* =====================================================
          SIDEBAR
      ===================================================== */}

      <aside className="teacher-sidebar">
        <div className="teacher-logo">
          <div className="teacher-logo-mark">🎓</div>

          <div className="teacher-logo-text">
            <strong>Teacher Portal</strong>
            <span>Hệ thống giáo viên</span>
          </div>
        </div>

        <div className="teacher-menu-title">MENU CHÍNH</div>

        <nav className="teacher-nav">
          <Link to="/giao-vien" className="teacher-nav-item active">
            <span className="teacher-nav-icon">🏠</span>

            <span>Tổng quan</span>
          </Link>

          <Link to="/teacher/thi-dua" className="teacher-nav-item">
            <span className="teacher-nav-icon">🏆</span>

            <span>Thi đua & Nề nếp</span>
          </Link>

          <Link to="/giao-vien/bai-tap" className="teacher-nav-item">
            <span className="teacher-nav-icon">📝</span>

            <span>Bài tập & Tự chấm</span>
          </Link>

          <Link to="/giao-vien/hoc-sinh" className="teacher-nav-item">
            <span className="teacher-nav-icon">👥</span>

            <span>Quản lý học sinh</span>
          </Link>

          <Link to="/giao-vien/tron-de" className="teacher-nav-item">
            <span className="teacher-nav-icon">📊</span>

            <span>Kiểm tra & Đánh giá</span>
          </Link>
        </nav>

        <div className="teacher-menu-title teacher-menu-title-bottom">
          HỆ THỐNG
        </div>

        <nav className="teacher-nav">
          <a href="#huong-dan" className="teacher-nav-item">
            <span className="teacher-nav-icon">💡</span>

            <span>Hướng dẫn sử dụng</span>
          </a>

          <a href="#tro-giup" className="teacher-nav-item">
            <span className="teacher-nav-icon">❓</span>

            <span>Trợ giúp</span>
          </a>
        </nav>

        <div className="teacher-sidebar-footer">
          <Link to="/" className="teacher-home-link">
            ← Về trang chính
          </Link>
        </div>
      </aside>

      {/* =====================================================
          MAIN CONTENT
      ===================================================== */}

      <main className="teacher-main">
        <div className="teacher-container">
          {/* TOP BAR */}

          <header className="teacher-topbar">
            <div>
              <span className="teacher-breadcrumb">
                Teacher Portal / Tổng quan
              </span>

              <h1>Xin chào, Thầy/Cô 👋</h1>

              <p>Chào mừng đến với không gian quản lý giảng dạy.</p>
            </div>

            <div className="teacher-user">
              <div className="teacher-user-avatar">GV</div>

              <div className="teacher-user-info">
                <strong>Nguyễn Văn Giáo</strong>

                <span>Giáo viên</span>
              </div>

              <button className="teacher-user-more">⋮</button>
            </div>
          </header>

          {/* SEMESTER BANNER */}

          <section className="teacher-banner">
            <div className="teacher-banner-content">
              <span className="teacher-banner-label">NĂM HỌC 2025 - 2026</span>

              <h2>Quản lý giảng dạy hiệu quả hơn</h2>

              <p>
                Tập trung quản lý học sinh, giao bài, kiểm tra và theo dõi nề
                nếp trong một hệ thống.
              </p>
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
            <div className="teacher-overview-card">
              <div className="overview-icon blue">👥</div>

              <div className="overview-content">
                <span>Học sinh</span>
                <strong>356</strong>
                <small>
                  <b>+12</b> trong tháng này
                </small>
              </div>
            </div>

            <div className="teacher-overview-card">
              <div className="overview-icon orange">📝</div>

              <div className="overview-content">
                <span>Bài tập</span>
                <strong>18</strong>
                <small>
                  <b>08</b> đang hoạt động
                </small>
              </div>
            </div>

            <div className="teacher-overview-card">
              <div className="overview-icon purple">📊</div>

              <div className="overview-content">
                <span>Bài kiểm tra</span>
                <strong>24</strong>
                <small>
                  <b>04</b> trong tháng này
                </small>
              </div>
            </div>

            <div className="teacher-overview-card">
              <div className="overview-icon green">🏆</div>

              <div className="overview-content">
                <span>Thi đua</span>
                <strong>12</strong>
                <small>lớp đang theo dõi</small>
              </div>
            </div>
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
              {teacherModules.map((module) => (
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

                  <p>Những hoạt động mới nhất của Thầy/Cô</p>
                </div>

                <button>Xem tất cả</button>
              </div>

              <div className="teacher-activities">
                {recentActivities.map((activity, index) => (
                  <div className="teacher-activity" key={index}>
                    <div className={`activity-icon ${activity.type}`}>
                      {activity.icon}
                    </div>

                    <div className="activity-content">
                      <strong>{activity.title}</strong>

                      <span>{activity.description}</span>
                    </div>

                    <time>{activity.time}</time>
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
