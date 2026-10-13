// components/layout/AppShell.jsx
import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import useUnreadCount from "../../hooks/useUnreadCount";
import { buildNav, pageTitle } from "../../utils/navigation";
import { ROLE_LABEL, homePath, isVipLocked } from "../../utils/permissions";
import NotificationBell from "../notifications/NotificationBell";

const COLLAPSE_KEY = "tkb_sidebar_collapsed";

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

/* Khung chung sau khi đăng nhập: sidebar trái + thanh trên (tiêu đề, chuông, tài khoản) */
export default function AppShell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [drawer, setDrawer] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const hasSchool = !!user?.schoolId;
  const locked = isVipLocked(user);
  const [unread] = useUnreadCount(hasSchool && !locked);
  const nav = buildNav(user);
  // Trình soạn TKB cần nhiều chỗ: thu gọn sidebar
  const compact = collapsed || /^\/tkb\/.+/.test(location.pathname);

  useEffect(() => setDrawer(false), [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const close = (e) => menuRef.current && !menuRef.current.contains(e.target) && setMenuOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  function toggleCollapsed() {
    setCollapsed((v) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, v ? "0" : "1");
      } catch {
        /* bỏ qua */
      }
      return !v;
    });
  }

  const displayName = user?.name || user?.username || "";
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(-2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <div className={"shell" + (compact ? " compact" : "") + (drawer ? " drawer-open" : "")}>
      <aside className="shell-side">
        <NavLink to={homePath(user)} className="shell-brand">
          <span className="shell-logo">S</span>
          <span className="shell-brand-text">
            <strong>SchoolHub</strong>
            <small>{user?.school?.name || "Quản trị hệ thống"}</small>
          </span>
        </NavLink>

        <nav className="shell-nav">
          {nav.map((g) => (
            <div key={g.title} className="shell-group">
              <span className="shell-group-title">{g.title}</span>
              {g.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  title={compact ? item.label : undefined}
                  className={({ isActive }) => "shell-link" + (isActive ? " active" : "")}
                >
                  <span className="shell-icon">{item.icon}</span>
                  <span className="shell-label">{item.label}</span>
                  {locked && item.to !== "/lien-he" && <span className="shell-lock">🔒</span>}
                  {item.badge === "unread" && unread > 0 && <span className="shell-badge">{unread > 99 ? "99+" : unread}</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="shell-side-foot">
          {user?.school && (
            <div className={"shell-vip" + (user.isVip ? " on" : "")} title={user.isVip ? "Trường đang dùng VIP" : "Trường chưa có VIP"}>
              <span>{user.isVip ? "★" : "☆"}</span>
              <span className="shell-label">{user.isVip ? "Trường VIP" : "Chưa có VIP"}</span>
            </div>
          )}
          <button className="shell-collapse" onClick={toggleCollapsed} title={collapsed ? "Mở rộng menu" : "Thu gọn menu"}>
            <span className="shell-icon">{collapsed ? "»" : "«"}</span>
            <span className="shell-label">Thu gọn menu</span>
          </button>
        </div>
      </aside>

      <div className="shell-scrim" onClick={() => setDrawer(false)} />

      <div className="shell-main">
        <header className="shell-top">
          <button className="shell-burger" onClick={() => setDrawer(true)} aria-label="Mở menu">
            ☰
          </button>
          <h1 className="shell-title">{pageTitle(location.pathname)}</h1>
          <div className="spacer" />

          {hasSchool && !locked && <NotificationBell unread={unread} />}

          <div className="shell-user" ref={menuRef}>
            <button className="shell-user-btn" onClick={() => setMenuOpen((v) => !v)} aria-expanded={menuOpen}>
              <span className="shell-avatar">{initials || "?"}</span>
              <span className="shell-user-text">
                <strong>{displayName}</strong>
                <small>
                  {ROLE_LABEL[user?.role]}
                  {user?.className ? ` · ${user.className}` : ""}
                </small>
              </span>
              <span className="shell-caret">▾</span>
            </button>
            {menuOpen && (
              <div className="shell-menu">
                <div className="shell-menu-head">
                  <strong>{displayName}</strong>
                  <span>@{user?.username}</span>
                  {user?.school && <span>{user.school.name}</span>}
                </div>
                <NavLink to="/lien-he" className="shell-menu-item" onClick={() => setMenuOpen(false)}>
                  💬 Liên hệ hỗ trợ
                </NavLink>
                <button className="shell-menu-item danger" onClick={logout}>
                  ⎋ Đăng xuất
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="shell-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
