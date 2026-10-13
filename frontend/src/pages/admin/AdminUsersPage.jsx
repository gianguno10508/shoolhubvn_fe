// pages/admin/AdminUsersPage.jsx
import { useEffect, useMemo, useState } from "react";
import {
  listUsers,
  listSchools,
  grantSchoolVip,
  revokeSchoolVip,
  setUserRole,
  deleteUser,
  deleteSchool,
} from "../../api/admin";
import { useAuth } from "../../context/AuthContext";
import { formatVipUntil, ROLE_LABEL, ROLE_ICON } from "../../utils/permissions";

const NO_SCHOOL = "__none__";

function vipState(school) {
  if (!school) return "admin";
  if (school.isVip) return "active";
  return school.vipUntil ? "expired" : "none";
}

function VipStatus({ school }) {
  const state = vipState(school);
  if (state === "admin") {
    return (
      <span className="vip-status admin">
        <span>♛</span>Không cần VIP
      </span>
    );
  }
  if (state === "active") {
    return (
      <span className="vip-status active">
        <span>★</span>
        <div>
          <strong>VIP đang hoạt động</strong>
          <small>Đến {formatVipUntil(school.vipUntil)}</small>
        </div>
      </span>
    );
  }
  if (state === "expired") {
    return (
      <span className="vip-status expired">
        <span>!</span>
        <div>
          <strong>VIP đã hết hạn</strong>
          <small>{formatVipUntil(school.vipUntil)}</small>
        </div>
      </span>
    );
  }
  return (
    <span className="vip-status none">
      <span>○</span>Chưa có VIP
    </span>
  );
}

