// pages/UpgradeNoticePage.jsx
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { formatVipUntil } from "../utils/permissions";

const PHONE = "0344344844";
const OWNER_NAME = "Ngọc Văn Giang";
const ZALO_LINK = `https://zalo.me/${PHONE}`;

export default function UpgradeNoticePage() {
  const { user } = useAuth();
  const expired = user?.vipUntil && !user.isVip;

  return (
    <div className="page">
      <div className="upgrade-card">
        <div className="upgrade-icon">🔒</div>
        <h2>
          {expired
            ? "Gói VIP của bạn đã hết hạn"
            : "Tài khoản của bạn chưa có quyền xếp thời khóa biểu"}
        </h2>
        <p className="hint">
          {expired ? (
            <>
              VIP đã hết hạn từ ngày{" "}
              <strong>{formatVipUntil(user.vipUntil)}</strong>. Vui lòng liên hệ
              để gia hạn.
            </>
          ) : (
            <>
              Chỉ tài khoản <strong>Admin</strong> hoặc <strong>VIP</strong> còn
              hạn mới được tạo và sắp xếp thời khóa biểu.
            </>
          )}{" "}
          Liên hệ theo thông tin bên dưới để được nâng cấp.
        </p>

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
          <a
            className="btn btn-info"
            href={ZALO_LINK}
            target="_blank"
            rel="noreferrer"
          >
            💬 Nhắn Zalo
          </a>
          <Link className="btn" to="/lien-he">
            Xem trang Liên hệ
          </Link>
        </div>
      </div>
    </div>
  );
}
