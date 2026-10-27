// pages/ContactPage.jsx — liên hệ hỗ trợ & nâng cấp SchoolHub VIP
import { useState } from "react";
import {
  BadgeCheck,
  Bell,
  BookOpenCheck,
  CalendarDays,
  Check,
  ClipboardCheck,
  Code2,
  Copy,
  Crown,
  Globe,
  Headphones,
  MessageCircle,
  Phone,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Trophy,
  Wrench,
  Zap,
} from "lucide-react";
import BrandLogo from "../components/common/BrandLogo";
import { BRAND } from "../constants/brand";

const PHONE = "0344344844";
const PHONE_TEXT = "0344 344 844";
const OWNER_NAME = "Ngọc Văn Giang";
const ZALO_LINK = `https://zalo.me/${PHONE}`;

const VIP_FEATURES = [
  { icon: CalendarDays, tone: "blue", title: "Xếp thời khóa biểu", description: "Xếp tự động, kéo thả chỉnh sửa, xuất Excel và chia sẻ cho giáo viên." },
  { icon: ClipboardCheck, tone: "indigo", title: "Giao bài & tự chấm", description: "Giao bài trực tuyến, chấm tự động và thống kê kết quả từng lớp." },
  { icon: Sparkles, tone: "purple", title: "Tạo đề với AI", description: "Sinh ma trận, bản đặc tả và đề kiểm tra theo đúng cấu trúc mới." },
  { icon: BookOpenCheck, tone: "teal", title: "Giáo án AI", description: "Soạn giáo án, trộn đề và xuất Word chỉ trong vài phút." },
  { icon: Trophy, tone: "amber", title: "Thi đua & nề nếp", description: "Chấm thi đua hằng ngày, xếp hạng lớp minh bạch theo tuần." },
  { icon: Bell, tone: "rose", title: "Thông báo nội bộ", description: "Gửi thông báo kèm tệp đính kèm tới giáo viên, học sinh và phụ huynh." },
];

const STEPS = [
  { icon: MessageCircle, title: "Liên hệ", description: "Gọi điện hoặc nhắn Zalo, cho biết tên trường và nhu cầu sử dụng." },
  { icon: Headphones, title: "Tư vấn", description: "Được tư vấn gói phù hợp với quy mô trường và số lượng tài khoản." },
  { icon: Zap, title: "Kích hoạt", description: "Kích hoạt VIP ngay trong ngày — mọi dữ liệu của trường giữ nguyên." },
];

const SERVICES = [
  { icon: Globe, title: "Website", description: "Thiết kế website, hệ thống quản lý và nền tảng web theo yêu cầu." },
  { icon: Smartphone, title: "Ứng dụng di động", description: "Phát triển app Android / iOS phù hợp với nhu cầu sử dụng thực tế." },
  { icon: Wrench, title: "Công cụ tự động", description: "Xây dựng công cụ hỗ trợ công việc, quản lý và tự động hóa." },
];

function CopyPhone() {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(PHONE);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // trình duyệt chặn clipboard — bỏ qua
    }
  }
  return (
    <button type="button" className="ct-copy" onClick={copy} title="Sao chép số điện thoại">
      {copied ? <Check size={15} /> : <Copy size={15} />}
      {copied ? "Đã sao chép" : "Sao chép"}
    </button>
  );
}

