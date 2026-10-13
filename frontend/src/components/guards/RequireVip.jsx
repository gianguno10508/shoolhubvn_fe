// components/guards/RequireVip.jsx
import { Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { isVipLocked } from "../../utils/permissions";
import UpgradeNoticePage from "../../pages/UpgradeNoticePage";

/* Trường chưa có / hết hạn VIP: khóa toàn bộ chức năng, hiện hướng dẫn nâng cấp thay cho nội dung trang. */
export default function RequireVip() {
  const { user } = useAuth();
  if (isVipLocked(user)) return <UpgradeNoticePage reason="vip" />;
  return <Outlet />;
}
