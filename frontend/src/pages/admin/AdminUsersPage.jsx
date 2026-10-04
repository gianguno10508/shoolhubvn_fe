// pages/admin/AdminUsersPage.jsx
import { useEffect, useMemo, useState } from "react";
import { listUsers, grantVip, revokeVip, setUserRole } from "../../api/admin";
import { useAuth } from "../../context/AuthContext";
import { formatVipUntil } from "../../utils/permissions";

const ROLE_LABEL = {
  admin: "Admin",
  giao_vien: "Giáo viên",
  to_truong: "Tổ trưởng",
};

const ROLE_ICON = {
  admin: "👑",
  giao_vien: "👨‍🏫",
  to_truong: "⭐",
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

  function showToast(msg, isError = false) {
    setToast({
      msg,
      error: isError,
    });

    window.clearTimeout(showToast._t);

    showToast._t = window.setTimeout(() => {
      setToast(null);
    }, 2600);
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
      `Đã đổi quyền của ${u.username} thành ${ROLE_LABEL[role]}.`,
    );
  }

  /* =========================================
     STATISTICS
  ========================================= */

  const stats = useMemo(() => {
    const total = users.length;

    const vip = users.filter((u) => u.role !== "admin" && u.isVip).length;

    const expired = users.filter(
      (u) => u.role !== "admin" && !u.isVip && u.vipUntil,
    ).length;

    const admins = users.filter((u) => u.role === "admin").length;

    return {
      total,
      vip,
      expired,
      admins,
    };
  }, [users]);

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
        u.className?.toLowerCase().includes(keyword);

      const matchesRole = roleFilter === "all" || u.role === roleFilter;

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

      return matchesSearch && matchesRole && matchesVip;
    });
  }, [users, search, roleFilter, vipFilter]);

  return (
    <div className="page admin-users-page">
      {/* =====================================
          HEADER
      ===================================== */}
      <div className="admin-page-header">
        <div>
          <div className="admin-eyebrow">ADMINISTRATION</div>

          <h2>Quản lý tài khoản</h2>

          <p>Quản lý người dùng, phân quyền và trạng thái tài khoản VIP.</p>
        </div>

        <button className="admin-refresh-btn" onClick={load} disabled={loading}>
          <span className={loading ? "spin" : ""}>↻</span>
          Làm mới
        </button>
      </div>

      {/* =====================================
          TOAST
      ===================================== */}
      {toast && (
        <div
          className={"admin-toast" + (toast.error ? " admin-toast-error" : "")}
        >
          <span>{toast.error ? "!" : "✓"}</span>

          {toast.msg}
        </div>
      )}

      {/* =====================================
          STATISTICS
      ===================================== */}
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

          <div className="admin-stat-card">
            <div className="admin-stat-icon purple">👑</div>

            <div>
              <span>Quản trị viên</span>
              <strong>{stats.admins}</strong>
            </div>
          </div>
        </div>
      )}

      {/* =====================================
          LOADING
      ===================================== */}
      {loading && (
        <div className="admin-loading">
          <div className="admin-spinner"></div>

          <span>Đang tải danh sách tài khoản...</span>
        </div>
      )}

      {/* =====================================
          ERROR
      ===================================== */}
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

      {/* =====================================
          CONTENT
      ===================================== */}
      {!loading && !error && (
        <div className="admin-users-panel">
          {/* Toolbar */}
          <div className="admin-toolbar">
            <div className="admin-toolbar-title">
              <div>
                <h3>Danh sách tài khoản</h3>

                <span>{filteredUsers.length} tài khoản</span>
              </div>
            </div>

            <div className="admin-filters">
              {/* Search */}
              <div className="admin-search">
                <span>⌕</span>

                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Tìm tài khoản, họ tên, lớp..."
                />

                {search && (
                  <button onClick={() => setSearch("")} type="button">
                    ×
                  </button>
                )}
              </div>

              {/* Role */}
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option value="all">Tất cả quyền</option>

                <option value="admin">Admin</option>

                <option value="giao_vien">Giáo viên</option>

                <option value="to_truong">Tổ trưởng</option>
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

          {/* Table */}
          <div className="admin-table-wrap">
            <table className="admin-users-table">
              <thead>
                <tr>
                  <th>Tài khoản</th>
                  <th>Thông tin</th>
                  <th>Quyền</th>
                  <th>Trạng thái VIP</th>
                  <th className="admin-action-head">Thao tác</th>
                </tr>
              </thead>

              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="admin-empty">
                      <div>
                        <span>🔍</span>
                        <strong>Không tìm thấy tài khoản</strong>
                        <p>Thử thay đổi từ khóa hoặc bộ lọc.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const busy = busyId === u.id;

                    const isSelf = me && me.id === u.id;

                    return (
                      <tr key={u.id}>
                        {/* Account */}
                        <td>
                          <div className="user-account">
                            <div className="user-avatar">
                              {(u.name || u.username || "?")
                                .charAt(0)
                                .toUpperCase()}
                            </div>

                            <div>
                              <strong>{u.username}</strong>

                              {isSelf && (
                                <span className="self-badge">Bạn</span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Information */}
                        <td>
                          <div className="user-information">
                            <strong>{u.name || "Chưa cập nhật"}</strong>

                            <span>
                              {u.className
                                ? `Lớp ${u.className}`
                                : "Chưa có lớp phụ trách"}
                            </span>
                          </div>
                        </td>

                        {/* Role */}
                        <td>
                          <div className="role-control">
                            <span className={"role-badge role-" + u.role}>
                              <span>{ROLE_ICON[u.role]}</span>

                              {ROLE_LABEL[u.role]}
                            </span>

                            <select
                              value={u.role}
                              disabled={busy || isSelf}
                              title={
                                isSelf
                                  ? "Không thể tự đổi quyền của chính mình"
                                  : ""
                              }
                              onChange={(e) =>
                                handleRoleChange(u, e.target.value)
                              }
                            >
                              {Object.entries(ROLE_LABEL).map(
                                ([value, label]) => (
                                  <option key={value} value={value}>
                                    {label}
                                  </option>
                                ),
                              )}
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

                              <button
                                disabled={busy}
                                onClick={() => handleGrantVip(u, 1)}
                              >
                                +1 năm
                              </button>

                              <button
                                disabled={busy}
                                onClick={() => handleGrantVip(u, 2)}
                              >
                                +2 năm
                              </button>

                              <button
                                disabled={busy}
                                onClick={() => handleGrantVip(u, 3)}
                              >
                                +3 năm
                              </button>
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
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
