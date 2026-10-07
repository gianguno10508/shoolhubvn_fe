// App.jsx
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import LoginRegister from "./components/auth/LoginRegister";
import RequireTimetableAccess from "./components/guards/RequireTimetableAccess";
import RequireAdmin from "./components/guards/RequireAdmin";
import HomeLayout from "./pages/HomeLayout";
import TimetableListPage from "./pages/TimetableListPage";
import TimetableEditorPage from "./pages/TimetableEditorPage";
import TeacherPage from "./pages/TeacherPage";
import ContactPage from "./pages/ContactPage";
import AdminUsersPage from "./pages/admin/AdminUsersPage";
import ShuffleExamPage from "./pages/teacher/ShuffleExamPage";
import AssignmentPage from "./pages/teacher/AssignmentPage";
import CompetitionDisciplinePage from "./pages/teacher/CompetitionDisciplinePage";

export default function App() {
  const { token, loading } = useAuth();

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
      <Route element={<HomeLayout />}>
        <Route index element={<Navigate to="/tkb" replace />} />

        {/* Chỉ admin hoặc VIP còn hạn mới vào được các trang xếp thời khóa biểu */}
        <Route element={<RequireTimetableAccess />}>
          <Route path="tkb" element={<TimetableListPage />} />
          <Route path="tkb/:id" element={<TimetableEditorPage />} />
        </Route>

        <Route path="giao-vien" element={<TeacherPage />} />
        <Route path="giao-vien/tron-de" element={<ShuffleExamPage />} />
        <Route path="giao-vien/bai-tap" element={<AssignmentPage />} />
        <Route
          path="giao-vien/thi-dua"
          element={<CompetitionDisciplinePage />}
        />
        <Route path="lien-he" element={<ContactPage />} />

        {/* Chỉ admin mới vào được trang quản lý tài khoản */}
        <Route element={<RequireAdmin />}>
          <Route path="admin/users" element={<AdminUsersPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/tkb" replace />} />
      </Route>
    </Routes>
  );
}