export default function ContactPage() {
  return (
    <div className="page ct-page">
      {/* ---------- Hero VIP ---------- */}
      <section className="ct-hero">
        <div className="ct-hero-content">
          <span className="ct-tag">
            <Crown size={14} /> {BRAND.name} VIP
          </span>
          <h1>
            Nâng cấp lên <span>VIP</span>
          </h1>
          <p className="ct-hero-sub">Mở khóa toàn bộ công cụ quản lý trường học số cho giáo viên, học sinh và nhà trường.</p>

          <div className="ct-hero-actions">
            <a href={ZALO_LINK} target="_blank" rel="noreferrer" className="ct-btn ct-btn-gold">
              <MessageCircle size={18} /> Nhắn Zalo nâng cấp
            </a>
            <a href={`tel:${PHONE}`} className="ct-btn ct-btn-glass">
              <Phone size={17} /> {PHONE_TEXT}
            </a>
          </div>

          <ul className="ct-trust">
            <li>
              <Zap size={15} /> Kích hoạt trong ngày
            </li>
            <li>
              <ShieldCheck size={15} /> Dữ liệu giữ nguyên
            </li>
            <li>
              <Headphones size={15} /> Hỗ trợ tận tình
            </li>
          </ul>
        </div>

        <div className="ct-hero-visual" aria-hidden="true">
          <div className="ct-glow" />
          <div className="ct-vip-card">
            <div className="ct-vip-card-top">
              <BrandLogo size={30} />
              <span>{BRAND.name.toUpperCase()}</span>
              <Crown size={20} className="ct-vip-crown" />
            </div>
            <div className="ct-vip-chip" />
            <strong>VIP MEMBER</strong>
            <div className="ct-vip-card-bottom">
              <span>Toàn bộ tính năng</span>
              <b>UNLOCKED</b>
            </div>
          </div>
          <span className="ct-float ct-float-1">
            <Sparkles size={18} />
          </span>
          <span className="ct-float ct-float-2">
            <CalendarDays size={18} />
          </span>
          <span className="ct-float ct-float-3">
            <Trophy size={18} />
          </span>
        </div>
      </section>

      {/* ---------- Quyền lợi ---------- */}
      <section className="ct-section">
        <div className="ct-heading">
          <span>QUYỀN LỢI VIP</span>
          <h3>Mọi thứ nhà trường cần, trong một nền tảng</h3>
          <p>Tài khoản VIP mở toàn bộ chức năng của {BRAND.name} cho mọi giáo viên và học sinh trong trường.</p>
        </div>

        <div className="ct-feature-grid">
          {VIP_FEATURES.map((f) => (
            <article className={"ct-feature tone-" + f.tone} key={f.title}>
              <span className="ct-feature-icon">
                <f.icon size={22} />
              </span>
              <h4>{f.title}</h4>
              <p>{f.description}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ---------- Quy trình + liên hệ ---------- */}
      <section className="ct-section ct-split">
        <div className="ct-steps-card">
          <div className="ct-heading">
            <span>QUY TRÌNH</span>
            <h3>Nâng cấp chỉ với 3 bước</h3>
          </div>
          <ol className="ct-steps">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <span className="ct-step-num">{i + 1}</span>
                <div>
                  <h4>
                    <s.icon size={16} /> {s.title}
                  </h4>
                  <p>{s.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="ct-person-card">
          <div className="ct-person">
            <span className="ct-avatar">NVG</span>
            <div>
              <span className="ct-person-label">NGƯỜI PHỤ TRÁCH</span>
              <strong>{OWNER_NAME}</strong>
              <small>
                <BadgeCheck size={14} /> Nhà phát triển {BRAND.name}
              </small>
            </div>
          </div>

          <div className="ct-phone">
            <Phone size={18} />
            <div>
              <span>Điện thoại / Zalo</span>
              <a href={`tel:${PHONE}`}>{PHONE_TEXT}</a>
            </div>
            <CopyPhone />
          </div>

          <div className="ct-person-actions">
            <a href={`tel:${PHONE}`} className="ct-btn ct-btn-dark">
              <Phone size={16} /> Gọi ngay
            </a>
            <a href={ZALO_LINK} target="_blank" rel="noreferrer" className="ct-btn ct-btn-primary">
              <MessageCircle size={16} /> Nhắn Zalo
            </a>
          </div>
        </div>
      </section>

      {/* ---------- Dịch vụ khác ---------- */}
      <section className="ct-section">
        <div className="ct-heading">
          <span>DỊCH VỤ PHÁT TRIỂN</span>
          <h3>Ngoài {BRAND.name}, chúng tôi còn nhận phát triển</h3>
          <p>Nếu bạn có ý tưởng hoặc nhu cầu riêng, chúng tôi nhận thiết kế và phát triển sản phẩm công nghệ theo yêu cầu.</p>
        </div>

        <div className="ct-service-grid">
          {SERVICES.map((s) => (
            <article className="ct-service" key={s.title}>
              <span className="ct-service-icon">
                <s.icon size={22} />
              </span>
              <div>
                <h4>{s.title}</h4>
                <p>{s.description}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ---------- Kêu gọi cuối ---------- */}
      <section className="ct-final">
        <span className="ct-final-icon">
          <Code2 size={24} />
        </span>
        <div>
          <span className="ct-final-label">BẠN CÓ NHU CẦU?</span>
          <h3>Liên hệ để trao đổi trực tiếp</h3>
          <p>Nâng cấp VIP hoặc trao đổi về Website, App, Tool theo nhu cầu của bạn.</p>
        </div>
        <div className="ct-final-actions">
          <a href={`tel:${PHONE}`} className="ct-btn ct-btn-white">
            <Phone size={16} /> Gọi {PHONE_TEXT}
          </a>
          <a href={ZALO_LINK} target="_blank" rel="noreferrer" className="ct-btn ct-btn-primary">
            <MessageCircle size={16} /> Nhắn Zalo
          </a>
        </div>
      </section>
    </div>
  );
}
