// pages/ContactPage.jsx
const PHONE = "0344344844";
const OWNER_NAME = "Ngọc Văn Giang";
const ZALO_LINK = `https://zalo.me/${PHONE}`;

export default function ContactPage() {
  return (
    <div className="page">
      <div className="page-head">
        <h2>Liên hệ</h2>
      </div>

      <div className="contact-card">
        <p className="contact-intro">
          Nhận thiết kế <strong>Website, ứng dụng theo yêu cầu</strong> — bao
          gồm cả hệ thống thời khóa biểu này. Nếu bạn muốn{" "}
          <strong>nâng cấp tài khoản lên VIP</strong> để sử dụng đầy đủ tính
          năng xếp thời khóa biểu, vui lòng liên hệ trực tiếp theo thông tin bên
          dưới.
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
        </div>
      </div>
    </div>
  );
}
