// pages/admin/AdminUsersPage.jsx
import { useEffect, useMemo, useState } from "react";
import { listUsers, grantVip, revokeVip, setUserRole } from "../../api/admin";
import { useAuth } from "../../context/AuthContext";
import { formatVipUntil } from "../../utils/permissions";

// Thứ tự hiển thị chức vụ (từ cao xuống thấp)
const ROLE_LABEL = {
  admin: "Admin",
  ban_giam_hieu: "Ban giám hiệu",
  giao_vien_chu_nhiem: "Giáo viên chủ nhiệm",
  giao_vien: "Giáo viên",
  doan_thanh_nien: "Đoàn thanh niên",
  co_do: "Cờ đỏ",
  hoc_sinh: "Học sinh",
};

const ROLE_ICON = {
  admin: "👑",
  ban_giam_hieu: "🏛️",
  giao_vien_chu_nhiem: "📋",
  giao_vien: "👨‍🏫",
  doan_thanh_nien: "🚩",
  co_do: "🔴",
  hoc_sinh: "🎒",
};

const ROLE_ORDER = Object.keys(ROLE_LABEL);
const NO_SCHOOL = "__none__";
const NO_SCHOOL_LABEL = "Chưa cập nhật trường";

const roleRank = (role) => {
  const i = ROLE_ORDER.indexOf(role);
  return i === -1 ? 99 : i;
};

