import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import LoginRegister from "./components/auth/LoginRegister";
import HomeLayout from "./pages/HomeLayout";
import TimetableListPage from "./pages/TimetableListPage";
import TimetableEditorPage from "./pages/TimetableEditorPage";
import TeacherPage from "./pages/TeacherPage";
import ContactPage from "./pages/ContactPage";

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
        <Route path="tkb" element={<TimetableListPage />} />
        <Route path="tkb/:id" element={<TimetableEditorPage />} />
        <Route path="giao-vien" element={<TeacherPage />} />
        <Route path="lien-he" element={<ContactPage />} />
        <Route path="*" element={<Navigate to="/tkb" replace />} />
      </Route>
    </Routes>
  );
}
