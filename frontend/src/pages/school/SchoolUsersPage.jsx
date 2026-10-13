// pages/school/SchoolUsersPage.jsx
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  listSchoolUsers,
  createSchoolUser,
  updateSchoolUser,
  deleteSchoolUser,
  listClasses,
  createClass,
  deleteClass,
} from "../../api/school";
import {
  ROLE_LABEL,
  ROLE_ICON,
  ROLES_WITH_CLASS,
  hasPermission,
  formatVipUntil,
} from "../../utils/permissions";

const EMPTY_USER = { username: "", password: "", name: "", role: "", classId: "", studentCode: "" };
const EMPTY_CLASS = { name: "", grade: "" };

/* Tài khoản trường xem + tạo tài khoản cho mọi chức danh trong trường.
 * GVCN chỉ thấy và tạo được tài khoản học sinh của lớp mình. */
export default function SchoolUsersPage() {
  const { user: me } = useAuth();

  const canManageUsers = hasPermission(me, "users.manage");
  const canManageClasses = hasPermission(me, "classes.manage");
  const creatableRoles = me?.creatableRoles || [];
  const canCreate = creatableRoles.length > 0 && me?.isVip;

  const [users, setUsers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(false);

  const [userForm, setUserForm] = useState({ ...EMPTY_USER, role: creatableRoles[0] || "" });
  const [classForm, setClassForm] = useState(EMPTY_CLASS);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  function showToast(msg, isError = false) {
    setToast({ msg, error: isError });
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(null), 2600);
  }

  function load() {
    setLoading(true);
    setError("");
    Promise.all([listSchoolUsers(), listClasses()])
      .then(([u, c]) => {
        setUsers(u);
        setClasses(c);
      })
      .catch((err) => setError(err.message || "Không tải được dữ liệu của trường."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function run(action, successMsg) {
    setBusy(true);
    try {
      await action();
      showToast(successMsg);
      return true;
    } catch (err) {
      showToast(err.message || "Có lỗi xảy ra.", true);
      return false;
    } finally {
      setBusy(false);
    }
  }

  const setU = (field, value) => setUserForm((prev) => ({ ...prev, [field]: value }));
  const needsClass = ROLES_WITH_CLASS.includes(userForm.role);

  async function handleCreateUser(e) {
    e.preventDefault();
    if (!userForm.username.trim() || !userForm.password) {
      showToast("Vui lòng nhập tên đăng nhập và mật khẩu.", true);
      return;
    }
    if (needsClass && canManageUsers && !userForm.classId) {
      showToast("Chức danh này cần chọn lớp.", true);
      return;
    }
    const ok = await run(async () => {
      const created = await createSchoolUser({
        ...userForm,
        username: userForm.username.trim(),
        name: userForm.name.trim(),
        classId: needsClass ? userForm.classId || undefined : undefined,
      });
      setUsers((prev) => [created, ...prev]);
    }, `Đã tạo tài khoản ${userForm.username.trim()}.`);
    if (ok) {
      setUserForm((prev) => ({ ...EMPTY_USER, role: prev.role, classId: prev.classId }));
      if (userForm.role === "homeroom_teacher") load(); // cập nhật GVCN ở danh sách lớp
    }
  }

  function handleToggleLock(u) {
    const status = u.status === "locked" ? "active" : "locked";
    run(async () => {
      const updated = await updateSchoolUser(u.id, { status });
      setUsers((prev) => prev.map((x) => (x.id === u.id ? updated : x)));
    }, status === "locked" ? `Đã khóa ${u.username}.` : `Đã mở khóa ${u.username}.`);
  }

  function handleResetPassword(u) {
    const password = window.prompt(`Nhập mật khẩu mới cho "${u.username}":`);
    if (!password) return;
    run(() => updateSchoolUser(u.id, { password }), `Đã đặt lại mật khẩu cho ${u.username}.`);
  }

  function handleDeleteUser(u) {
    if (!window.confirm(`Xóa vĩnh viễn tài khoản "${u.username}"?`)) return;
    run(async () => {
      await deleteSchoolUser(u.id);
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
    }, `Đã xóa ${u.username}.`);
  }

  async function handleCreateClass(e) {
    e.preventDefault();
    if (!classForm.name.trim()) {
      showToast("Vui lòng nhập tên lớp.", true);
      return;
    }
    const ok = await run(async () => {
      const created = await createClass(classForm);
      setClasses((prev) => [...prev, created]);
    }, `Đã tạo lớp ${classForm.name.trim()}.`);
    if (ok) setClassForm(EMPTY_CLASS);
  }

  function handleDeleteClass(c) {
    if (!window.confirm(`Xóa lớp "${c.name}"?`)) return;
    run(async () => {
      await deleteClass(c.id);
      setClasses((prev) => prev.filter((x) => x.id !== c.id));
    }, `Đã xóa lớp ${c.name}.`);
  }

  const filteredUsers = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return users.filter((u) => {
      const matchesSearch =
        !keyword ||
        u.username?.toLowerCase().includes(keyword) ||
        u.name?.toLowerCase().includes(keyword) ||
        u.className?.toLowerCase().includes(keyword);
      return matchesSearch && (roleFilter === "all" || u.role === roleFilter);
    });
  }, [users, search, roleFilter]);

  const canEdit = (u) =>
    u.id !== me.id &&
    creatableRoles.includes(u.role) &&
    (canManageUsers || (me.classId && u.classId === me.classId));

  return (
    <div className="page admin-users-page">
      <div className="admin-page-header">
        <div>
          <div className="admin-eyebrow">{me.school?.name || "TRƯỜNG"}</div>
          <h2>{canManageUsers ? "Tài khoản của trường" : `Học sinh lớp ${me.className || ""}`}</h2>
          <p>
            {me.isVip
              ? `VIP của trường còn hạn đến ${formatVipUntil(me.vipUntil)}.`
              : "Trường chưa có hoặc đã hết hạn VIP — chỉ xem được, không tạo / sửa tài khoản."}
          </p>
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

      {loading && (
        <div className="admin-loading">
          <div className="admin-spinner"></div>
          <span>Đang tải dữ liệu của trường...</span>
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
          {/* ===== Lớp học ===== */}
          {canManageClasses && (
            <div className="admin-users-panel">
              <div className="admin-toolbar">
                <div className="admin-toolbar-title">
                  <div>
                    <h3>Lớp học</h3>
                    <span>{classes.length} lớp</span>
                  </div>
                </div>
                {me.isVip && (
                  <form className="admin-filters" onSubmit={handleCreateClass}>
                    <input
                      value={classForm.name}
                      onChange={(e) => setClassForm((p) => ({ ...p, name: e.target.value }))}
                      placeholder="Tên lớp, ví dụ 10A1"
                      disabled={busy}
                    />
                    <input
                      value={classForm.grade}
                      onChange={(e) => setClassForm((p) => ({ ...p, grade: e.target.value }))}
                      placeholder="Khối, ví dụ Khối 10"
                      disabled={busy}
                    />
                    <button className="btn btn-primary" type="submit" disabled={busy}>
                      + Thêm lớp
                    </button>
                  </form>
                )}
              </div>
              <div className="admin-table-wrap">
                <table className="admin-users-table">
                  <thead>
                    <tr>
                      <th>Lớp</th>
                      <th>Khối</th>
                      <th>Giáo viên chủ nhiệm</th>
                      <th className="admin-action-head">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classes.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="admin-empty">
                          Chưa có lớp nào. Hãy tạo lớp trước khi tạo tài khoản GVCN / học sinh.
                        </td>
                      </tr>
                    ) : (
                      classes.map((c) => (
                        <tr key={c.id}>
                          <td>
                            <strong>{c.name}</strong>
                          </td>
                          <td>{c.grade || "—"}</td>
                          <td>{c.homeroomTeacher ? c.homeroomTeacher.name || c.homeroomTeacher.username : "Chưa có"}</td>
                          <td>
                            {me.isVip && (
                              <button className="revoke-btn" disabled={busy} onClick={() => handleDeleteClass(c)}>
                                Xóa lớp
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ===== Tạo tài khoản ===== */}
          {canCreate && (
            <div className="admin-users-panel">
              <div className="admin-toolbar">
                <div className="admin-toolbar-title">
                  <div>
                    <h3>Tạo tài khoản mới</h3>
                    <span>
                      {canManageUsers
                        ? "Mỗi chức danh có quyền riêng trong hệ thống"
                        : `Tài khoản học sinh cho lớp ${me.className || ""}`}
                    </span>
                  </div>
                </div>
                <form className="admin-filters" onSubmit={handleCreateUser}>
                  <input
                    value={userForm.username}
                    onChange={(e) => setU("username", e.target.value)}
                    placeholder="Tên đăng nhập"
                    autoComplete="off"
                    disabled={busy}
                  />
                  <input
                    type="password"
                    value={userForm.password}
                    onChange={(e) => setU("password", e.target.value)}
                    placeholder="Mật khẩu"
                    autoComplete="new-password"
                    disabled={busy}
                  />
                  <input
                    value={userForm.name}
                    onChange={(e) => setU("name", e.target.value)}
                    placeholder="Họ và tên"
                    disabled={busy}
                  />
                  {creatableRoles.length > 1 && (
                    <select value={userForm.role} onChange={(e) => setU("role", e.target.value)} disabled={busy}>
                      {creatableRoles.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </option>
                      ))}
                    </select>
                  )}
                  {needsClass && canManageUsers && (
                    <select value={userForm.classId} onChange={(e) => setU("classId", e.target.value)} disabled={busy}>
                      <option value="">— Chọn lớp —</option>
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  )}
                  {userForm.role === "student" && (
                    <input
                      value={userForm.studentCode}
                      onChange={(e) => setU("studentCode", e.target.value)}
                      placeholder="Mã học sinh (không bắt buộc)"
                      disabled={busy}
                    />
                  )}
                  <button className="btn btn-primary" type="submit" disabled={busy}>
                    + Tạo tài khoản
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* ===== Danh sách tài khoản ===== */}
          <div className="admin-users-panel">
            <div className="admin-toolbar">
              <div className="admin-toolbar-title">
                <div>
                  <h3>Danh sách tài khoản</h3>
                  <span>{filteredUsers.length} tài khoản</span>
                </div>
              </div>
              <div className="admin-filters">
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
                <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                  <option value="all">Tất cả chức danh</option>
                  {Object.entries(ROLE_LABEL)
                    .filter(([value]) => value !== "admin")
                    .map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="admin-table-wrap">
              <table className="admin-users-table">
                <thead>
                  <tr>
                    <th>Tài khoản</th>
                    <th>Họ tên</th>
                    <th>Chức danh</th>
                    <th>Lớp</th>
                    <th>Trạng thái</th>
                    <th className="admin-action-head">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="admin-empty">
                        Không có tài khoản phù hợp.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => (
                      <tr key={u.id}>
                        <td>
                          <div className="user-account">
                            <div className="user-avatar">{(u.name || u.username || "?").charAt(0).toUpperCase()}</div>
                            <div>
                              <strong>{u.username}</strong>
                              {u.id === me.id && <span className="self-badge">Bạn</span>}
                            </div>
                          </div>
                        </td>
                        <td>{u.name || "Chưa cập nhật"}</td>
                        <td>
                          <span className={"role-badge role-" + u.role}>
                            <span>{ROLE_ICON[u.role]}</span>
                            {ROLE_LABEL[u.role]}
                          </span>
                        </td>
                        <td>{u.className || "—"}</td>
                        <td>{u.status === "locked" ? "Đã khóa" : "Hoạt động"}</td>
                        <td>
                          {me.isVip && canEdit(u) && (
                            <div className="user-actions">
                              <button disabled={busy} onClick={() => handleResetPassword(u)}>
                                Đặt lại mật khẩu
                              </button>
                              <button disabled={busy} onClick={() => handleToggleLock(u)}>
                                {u.status === "locked" ? "Mở khóa" : "Khóa"}
                              </button>
                              <button className="revoke-btn" disabled={busy} onClick={() => handleDeleteUser(u)}>
                                Xóa
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