export default function AdminUsersPage() {
  const { user: me } = useAuth();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [busyId, setBusyId] = useState(null);
  const [toast, setToast] = useState(null);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [vipFilter, setVipFilter] = useState("all");
  const [schoolFilter, setSchoolFilter] = useState("all");
  const [viewMode, setViewMode] = useState("school"); // "school" | "all"
  const [collapsed, setCollapsed] = useState({}); // { [schoolKey]: true }

  function showToast(msg, isError = false) {
    setToast({ msg, error: isError });
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(null), 2600);
  }

  function load() {
    setLoading(true);
    setError("");

    listUsers()
      .then(setUsers)
      .catch((err) =>
        setError(err.message || "Không tải được danh sách tài khoản."),
      )
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function run(id, action, successMsg) {
    setBusyId(id);
    try {
      const updated = await action();
      setUsers((prev) => prev.map((u) => (u.id === id ? updated : u)));
      showToast(successMsg);
    } catch (err) {
      showToast(err.message || "Có lỗi xảy ra.", true);
    } finally {
      setBusyId(null);
    }
  }

  function handleGrantVip(u, years) {
    run(
      u.id,
      () => grantVip(u.id, years),
      `Đã cấp VIP ${years} năm cho ${u.username}.`,
    );
  }

  function handleRevoke(u) {
    if (!window.confirm(`Thu hồi VIP của "${u.username}" ngay bây giờ?`)) {
      return;
    }
    run(u.id, () => revokeVip(u.id), `Đã thu hồi VIP của ${u.username}.`);
  }

  function handleRoleChange(u, role) {
    if (role === u.role) return;
    run(
      u.id,
      () => setUserRole(u.id, role),
      `Đã đổi chức vụ của ${u.username} thành ${ROLE_LABEL[role]}.`,
    );
  }

  const toggleGroup = (key) =>
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));

  /* =========================================
     DANH SÁCH TRƯỜNG (cho bộ lọc)
  ========================================= */

  const schoolOptions = useMemo(() => {
    const set = new Set();
    users.forEach((u) => {
      if (u.school?.trim()) set.add(u.school.trim());
    });
    return [...set].sort((a, b) => a.localeCompare(b, "vi"));
  }, [users]);

  const hasNoSchool = useMemo(
    () => users.some((u) => !u.school?.trim()),
    [users],
  );

  /* =========================================
     STATISTICS
  ========================================= */

  const stats = useMemo(() => {
    const total = users.length;
    const vip = users.filter((u) => u.role !== "admin" && u.isVip).length;
    const expired = users.filter(
      (u) => u.role !== "admin" && !u.isVip && u.vipUntil,
    ).length;
    const schools = schoolOptions.length;

    return { total, vip, expired, schools };
  }, [users, schoolOptions]);

  /* =========================================
     FILTER
  ========================================= */

  const filteredUsers = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return users.filter((u) => {
      const matchesSearch =
        !keyword ||
        u.username?.toLowerCase().includes(keyword) ||
        u.name?.toLowerCase().includes(keyword) ||
        u.school?.toLowerCase().includes(keyword) ||
        u.className?.toLowerCase().includes(keyword);

      const matchesRole = roleFilter === "all" || u.role === roleFilter;

      const userSchool = u.school?.trim() || NO_SCHOOL;
      const matchesSchool =
        schoolFilter === "all" || userSchool === schoolFilter;

      let matchesVip = true;
      if (vipFilter === "vip") {
        matchesVip = u.role === "admin" || u.isVip;
      }
      if (vipFilter === "expired") {
        matchesVip = u.role !== "admin" && !u.isVip && !!u.vipUntil;
      }
      if (vipFilter === "none") {
        matchesVip = u.role !== "admin" && !u.isVip && !u.vipUntil;
      }

      return matchesSearch && matchesRole && matchesSchool && matchesVip;
    });
  }, [users, search, roleFilter, vipFilter, schoolFilter]);

  /* =========================================
     GOM NHÓM THEO TRƯỜNG
  ========================================= */

  const groups = useMemo(() => {
    const map = new Map();

    filteredUsers.forEach((u) => {
      const key = u.school?.trim() || NO_SCHOOL;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(u);
    });

    return [...map.entries()]
      .map(([key, members]) => {
        // Sắp xếp theo chức vụ rồi theo tên
        members.sort(
          (a, b) =>
            roleRank(a.role) - roleRank(b.role) ||
            (a.name || a.username).localeCompare(b.name || b.username, "vi"),
        );

        // Đếm số người theo từng chức vụ
        const roleCounts = {};
        members.forEach((m) => {
          roleCounts[m.role] = (roleCounts[m.role] || 0) + 1;
        });

        return {
          key,
          label: key === NO_SCHOOL ? NO_SCHOOL_LABEL : key,
          members,
          roleCounts,
        };
      })
      .sort((a, b) => {
        // "Chưa cập nhật trường" luôn xuống cuối
        if (a.key === NO_SCHOOL) return 1;
        if (b.key === NO_SCHOOL) return -1;
        return a.label.localeCompare(b.label, "vi");
      });
  }, [filteredUsers]);

  /* =========================================
     RENDER 1 DÒNG TÀI KHOẢN
  ========================================= */

  function renderRow(u, { showSchool }) {
    const busy = busyId === u.id;
    const isSelf = me && me.id === u.id;

    return (
      <tr key={u.id}>
        {/* Account */}
        <td>
          <div className="user-account">
            <div className="user-avatar">
              {(u.name || u.username || "?").charAt(0).toUpperCase()}
            </div>
            <div>
              <strong>{u.username}</strong>
              {isSelf && <span className="self-badge">Bạn</span>}
            </div>
          </div>
        </td>

        {/* Information */}
        <td>
          <div className="user-information">
            <strong>{u.name || "Chưa cập nhật"}</strong>

            {showSchool && (
              <span>🏫 {u.school?.trim() || NO_SCHOOL_LABEL}</span>
            )}

            {u.className && <span>Lớp {u.className}</span>}
          </div>
        </td>

        {/* Role */}
        <td>
          <div className="role-control">
            <span className={"role-badge role-" + u.role}>
              <span>{ROLE_ICON[u.role]}</span>
              {ROLE_LABEL[u.role] || u.role}
            </span>

            <select
              value={u.role}
              disabled={busy || isSelf}
              title={isSelf ? "Không thể tự đổi chức vụ của chính mình" : ""}
              onChange={(e) => handleRoleChange(u, e.target.value)}
            >
              {Object.entries(ROLE_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </td>

        {/* VIP */}
        <td>
          {u.role === "admin" ? (
            <span className="vip-status admin">
              <span>♛</span>
              Không cần VIP
            </span>
          ) : u.isVip ? (
            <span className="vip-status active">
              <span>★</span>
              <div>
                <strong>VIP đang hoạt động</strong>
                <small>Đến {formatVipUntil(u.vipUntil)}</small>
              </div>
            </span>
          ) : u.vipUntil ? (
            <span className="vip-status expired">
              <span>!</span>
              <div>
                <strong>VIP đã hết hạn</strong>
                <small>{formatVipUntil(u.vipUntil)}</small>
              </div>
            </span>
          ) : (
            <span className="vip-status none">
              <span>○</span>
              Chưa có VIP
            </span>
          )}
        </td>

        {/* Actions */}
        <td>
          <div className="user-actions">
            <div className="vip-action-group">
              <span>Cấp VIP</span>
              {[1, 2, 3].map((y) => (
                <button
                  key={y}
                  disabled={busy}
                  onClick={() => handleGrantVip(u, y)}
                >
                  +{y} năm
                </button>
              ))}
            </div>

            {(u.isVip || u.vipUntil) && (
              <button
                className="revoke-btn"
                disabled={busy}
                onClick={() => handleRevoke(u)}
              >
                {busy ? "Đang xử lý..." : "Thu hồi VIP"}
              </button>
            )}
          </div>
        </td>
      </tr>
    );
  }

  /* =========================================
     RENDER BẢNG
  ========================================= */

  function renderTable(rows, { showSchool }) {
    return (
      <div className="admin-table-wrap">
        <table className="admin-users-table">
          <thead>
            <tr>
              <th>Tài khoản</th>
              <th>Thông tin</th>
              <th>Chức vụ</th>
              <th>Trạng thái VIP</th>
              <th className="admin-action-head">Thao tác</th>
            </tr>
          </thead>
          <tbody>{rows.map((u) => renderRow(u, { showSchool }))}</tbody>
        </table>
      </div>
    );
  }

  const emptyState = (
    <div className="admin-empty">
      <div>
        <span>🔍</span>
        <strong>Không tìm thấy tài khoản</strong>
        <p>Thử thay đổi từ khóa hoặc bộ lọc.</p>
      </div>
    </div>
  );

  return (
    <div className="page admin-users-page">
      {/* HEADER */}
      <div className="admin-page-header">
        <div>
          <div className="admin-eyebrow">ADMINISTRATION</div>
          <h2>Quản lý tài khoản</h2>
          <p>
            Quản lý người dùng theo từng trường, phân chức vụ và trạng thái VIP.
          </p>
        </div>

        <button className="admin-refresh-btn" onClick={load} disabled={loading}>
          <span className={loading ? "spin" : ""}>↻</span>
          Làm mới
        </button>
      </div>

      {/* TOAST */}
      {toast && (
        <div
          className={"admin-toast" + (toast.error ? " admin-toast-error" : "")}
        >
          <span>{toast.error ? "!" : "✓"}</span>
          {toast.msg}
        </div>
      )}

      {/* STATISTICS */}
      {!loading && !error && (
        <div className="admin-stats">
          <div className="admin-stat-card">
            <div className="admin-stat-icon blue">👥</div>
            <div>
              <span>Tổng tài khoản</span>
              <strong>{stats.total}</strong>
            </div>
          </div>

          <div className="admin-stat-card">
            <div className="admin-stat-icon purple">🏫</div>
            <div>
              <span>Số trường</span>
              <strong>{stats.schools}</strong>
            </div>
          </div>

          <div className="admin-stat-card">
            <div className="admin-stat-icon gold">★</div>
            <div>
              <span>Đang sử dụng VIP</span>
              <strong>{stats.vip}</strong>
            </div>
          </div>

          <div className="admin-stat-card">
            <div className="admin-stat-icon orange">⏱</div>
            <div>
              <span>VIP hết hạn</span>
              <strong>{stats.expired}</strong>
            </div>
          </div>
        </div>
      )}

      {/* LOADING */}
      {loading && (
        <div className="admin-loading">
          <div className="admin-spinner"></div>
          <span>Đang tải danh sách tài khoản...</span>
        </div>
      )}

      {/* ERROR */}
      {!loading && error && (
        <div className="admin-error">
          <div className="admin-error-icon">!</div>
          <div>
            <strong>Không thể tải dữ liệu</strong>
            <p>{error}</p>
            <button className="link-btn" onClick={load}>
              Thử lại
            </button>
          </div>
        </div>
      )}

      {/* CONTENT */}
      {!loading && !error && (
        <div className="admin-users-panel">
          {/* Toolbar */}
          <div className="admin-toolbar">
            <div className="admin-toolbar-title">
              <div>
                <h3>
                  {viewMode === "school"
                    ? "Danh sách theo trường"
                    : "Danh sách tài khoản"}
                </h3>
                <span>
                  {filteredUsers.length} tài khoản
                  {viewMode === "school" && ` · ${groups.length} trường`}
                </span>
              </div>

              {/* Chuyển chế độ xem */}
              <div className="view-toggle">
                <button
                  type="button"
                  className={viewMode === "school" ? "active" : ""}
                  onClick={() => setViewMode("school")}
                >
                  🏫 Theo trường
                </button>
                <button
                  type="button"
                  className={viewMode === "all" ? "active" : ""}
                  onClick={() => setViewMode("all")}
                >
                  ☰ Tất cả
                </button>
              </div>
            </div>

            <div className="admin-filters">
              {/* Search */}
              <div className="admin-search">
                <span>⌕</span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Tìm tài khoản, họ tên, trường..."
                />
                {search && (
                  <button onClick={() => setSearch("")} type="button">
                    ×
                  </button>
                )}
              </div>

              {/* School */}
              <select
                value={schoolFilter}
                onChange={(e) => setSchoolFilter(e.target.value)}
              >
                <option value="all">Tất cả trường</option>
                {schoolOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
                {hasNoSchool && (
                  <option value={NO_SCHOOL}>{NO_SCHOOL_LABEL}</option>
                )}
              </select>

              {/* Role */}
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option value="all">Tất cả chức vụ</option>
                {Object.entries(ROLE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>

              {/* VIP */}
              <select
                value={vipFilter}
                onChange={(e) => setVipFilter(e.target.value)}
              >
                <option value="all">Tất cả VIP</option>
                <option value="vip">Đang có VIP</option>
                <option value="expired">VIP hết hạn</option>
                <option value="none">Chưa có VIP</option>
              </select>
            </div>
          </div>

          {/* Nội dung */}
          {filteredUsers.length === 0 ? (
            emptyState
          ) : viewMode === "all" ? (
            renderTable(
              [...filteredUsers].sort(
                (a, b) =>
                  (a.school || "￿").localeCompare(b.school || "￿", "vi") ||
                  roleRank(a.role) - roleRank(b.role),
              ),
              { showSchool: true },
            )
          ) : (
            <div className="school-groups">
              {groups.map((g) => {
                const isCollapsed = !!collapsed[g.key];

                return (
                  <section className="school-group" key={g.key}>
                    <button
                      type="button"
                      className="school-group-header"
                      onClick={() => toggleGroup(g.key)}
                      aria-expanded={!isCollapsed}
                    >
                      <div className="school-group-title">
                        <span className="school-group-icon">🏫</span>
                        <div>
                          <strong>{g.label}</strong>
                          <small>{g.members.length} tài khoản</small>
                        </div>
                      </div>

                      <div className="school-role-chips">
                        {ROLE_ORDER.filter((r) => g.roleCounts[r]).map((r) => (
                          <span key={r} className={"role-chip role-" + r}>
                            {ROLE_ICON[r]} {ROLE_LABEL[r]}:{" "}
                            <b>{g.roleCounts[r]}</b>
                          </span>
                        ))}
                      </div>

                      <span
                        className={
                          "school-caret" + (isCollapsed ? "" : " open")
                        }
                      >
                        ▾
                      </span>
                    </button>

                    {!isCollapsed &&
                      renderTable(g.members, { showSchool: false })}
                  </section>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
