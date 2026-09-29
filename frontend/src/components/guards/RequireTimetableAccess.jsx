// components/guards/RequireTimetableAccess.jsx
import { Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { canManageTimetables } from "../../utils/permissions";
import UpgradeNotice from "../../pages/UpgradeNoticePage";

/* Chỉ admin hoặc tài khoản đang còn hạn VIP mới vào được mục Thời khóa biểu.
 * Không đủ quyền thì hiện luôn hướng dẫn liên hệ nâng cấp, thay vì chuyển trang. */
export default function RequireTimetableAccess() {
  const { user } = useAuth();
  if (!canManageTimetables(user)) return <UpgradeNotice />;
  return <Outlet />;
}
