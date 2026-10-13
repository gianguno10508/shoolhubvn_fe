// pages/UpgradeNoticePage.jsx
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { formatVipUntil, isLearner } from "../utils/permissions";

const PHONE = "0344344844";
const OWNER_NAME = "Ngọc Văn Giang";
const ZALO_LINK = `https://zalo.me/${PHONE}`;

const LOCKED_FEATURES = [
  ["🗓️", "Xếp thời khóa biểu"],
  ["📝", "Giao bài & tự chấm"],
  ["🏆", "Thi đua & nề nếp"],
  ["🔔", "Thông báo nội bộ"],
  ["👥", "Tài khoản giáo viên, học sinh"],
  ["🔀", "Trộn đề kiểm tra"],
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
          <div className="upgrade-icon">🔒</div>
          <h2>Chức danh của bạn chưa dùng được chức năng này</h2>
          <p className="hint">
            Chỉ <strong>Tài khoản trường</strong> hoặc <strong>Ban giám hiệu</strong> được tạo và sắp xếp thời khóa biểu.
            Liên hệ tài khoản trường nếu cần cấp quyền.
          </p>
          <Link className="btn btn-light" to="/">
            ← Về trang chủ
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="upgrade-card upgrade-lock">
        <div className="upgrade-icon">{expired ? "⏳" : "🔒"}</div>
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
          {LOCKED_FEATURES.map(([icon, label]) => (
            <li key={label}>
              <span>{icon}</span>
              {label}
            </li>
          ))}
        </ul>

        {!learner && (
          <>
            <div className="contact-info">
              <div className="contact-row">
                <span className="contact-label">Người phụ trách</span>
                <span className="contact-value">{OWNER_NAME}</span>
              </div>
              <div className="contact-row">
                <span className="contact-label">Điện thoại / Zalo</span>
                <a className="contact-value contact-link" href={`tel:${PHONE}`}>
                  {PHONE}
                </a>
              </div>
            </div>

            <div className="btn-row contact-actions">
              <a className="btn btn-primary" href={`tel:${PHONE}`}>
                📞 Gọi {PHONE}
              </a>
              <a className="btn btn-info" href={ZALO_LINK} target="_blank" rel="noreferrer">
                💬 Nhắn Zalo
              </a>
              <Link className="btn btn-light" to="/lien-he">
                Xem bảng giá & liên hệ
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
