// components/guards/RequireAdmin.jsx
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { isAdmin } from "../../utils/permissions";

/* Chỉ role "admin" mới vào được các trang quản trị (ví dụ Quản lý tài khoản). */
export default function RequireAdmin() {
  const { user } = useAuth();
  if (!isAdmin(user)) return <Navigate to="/tkb" replace />;
  return <Outlet />;
}
