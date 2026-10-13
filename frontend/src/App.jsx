// App.jsx
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import LoginRegister from "./components/auth/LoginRegister";
import RequireTimetableAccess from "./components/guards/RequireTimetableAccess";
import RequireAdmin from "./components/guards/RequireAdmin";
import RequireSchoolUsersAccess from "./components/guards/RequireSchoolUsersAccess";
import HomeLayout from "./pages/HomeLayout";
import TimetableListPage from "./pages/TimetableListPage";
import TimetableEditorPage from "./pages/TimetableEditorPage";
import TeacherPage from "./pages/TeacherPage";
import ContactPage from "./pages/ContactPage";
import AdminUsersPage from "./pages/admin/AdminUsersPage";
import SchoolUsersPage from "./pages/school/SchoolUsersPage";
import ShuffleExamPage from "./pages/teacher/ShuffleExamPage";
import RequirePermission from "./components/guards/RequirePermission";
import RequireVip from "./components/guards/RequireVip";
import AssignmentListPage from "./pages/assignments/AssignmentListPage";
import AssignmentCreatePage from "./pages/assignments/AssignmentCreatePage";
import AssignmentResultPage from "./pages/assignments/AssignmentResultPage";
import StudentAssignmentsPage from "./pages/assignments/StudentAssignmentsPage";
import TakeAssignmentPage from "./pages/assignments/TakeAssignmentPage";
import SubmissionResultPage from "./pages/assignments/SubmissionResultPage";
import DisciplinePage from "./pages/discipline/DisciplinePage";
import NotificationsPage from "./pages/notifications/NotificationsPage";
import { homePath } from "./utils/permissions";

export default function App() {
  const { token, user, loading } = useAuth();

  if (loading) {
    return (
      <div className="tkb-root">
        <div className="center-screen">Đang kiểm tra đăng nhập...</div>
      </div>
    );
  }

  // Chưa đăng nhập: chỉ có màn hình đăng nhập / đăng ký
  if (!token) {
    return (
      <div className="tkb-root">
        <LoginRegister />
      </div>
    );
  }

  // Đăng nhập xong: vào trang chủ (mặc định là mục Thời khóa biểu)
  return (
    <Routes>
      {/* Làm bài: toàn màn hình, không có menu để học sinh tập trung */}
      <Route element={<RequireVip />}>
        <Route element={<RequirePermission permission="assignment.submit" fallback="/tkb" />}>
          <Route path="bai-tap/:id" element={<div className="tkb-root"><TakeAssignmentPage /></div>} />
        </Route>
      </Route>

      <Route element={<HomeLayout />}>
        <Route index element={<Navigate to={homePath(user)} replace />} />
        <Route path="lien-he" element={<ContactPage />} />

        {/* Mọi chức năng bên dưới cần trường còn hạn VIP */}
        <Route element={<RequireVip />}>

          {/* Chỉ admin hoặc VIP còn hạn mới vào được các trang xếp thời khóa biểu */}
          <Route element={<RequireTimetableAccess />}>
            <Route path="tkb" element={<TimetableListPage />} />
            <Route path="tkb/:id" element={<TimetableEditorPage />} />
          </Route>

          <Route path="giao-vien" element={<TeacherPage />} />
          <Route path="giao-vien/tron-de" element={<ShuffleExamPage />} />

          {/* Bài tập & Tự chấm — người giao bài: mọi chức danh trừ học sinh / cờ đỏ */}
          <Route element={<RequirePermission permission="assignment.manage" fallback="/bai-tap" requireSchool />}>
            <Route path="giao-vien/bai-tap" element={<AssignmentListPage />} />
            <Route path="giao-vien/bai-tap/moi" element={<AssignmentCreatePage />} />
            <Route path="giao-vien/bai-tap/:id" element={<AssignmentResultPage />} />
          </Route>

          {/* Thi đua & Nề nếp: xem (GVCN, BGH), chấm (cờ đỏ, Đoàn TN), cấu hình (Đoàn TN) */}
          <Route
            element={<RequirePermission anyOf={["discipline.view", "discipline.score", "discipline.config"]} fallback="/" requireSchool />}
          >
            <Route path="thi-dua" element={<DisciplinePage />} />
          </Route>

          {/* Thông báo: mọi tài khoản thuộc trường */}
          <Route path="thong-bao" element={<NotificationsPage />} />

          {/* Học sinh / cờ đỏ làm bài */}
          <Route element={<RequirePermission permission="assignment.submit" fallback="/tkb" />}>
            <Route path="bai-tap" element={<StudentAssignmentsPage />} />
            <Route path="bai-tap/ket-qua/:sid" element={<SubmissionResultPage />} />
          </Route>

          {/* Tài khoản trường / BGH / GVCN: quản lý tài khoản trong trường */}
          <Route element={<RequireSchoolUsersAccess />}>
            <Route path="truong/tai-khoan" element={<SchoolUsersPage />} />
          </Route>

          {/* Chỉ admin mới vào được trang quản lý tài khoản */}
          <Route element={<RequireAdmin />}>
            <Route path="admin/users" element={<AdminUsersPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to={homePath(user)} replace />} />
      </Route>
    </Routes>
  );
}
