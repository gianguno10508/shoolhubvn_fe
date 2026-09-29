// components/layout/TopNav.jsx
import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { isAdmin } from "../../utils/permissions";

const MENU = [
  { to: "/tkb", label: "Thời khóa biểu" },
  { to: "/giao-vien", label: "Trang giáo viên" },
  { to: "/lien-he", label: "Liên hệ" },
];

export default function TopNav() {
  const { user, logout } = useAuth();
  const displayName = user ? user.name || user.username : "";
  const menu = isAdmin(user)
    ? [...MENU, { to: "/admin/users", label: "Quản lý tài khoản" }]
    : MENU;

  return (
    <header className="topnav">
      <NavLink to="/tkb" className="topnav-brand">
        TKB
      </NavLink>
      <nav className="topnav-menu">
        {menu.map((m) => (
          <NavLink
            key={m.to}
            to={m.to}
            className={({ isActive }) =>
              "topnav-link" + (isActive ? " active" : "")
            }
          >
            {m.label}
          </NavLink>
        ))}
      </nav>
      <div className="spacer" />
      {displayName && <span className="topnav-user">{displayName}</span>}
      <button className="btn btn-sm btn-logout-top" onClick={logout}>
        Đăng xuất
      </button>
    </header>
  );
}
