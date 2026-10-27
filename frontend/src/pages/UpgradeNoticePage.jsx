// pages/UpgradeNoticePage.jsx
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { formatVipUntil, isLearner } from "../utils/permissions";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  CalendarDays,
  ClipboardCheck,
  Crown,
  Hourglass,
  Lock,
  MessageCircle,
  Phone,
  Shuffle,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";

const PHONE = "0344344844";
const OWNER_NAME = "Ngọc Văn Giang";
const ZALO_LINK = `https://zalo.me/${PHONE}`;

const LOCKED_FEATURES = [
  [CalendarDays, "Xếp thời khóa biểu"],
  [ClipboardCheck, "Giao bài & tự chấm"],
  [Sparkles, "Tạo đề & giáo án AI"],
  [Shuffle, "Trộn đề kiểm tra"],
  [Trophy, "Thi đua & nề nếp"],
  [Bell, "Thông báo nội bộ"],
  [Users, "Tài khoản giáo viên, học sinh"],
];

/* reason = "vip"        : trường chưa có / hết hạn VIP — khóa toàn bộ chức năng
 * reason = "permission" : trường có VIP nhưng chức danh không được dùng chức năng này */
export default function UpgradeNoticePage({ reason = "vip" }) {
  const { user } = useAuth();
  const expired = !!user?.vipUntil && !user.isVip;
  const learner = isLearner(user);

  if (reason === "permission") {
    return (
      <div className="page">
        <div className="upgrade-card">
          <div className="upgrade-icon">
            <Lock size={28} />
          </div>
          <h2>Chức danh của bạn chưa dùng được chức năng này</h2>
          <p className="hint">
            Chỉ <strong>Tài khoản trường</strong> hoặc <strong>Ban giám hiệu</strong> được tạo và sắp xếp thời khóa biểu.
            Liên hệ tài khoản trường nếu cần cấp quyền.
          </p>
          <Link className="btn btn-light" to="/">
            <ArrowLeft size={16} /> Về trang chủ
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="upgrade-card upgrade-lock">
        <div className="upgrade-badge">
          <Crown size={14} /> SchoolHub VIP
        </div>
        <div className="upgrade-icon">{expired ? <Hourglass size={28} /> : <Lock size={28} />}</div>
        <h2>{expired ? "Gói VIP của trường đã hết hạn" : "Trường chưa kích hoạt VIP"}</h2>
        <p className="hint">
          {expired ? (
            <>
              VIP của <strong>{user?.school?.name || "trường"}</strong> đã hết hạn ngày{" "}
              <strong>{formatVipUntil(user.vipUntil)}</strong>. Toàn bộ chức năng tạm khóa — dữ liệu của trường vẫn được giữ
              nguyên và mở lại ngay khi gia hạn.
            </>
          ) : (
            <>
              Mọi chức năng của <strong>{user?.school?.name || "trường"}</strong> sẽ được mở khi trường kích hoạt gói{" "}
              <strong>VIP</strong>.
            </>
          )}{" "}
          {learner ? "Em hãy báo với thầy cô hoặc nhà trường." : "Liên hệ theo thông tin bên dưới để được kích hoạt."}
        </p>

        <ul className="upgrade-features">
          {LOCKED_FEATURES.map(([Icon, label]) => (
            <li key={label}>
              <Icon size={16} />
              {label}
              <Lock size={12} className="upgrade-lock-icon" />
            </li>
          ))}
        </ul>

        {!learner && (
          <>
            <div className="upgrade-contact">
              <span className="upgrade-avatar">NVG</span>
              <div>
                <span>Người phụ trách</span>
                <strong>{OWNER_NAME}</strong>
              </div>
              <a href={`tel:${PHONE}`}>
                <Phone size={15} /> {PHONE}
              </a>
            </div>

            <div className="btn-row contact-actions">
              <a className="btn btn-primary" href={`tel:${PHONE}`}>
                <Phone size={16} /> Gọi ngay
              </a>
              <a className="btn btn-info" href={ZALO_LINK} target="_blank" rel="noreferrer">
                <MessageCircle size={16} /> Nhắn Zalo
              </a>
              <Link className="btn btn-light" to="/lien-he">
                Xem quyền lợi VIP <ArrowRight size={16} />
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