/* Quản trị hệ thống: tài khoản được gom theo từng trường, VIP cấp cho cả trường */
export default function AdminUsersPage() {
  const { user: me } = useAuth();

  const [users, setUsers] = useState([]);
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [toast, setToast] = useState(null);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [vipFilter, setVipFilter] = useState("all");
  const [expanded, setExpanded] = useState({}); // schoolId -> bool

  function showToast(msg, isError = false) {
    setToast({ msg, error: isError });
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(null), 2600);
  }

  function load() {
    setLoading(true);
    setError("");
    Promise.all([listUsers(), listSchools()])
      .then(([u, s]) => {
        setUsers(u);
        setSchools(s);
      })
      .catch((err) => setError(err.message || "Không tải được dữ liệu."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function run(key, action, successMsg) {
    setBusyId(key);
    try {
      await action();
      showToast(successMsg);
    } catch (err) {
      showToast(err.message || "Có lỗi xảy ra.", true);
    } finally {
      setBusyId(null);
    }
  }

  function handleGrantVip(school, years) {
    run(
      school.id,
      async () => {
        const updated = await grantSchoolVip(school.id, years);
        setSchools((prev) => prev.map((s) => (s.id === school.id ? { ...s, ...updated } : s)));
      },
      `Đã cấp VIP ${years} năm cho ${school.name}.`,
    );
  }

  function handleRevoke(school) {
    if (!window.confirm(`Thu hồi VIP của trường "${school.name}" ngay bây giờ?`)) return;
    run(
      school.id,
      async () => {
        const updated = await revokeSchoolVip(school.id);
        setSchools((prev) => prev.map((s) => (s.id === school.id ? { ...s, ...updated } : s)));
      },
      `Đã thu hồi VIP của ${school.name}.`,
    );
  }

  function handleRoleChange(u, role) {
    if (role === u.role) return;
    run(
      u.id,
      async () => {
        const updated = await setUserRole(u.id, role);
        setUsers((prev) => prev.map((x) => (x.id === u.id ? updated : x)));
      },
      `Đã đổi quyền của ${u.username} thành ${ROLE_LABEL[role]}.`,
    );
  }

  function handleDeleteUser(u) {
    if (!window.confirm(`Xóa vĩnh viễn tài khoản "${u.username}" (${u.name || "chưa có tên"})?\nKết quả bài làm, phiếu chấm đã lưu vẫn được giữ lại.`)) return;
    run(
      u.id,
      async () => {
        await deleteUser(u.id);
        setUsers((prev) => prev.filter((x) => x.id !== u.id));
        setSchools((prev) => prev.map((s) => (s.id === u.schoolId ? { ...s, userCount: (s.userCount || 1) - 1 } : s)));
      },
      `Đã xóa tài khoản ${u.username}.`,
    );
  }

  function handleDeleteSchool(school, count) {
    const typed = window.prompt(
      `XÓA TRƯỜNG "${school.name}" cùng ${count} tài khoản và toàn bộ dữ liệu (lớp, thời khóa biểu, bài tập, thi đua, thông báo).\nKhông thể hoàn tác!\n\nGõ đúng tên trường để xác nhận:`,
    );
    if (typed === null) return;
    if (typed.trim() !== school.name) {
      showToast("Tên trường không khớp, chưa xóa.", true);
      return;
    }
    run(
      school.id,
      async () => {
        await deleteSchool(school.id, typed.trim());
        setSchools((prev) => prev.filter((x) => x.id !== school.id));
        setUsers((prev) => prev.filter((x) => String(x.schoolId) !== String(school.id)));
      },
      `Đã xóa trường ${school.name}.`,
    );
  }

  /* ===== Thống kê ===== */
  const stats = useMemo(
    () => ({
      schools: schools.length,
      vip: schools.filter((s) => s.isVip).length,
      expired: schools.filter((s) => !s.isVip && s.vipUntil).length,
      users: users.length,
    }),
    [schools, users],
  );

  /* ===== Gom theo trường + lọc ===== */
  const groups = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const bySchool = new Map();
    for (const u of users) {
      const key = u.schoolId ? String(u.schoolId) : NO_SCHOOL;
      if (!bySchool.has(key)) bySchool.set(key, []);
      bySchool.get(key).push(u);
    }

    const list = [
      ...schools.map((s) => ({ key: String(s.id), school: s, users: bySchool.get(String(s.id)) || [] })),
      ...(bySchool.has(NO_SCHOOL) ? [{ key: NO_SCHOOL, school: null, users: bySchool.get(NO_SCHOOL) }] : []),
    ];

    return list
      .filter((g) => vipFilter === "all" || vipState(g.school) === vipFilter)
      .map((g) => {
        const schoolMatches = !!g.school && g.school.name.toLowerCase().includes(keyword);
        const visible = g.users.filter(
          (u) =>
            (roleFilter === "all" || u.role === roleFilter) &&
            (!keyword ||
              schoolMatches ||
              u.username?.toLowerCase().includes(keyword) ||
              u.name?.toLowerCase().includes(keyword) ||
              u.className?.toLowerCase().includes(keyword)),
        );
        return { ...g, visible };
      })
      .filter((g) => g.visible.length > 0 || (!keyword && roleFilter === "all"));
  }, [users, schools, search, roleFilter, vipFilter]);

  const filtering = !!search.trim() || roleFilter !== "all";
  const isOpen = (key) => (expanded[key] ?? filtering) || false;
  const toggle = (key) => setExpanded((prev) => ({ ...prev, [key]: !isOpen(key) }));
  const setAll = (open) => setExpanded(Object.fromEntries(groups.map((g) => [g.key, open])));

  return (
    <div className="page admin-users-page">
      <div className="admin-page-header">
        <div>
          <div className="admin-eyebrow">ADMINISTRATION</div>
          <h2>Quản lý tài khoản</h2>
          <p>Tài khoản được gom theo từng trường. VIP được cấp cho cả trường.</p>
        </div>
        <button className="admin-refresh-btn" onClick={load} disabled={loading}>
          <span className={loading ? "spin" : ""}>↻</span>
          Làm mới
        </button>
      </div>

      {toast && (
        <div className={"admin-toast" + (toast.error ? " admin-toast-error" : "")}>
          <span>{toast.error ? "!" : "✓"}</span>
          {toast.msg}
        </div>
      )}

      {!loading && !error && (
        <div className="admin-stats">
          <div className="admin-stat-card">
            <div className="admin-stat-icon blue">🏫</div>
            <div>
              <span>Số trường</span>
              <strong>{stats.schools}</strong>
            </div>
          </div>
          <div className="admin-stat-card">
            <div className="admin-stat-icon gold">★</div>
            <div>
              <span>Trường đang VIP</span>
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
            <div className="admin-stat-icon purple">👥</div>
            <div>
              <span>Tổng tài khoản</span>
              <strong>{stats.users}</strong>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="admin-loading">
          <div className="admin-spinner"></div>
          <span>Đang tải danh sách tài khoản...</span>
        </div>
      )}

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

      {!loading && !error && (
        <>
          <div className="admin-users-panel admin-group-toolbar">
            <div className="admin-toolbar">
              <div className="admin-toolbar-title">
                <div>
                  <h3>Danh sách theo trường</h3>
                  <span>
                    {groups.length} nhóm · {groups.reduce((n, g) => n + g.visible.length, 0)} tài khoản
                  </span>
                </div>
              </div>
              <div className="admin-filters">
                <div className="admin-search">
                  <span>⌕</span>
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Tìm trường, tài khoản, họ tên, lớp..."
                  />
                  {search && (
                    <button onClick={() => setSearch("")} type="button">
                      ×
                    </button>
                  )}
                </div>
                <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                  <option value="all">Tất cả chức danh</option>
                  {Object.entries(ROLE_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <select value={vipFilter} onChange={(e) => setVipFilter(e.target.value)}>
                  <option value="all">Tất cả VIP</option>
                  <option value="active">Đang có VIP</option>
                  <option value="expired">VIP hết hạn</option>
                  <option value="none">Chưa có VIP</option>
                </select>
                <button className="btn btn-sm btn-light" onClick={() => setAll(true)}>
                  Mở tất cả
                </button>
                <button className="btn btn-sm btn-light" onClick={() => setAll(false)}>
                  Thu gọn
                </button>
              </div>
            </div>
          </div>

          {groups.length === 0 && (
            <div className="admin-users-panel admin-empty-panel">
              <span>🔍</span>
              <strong>Không tìm thấy kết quả</strong>
              <p>Thử thay đổi từ khóa hoặc bộ lọc.</p>
            </div>
          )}

          {groups.map((g) => {
            const open = isOpen(g.key);
            const s = g.school;
            const busy = s && busyId === s.id;
            const roleCounts = g.users.reduce((m, u) => ({ ...m, [u.role]: (m[u.role] || 0) + 1 }), {});
            return (
              <section key={g.key} className={"admin-users-panel admin-school" + (open ? " open" : "")}>
                <div className="admin-school-head">
                  <button className="admin-school-toggle" onClick={() => toggle(g.key)} aria-expanded={open}>
                    <span className="admin-school-chevron">›</span>
                    <span className="admin-school-avatar">{s ? s.name.charAt(0).toUpperCase() : "♛"}</span>
                    <span className="admin-school-name">
                      <strong>{s ? s.name : "Quản trị hệ thống"}</strong>
                      <small>
                        {s
                          ? `Tài khoản chính: ${s.owner ? s.owner.username : "—"} · ${g.users.length} tài khoản`
                          : `${g.users.length} tài khoản không thuộc trường`}
                      </small>
                    </span>
                  </button>

                  <div className="admin-school-roles">
                    {Object.entries(roleCounts).map(([role, n]) => (
                      <span key={role} className={"role-badge role-" + role} title={ROLE_LABEL[role]}>
                        {ROLE_ICON[role]} {n}
                      </span>
                    ))}
                  </div>

                  <VipStatus school={s} />

                  {s && (
                    <div className="user-actions">
                      <div className="vip-action-group">
                        <span>Gia hạn</span>
                        {[1, 2, 3].map((y) => (
                          <button key={y} disabled={busy} onClick={() => handleGrantVip(s, y)}>
                            +{y} năm
                          </button>
                        ))}
                      </div>
                      {s.vipUntil && (
                        <button className="revoke-btn" disabled={busy} onClick={() => handleRevoke(s)}>
                          Thu hồi
                        </button>
                      )}
                      <button
                        className="admin-delete-school"
                        disabled={busy}
                        onClick={() => handleDeleteSchool(s, g.users.length)}
                        title="Xóa trường cùng toàn bộ tài khoản"
                      >
                        🗑
                      </button>
                    </div>
                  )}
                </div>

                {open && (
                  <div className="admin-table-wrap">
                    <table className="admin-users-table admin-school-table">
                      <thead>
                        <tr>
                          <th>Tài khoản</th>
                          <th>Họ tên</th>
                          <th>Lớp</th>
                          <th>Chức danh</th>
                          <th>Trạng thái</th>
                          <th className="admin-action-head">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.visible.length === 0 ? (
                          <tr>
                            <td colSpan="6" className="admin-empty">
                              Không có tài khoản phù hợp.
                            </td>
                          </tr>
                        ) : (
                          g.visible.map((u) => {
                            const isSelf = me && me.id === u.id;
                            return (
                              <tr key={u.id}>
                                <td>
                                  <div className="user-account">
                                    <div className="user-avatar">{(u.name || u.username || "?").charAt(0).toUpperCase()}</div>
                                    <div>
                                      <strong>{u.username}</strong>
                                      {isSelf && <span className="self-badge">Bạn</span>}
                                    </div>
                                  </div>
                                </td>
                                <td>{u.name || <span className="muted">Chưa cập nhật</span>}</td>
                                <td>{u.className || <span className="muted">—</span>}</td>
                                <td>
                                  <div className="role-control">
                                    <span className={"role-badge role-" + u.role}>
                                      <span>{ROLE_ICON[u.role]}</span>
                                      {ROLE_LABEL[u.role]}
                                    </span>
                                    <select
                                      value={u.role}
                                      disabled={busyId === u.id || isSelf}
                                      title={isSelf ? "Không thể tự đổi quyền của chính mình" : "Đổi chức danh"}
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
                                <td>
                                  {u.status === "locked" ? (
                                    <span className="as-status not_started">Đã khóa</span>
                                  ) : (
                                    <span className="as-status submitted">Hoạt động</span>
                                  )}
                                </td>
                                <td>
                                  {isSelf ? (
                                    <span className="muted">—</span>
                                  ) : s && s.owner && String(s.owner.id) === String(u.id) ? (
                                    <span className="admin-owner-note" title="Xóa tài khoản chính bằng nút 🗑 Xóa trường">
                                      Tài khoản chính
                                    </span>
                                  ) : (
                                    <button className="revoke-btn" disabled={busyId === u.id} onClick={() => handleDeleteUser(u)}>
                                      Xóa
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}
