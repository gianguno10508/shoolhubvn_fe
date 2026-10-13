// components/guards/RequirePermission.jsx
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { hasPermission } from "../../utils/permissions";

/* Chỉ cho vào khi tài khoản có quyền `permission` (hoặc 1 trong `anyOf`) — và thuộc 1 trường nếu
 * `requireSchool` — ngược lại chuyển về `fallback`. */
export default function RequirePermission({ permission, anyOf, fallback = "/", requireSchool = false }) {
  const { user } = useAuth();
  const list = anyOf || [permission];
  if (!list.some((p) => hasPermission(user, p))) return <Navigate to={fallback} replace />;
  if (requireSchool && !user?.schoolId) return <Navigate to={fallback} replace />;
  return <Outlet />;
}
