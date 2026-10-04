// pages/ContactPage.jsx

const PHONE = "0344344844";
const OWNER_NAME = "Ngọc Văn Giang";
const ZALO_LINK = `https://zalo.me/${PHONE}`;

const vipFeatures = [
  {
    icon: "📅",
    title: "Xếp thời khóa biểu đầy đủ",
    description: "Sử dụng đầy đủ các chức năng hỗ trợ xếp thời khóa biểu.",
  },
  {
    icon: "⚡",
    title: "Tối ưu công việc",
    description:
      "Giảm thời gian thao tác và thuận tiện hơn trong quá trình sử dụng.",
  },
  {
    icon: "🔓",
    title: "Mở khóa tính năng VIP",
    description:
      "Truy cập các tính năng nâng cao dành riêng cho tài khoản VIP.",
  },
  {
    icon: "🛠️",
    title: "Hỗ trợ sử dụng",
    description: "Được hỗ trợ khi cần kích hoạt và sử dụng hệ thống.",
  },
];

const services = [
  {
    icon: "🌐",
    title: "Website",
    description:
      "Thiết kế website, hệ thống quản lý và các nền tảng web theo yêu cầu.",
  },
  {
    icon: "📱",
    title: "App",
    description: "Phát triển ứng dụng phù hợp với nhu cầu sử dụng thực tế.",
  },
  {
    icon: "⚙️",
    title: "Tool",
    description: "Xây dựng công cụ hỗ trợ công việc, quản lý và tự động hóa.",
  },
];

export default function ContactPage() {
  return (
    <div className="page contact-page">
      {/* =========================================
          PAGE HEADER
      ========================================= */}
      <div className="page-head contact-head">
        <div>
          <span className="contact-eyebrow">HỖ TRỢ & NÂNG CẤP TÀI KHOẢN</span>

          <h2>Liên hệ</h2>

          <p>
            Cần hỗ trợ hoặc muốn sử dụng đầy đủ các tính năng của hệ thống? Hãy
            liên hệ trực tiếp để được tư vấn và nâng cấp tài khoản.
          </p>
        </div>
      </div>

      {/* =========================================
          VIP HERO
      ========================================= */}
      <section className="vip-hero">
        <div className="vip-hero-content">
          <div className="vip-tag">
            <span>★</span>
            TÀI KHOẢN VIP
          </div>

          <h1>
            Nâng cấp lên
            <span> VIP</span>
          </h1>

          <h2>
            Mở khóa đầy đủ tính năng
            <br />
            của hệ thống thời khóa biểu
          </h2>

          <p>
            Tài khoản VIP giúp bạn sử dụng đầy đủ các chức năng nâng cao của hệ
            thống, hỗ trợ quá trình xếp và quản lý thời khóa biểu thuận tiện,
            nhanh chóng và hiệu quả hơn.
          </p>

          <div className="vip-buttons">
            <a
              href={ZALO_LINK}
              target="_blank"
              rel="noreferrer"
              className="vip-primary-btn"
            >
              💬 Liên hệ nâng cấp VIP
            </a>

            <a href={`tel:${PHONE}`} className="vip-secondary-btn">
              📞 {PHONE}
            </a>
          </div>

          <div className="vip-note">
            <span>✓</span>
            Liên hệ trực tiếp để được tư vấn và kích hoạt tài khoản
          </div>
        </div>

        {/* VIP visual */}
        <div className="vip-visual">
          <div className="vip-glow"></div>

          <div className="vip-card">
            <div className="vip-card-top">
              <span>PREMIUM ACCOUNT</span>
              <span className="vip-star">★</span>
            </div>

            <div className="vip-card-title">VIP</div>

            <div className="vip-card-line"></div>

            <div className="vip-card-bottom">
              <span>THỜI KHÓA BIỂU</span>
              <strong>UNLOCKED</strong>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================
          VIP FEATURES
      ========================================= */}
      <section className="contact-section">
        <div className="section-heading">
          <span>QUYỀN LỢI VIP</span>

          <h3>Tại sao nên nâng cấp tài khoản?</h3>

          <p>
            Tài khoản VIP được thiết kế dành cho người dùng cần khai thác đầy đủ
            khả năng của hệ thống.
          </p>
        </div>

        <div className="vip-feature-grid">
          {vipFeatures.map((item) => (
            <div className="vip-feature-card" key={item.title}>
              <div className="vip-feature-icon">{item.icon}</div>

              <div>
                <h4>{item.title}</h4>
                <p>{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* =========================================
          VIP CONTACT
      ========================================= */}
      <section className="vip-contact-box">
        <div className="vip-contact-content">
          <span>ĐĂNG KÝ / NÂNG CẤP VIP</span>

          <h3>Muốn nâng cấp tài khoản?</h3>

          <p>
            Hãy liên hệ trực tiếp qua điện thoại hoặc Zalo. Tôi sẽ tư vấn và hỗ
            trợ kích hoạt tài khoản VIP cho bạn.
          </p>
        </div>

        <div className="vip-contact-info">
          <div className="contact-person-mini">
            <div className="contact-avatar">NG</div>

            <div>
              <span>NGƯỜI PHỤ TRÁCH</span>
              <strong>{OWNER_NAME}</strong>
            </div>
          </div>

          <div className="contact-action-buttons">
            <a href={`tel:${PHONE}`} className="contact-phone-btn">
              📞 Gọi ngay
            </a>

            <a
              href={ZALO_LINK}
              target="_blank"
              rel="noreferrer"
              className="contact-zalo-btn"
            >
              💬 Nhắn Zalo
            </a>
          </div>
        </div>
      </section>

      {/* =========================================
          OTHER SERVICES
      ========================================= */}
      <section className="contact-section other-services">
        <div className="section-heading">
          <span>DỊCH VỤ PHÁT TRIỂN</span>

          <h3>
            Ngoài hệ thống thời khóa biểu,
            <br />
            tôi còn nhận phát triển
          </h3>

          <p>
            Nếu bạn đang có một ý tưởng hoặc nhu cầu riêng, tôi nhận thiết kế và
            phát triển sản phẩm công nghệ theo yêu cầu.
          </p>
        </div>

        <div className="service-grid">
          {services.map((service) => (
            <div className="service-card" key={service.title}>
              <div className="service-icon">{service.icon}</div>

              <div>
                <h4>{service.title}</h4>
                <p>{service.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* =========================================
          FINAL CTA
      ========================================= */}
      <section className="final-contact">
        <div>
          <span>BẠN CÓ NHU CẦU?</span>

          <h3>Hãy liên hệ để trao đổi trực tiếp</h3>

          <p>
            Nâng cấp VIP hoặc trao đổi về Website, App, Tool theo nhu cầu của
            bạn.
          </p>
        </div>

        <div className="final-contact-buttons">
          <a href={`tel:${PHONE}`}>📞 Gọi {PHONE}</a>

          <a href={ZALO_LINK} target="_blank" rel="noreferrer">
            💬 Nhắn Zalo
          </a>
        </div>
      </section>
    </div>
  );
}
