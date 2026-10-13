// components/guards/RequireSchoolUsersAccess.jsx
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { canAccessSchoolUsers } from "../../utils/permissions";

/* Tài khoản trường, Ban giám hiệu (xem) và GVCN (học sinh lớp mình) mới vào được trang tài khoản trường. */
export default function RequireSchoolUsersAccess() {
  const { user } = useAuth();
  if (!canAccessSchoolUsers(user)) return <Navigate to="/tkb" replace />;
  return <Outlet />;
}
