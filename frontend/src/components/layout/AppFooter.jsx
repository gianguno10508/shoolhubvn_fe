// components/layout/AppFooter.jsx — chân trang: thương hiệu, liên kết nhanh, bản quyền & nhà phát triển
import { Link } from "react-router-dom";
import { Code2, Heart, LifeBuoy, ShieldCheck, UserRound } from "lucide-react";
import BrandLogo from "../common/BrandLogo";
import { BRAND, copyrightText } from "../../constants/brand";

export default function AppFooter({ compact = false }) {
  return (
    <footer className={"app-footer" + (compact ? " compact" : "")}>
      {!compact && (
        <div className="app-footer-main">
          <div className="app-footer-brand">
            <BrandLogo size={34} />
            <div>
              <strong>{BRAND.name}</strong>
              <span>{BRAND.tagline}</span>
            </div>
          </div>
          <nav className="app-footer-links" aria-label="Liên kết chân trang">
            <Link to="/lien-he">
              <LifeBuoy size={15} /> Liên hệ & hỗ trợ
            </Link>
            <Link to="/ca-nhan">
              <UserRound size={15} /> Tài khoản
            </Link>
            <span>
              <ShieldCheck size={15} /> Dữ liệu được bảo mật
            </span>
          </nav>
        </div>
      )}
      <div className="app-footer-bottom">
        <span>{copyrightText()}. Bảo lưu mọi quyền.</span>
        <span className="app-footer-dev">
          <Code2 size={14} /> Phát triển bởi <b>{BRAND.developer}</b>
          <Heart size={12} className="app-footer-heart" />
        </span>
        <span className="app-footer-version">Phiên bản {BRAND.version}</span>
      </div>
    </footer>
  );
}
