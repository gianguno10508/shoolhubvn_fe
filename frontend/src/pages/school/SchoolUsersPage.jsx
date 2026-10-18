// pages/school/SchoolUsersPage.jsx
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  listSchoolUsers,
  createSchoolUser,
  bulkCreateSchoolUsers,
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
import { DEFAULT_PASSWORD, dateInputValue, formatDate, parseAccountList, previewUsername } from "../../utils/accountName";
import { exportAccountsExcel } from "../../utils/accountExport";

const EMPTY_USER = { username: "", password: "", name: "", birthDate: "", role: "", classId: "", studentCode: "" };
const EMPTY_CLASS = { name: "", grade: "" };

/* Tài khoản trường xem + tạo tài khoản cho mọi chức danh trong trường (mặc định: giáo viên).
 * GVCN chỉ thấy và tạo được tài khoản học sinh của lớp mình.
 * Tên đăng nhập tự sinh từ họ tên + ngày sinh (Nguyễn Văn An, 22/10/2011 → nvan2211), mật khẩu mặc định Abc@123. */
export default function SchoolUsersPage() {
  const { user: me } = useAuth();

  // Không giới hạn theo lớp: tài khoản trường (mọi chức danh), BGH (chỉ giáo viên — theo creatableRoles)
  const canManageUsers = hasPermission(me, "users.manage") || hasPermission(me, "users.manage_teachers");
  const canManageClasses = hasPermission(me, "classes.manage");
  const creatableRoles = me?.creatableRoles || [];
  const canCreate = creatableRoles.length > 0 && me?.isVip;
  const defaultRole = creatableRoles.includes("teacher") ? "teacher" : creatableRoles[0] || "";

  const [users, setUsers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(false);

  const [userForm, setUserForm] = useState({ ...EMPTY_USER, role: defaultRole });
  const [createMode, setCreateMode] = useState("single"); // single | bulk
  const [lastCreated, setLastCreated] = useState(null); // tài khoản vừa tạo (hiện tên đăng nhập + mật khẩu)
  const [bulkText, setBulkText] = useState("");
  const [bulkResult, setBulkResult] = useState(null); // { created, errors }
  const [editing, setEditing] = useState(null);
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

  const usernamePreview = userForm.username.trim() || previewUsername(userForm.name, userForm.birthDate);
  const bulkRows = useMemo(() => parseAccountList(bulkText), [bulkText]);
  const bulkValid = bulkRows.filter((r) => !r.error);

  /** Chức danh + lớp dùng chung cho cả tạo từng tài khoản và tạo hàng loạt */
  function targetOf(form) {
    return {
      role: form.role || defaultRole,
      classId: ROLES_WITH_CLASS.includes(form.role) ? form.classId || undefined : undefined,
    };
  }

  function checkTarget() {
    if (needsClass && canManageUsers && !userForm.classId) {
      showToast("Chức danh này cần chọn lớp.", true);
      return false;
    }
    return true;
  }

  async function handleCreateUser(e) {
    e.preventDefault();
    if (!userForm.name.trim()) return showToast("Vui lòng nhập họ và tên.", true);
    if (!userForm.username.trim() && !userForm.birthDate) {
      return showToast("Vui lòng nhập ngày sinh để tạo tên đăng nhập.", true);
    }
    if (!checkTarget()) return;
    let created = null;
    const ok = await run(async () => {
      created = await createSchoolUser({
        ...userForm,
        ...targetOf(userForm),
        username: userForm.username.trim(),
        name: userForm.name.trim(),
        birthDate: userForm.birthDate || undefined,
      });
      setUsers((prev) => [created, ...prev]);
    }, "Đã tạo tài khoản.");
    if (ok) {
      setLastCreated({ ...created, password: userForm.password || DEFAULT_PASSWORD });
      setUserForm((prev) => ({ ...EMPTY_USER, role: prev.role, classId: prev.classId }));
      if (created.role === "homeroom_teacher") load(); // cập nhật GVCN ở danh sách lớp
    }
  }

  async function handleBulkCreate() {
    if (!bulkValid.length) return showToast("Chưa có dòng hợp lệ (cần họ tên + ngày sinh).", true);
    if (!checkTarget()) return;
    let result = null;
    const ok = await run(async () => {
      result = await bulkCreateSchoolUsers({
        ...targetOf(userForm),
        users: bulkValid.map(({ name, birthDate, studentCode }) => ({ name, birthDate, studentCode })),
      });
      setUsers((prev) => [...result.created, ...prev]);
    }, "Đã tạo tài khoản hàng loạt.");
    if (ok) {
      setBulkResult(result);
      if (!result.errors.length) setBulkText("");
    }
  }

  function exportList(list, title, fileName) {
    exportAccountsExcel({ users: list, title, schoolName: me.school?.name || "", fileName }).catch((err) =>
      showToast(err.message || "Không xuất được file Excel.", true),
    );
  }

  function copyCredentials(u) {
    const text = `Tên đăng nhập: ${u.username}\nMật khẩu: ${u.password || DEFAULT_PASSWORD}`;
    navigator.clipboard?.writeText(text).then(
      () => showToast("Đã sao chép tên đăng nhập và mật khẩu."),
      () => showToast("Trình duyệt không cho sao chép.", true),
    );
  }

  function handleToggleLock(u) {
    const status = u.status === "locked" ? "active" : "locked";
    run(async () => {
      const updated = await updateSchoolUser(u.id, { status });
      setUsers((prev) => prev.map((x) => (x.id === u.id ? updated : x)));
    }, status === "locked" ? `Đã khóa ${u.username}.` : `Đã mở khóa ${u.username}.`);
  }

  function handleResetPassword(u) {
    if (!window.confirm(`Đặt lại mật khẩu của "${u.username}" về mặc định ${DEFAULT_PASSWORD}?`)) return;
    run(async () => {
      const updated = await updateSchoolUser(u.id, { resetPassword: true });
      setUsers((prev) => prev.map((x) => (x.id === u.id ? updated : x)));
    }, `Mật khẩu của ${u.username} đã về ${DEFAULT_PASSWORD}.`);
  }

  function openEdit(u) {
    setEditing({
      id: u.id,
      username: u.username,
      name: u.name || "",
      birthDate: dateInputValue(u.birthDate),
      studentCode: u.studentCode || "",
      role: u.role,
      classId: u.classId || "",
    });
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!editing.name.trim()) return showToast("Vui lòng nhập họ và tên.", true);
    const payload = {
      name: editing.name.trim(),
      birthDate: editing.birthDate || null,
      studentCode: editing.studentCode.trim(),
    };
    if (canManageUsers) {
      payload.role = editing.role;
      if (ROLES_WITH_CLASS.includes(editing.role)) {
        if (!editing.classId) return showToast("Chức danh này cần chọn lớp.", true);
        payload.classId = editing.classId;
      }
    }
    const ok = await run(async () => {
      const updated = await updateSchoolUser(editing.id, payload);
      setUsers((prev) => prev.map((x) => (x.id === editing.id ? updated : x)));
    }, `Đã cập nhật ${editing.username}.`);
    if (ok) {
      setEditing(null);
      if (canManageClasses) load(); // GVCN của lớp có thể đã đổi
    }
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
                        ? "Mặc định là Giáo viên — đổi chức danh sau bằng nút Sửa nếu cần"
                        : `Tài khoản học sinh cho lớp ${me.className || ""}`}
                      {` · tên đăng nhập tự tạo từ họ tên + ngày sinh · mật khẩu ${DEFAULT_PASSWORD}`}
                    </span>
                  </div>
                </div>
              </div>

              <div className="acc-body">
                <div className="acc-tabs">
                  <button type="button" className={createMode === "single" ? "active" : ""} onClick={() => setCreateMode("single")}>
                    Từng tài khoản
                  </button>
                  <button type="button" className={createMode === "bulk" ? "active" : ""} onClick={() => setCreateMode("bulk")}>
                    Hàng loạt (dán danh sách)
                  </button>
                </div>

                {/* Chức danh + lớp dùng chung cho cả 2 cách tạo */}
                <div className="acc-grid">
                  {createMode === "single" && (
                    <>
                      <label className="field">
                        <span>Họ và tên</span>
                        <input
                          value={userForm.name}
                          onChange={(e) => setU("name", e.target.value)}
                          placeholder="Nguyễn Văn An"
                          disabled={busy}
                        />
                      </label>
                      <label className="field">
                        <span>Ngày sinh</span>
                        <input
                          type="date"
                          value={userForm.birthDate}
                          onChange={(e) => setU("birthDate", e.target.value)}
                          disabled={busy}
                        />
                      </label>
                    </>
                  )}
                  {creatableRoles.length > 1 && (
                    <label className="field">
                      <span>Chức danh</span>
                      <select value={userForm.role} onChange={(e) => setU("role", e.target.value)} disabled={busy}>
                        {creatableRoles.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABEL[r]}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {needsClass && canManageUsers && (
                    <label className="field">
                      <span>Lớp</span>
                      <select value={userForm.classId} onChange={(e) => setU("classId", e.target.value)} disabled={busy}>
                        <option value="">— Chọn lớp —</option>
                        {classes.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {createMode === "single" && userForm.role === "student" && (
                    <label className="field">
                      <span>Mã học sinh</span>
                      <input
                        value={userForm.studentCode}
                        onChange={(e) => setU("studentCode", e.target.value)}
                        placeholder="Không bắt buộc"
                        disabled={busy}
                      />
                    </label>
                  )}
                </div>

                {createMode === "single" ? (
                  <form onSubmit={handleCreateUser}>
                    <details className="acc-more">
                      <summary>Tự đặt tên đăng nhập / mật khẩu (không bắt buộc)</summary>
                      <div className="acc-grid">
                        <label className="field">
                          <span>Tên đăng nhập</span>
                          <input
                            value={userForm.username}
                            onChange={(e) => setU("username", e.target.value.toLowerCase().replace(/\s/g, ""))}
                            placeholder="Để trống = tự tạo"
                            autoComplete="off"
                            disabled={busy}
                          />
                        </label>
                        <label className="field">
                          <span>Mật khẩu</span>
                          <input
                            value={userForm.password}
                            onChange={(e) => setU("password", e.target.value)}
                            placeholder={`Để trống = ${DEFAULT_PASSWORD}`}
                            autoComplete="new-password"
                            disabled={busy}
                          />
                        </label>
                      </div>
                    </details>

                    <div className="acc-preview">
                      <span>
                        Tên đăng nhập: <code>{usernamePreview || "—"}</code>
                      </span>
                      <span>
                        Mật khẩu: <code>{userForm.password || DEFAULT_PASSWORD}</code>
                      </span>
                      <button className="btn btn-primary" type="submit" disabled={busy}>
                        + Tạo tài khoản
                      </button>
                    </div>
                    {!userForm.username.trim() && usernamePreview && (
                      <p className="hint">
                        Nếu tên đăng nhập đã có người dùng, hệ thống tự thêm số phía sau (ví dụ {usernamePreview}2).
                      </p>
                    )}

                    {lastCreated && (
                      <div className="acc-result">
                        <div className="acc-result-head">
                          <strong>✓ Đã tạo: {lastCreated.name}</strong>
                          <span>
                            Tên đăng nhập <b>{lastCreated.username}</b> · Mật khẩu <b>{lastCreated.password}</b>
                          </span>
                          <span className="spacer" />
                          <button type="button" className="btn btn-sm btn-light" onClick={() => copyCredentials(lastCreated)}>
                            Sao chép
                          </button>
                          <button type="button" className="btn btn-sm btn-light" onClick={() => setLastCreated(null)}>
                            Đóng
                          </button>
                        </div>
                      </div>
                    )}
                  </form>
                ) : (
                  <div>
                    <label className="field acc-more">
                      <span>
                        Dán danh sách từ Excel / Word — mỗi dòng: <b>Họ và tên</b>, <b>Ngày sinh</b> (dd/mm/yyyy)
                        {userForm.role === "student" ? ", Mã HS (không bắt buộc)" : ""}
                      </span>
                      <textarea
                        className="acc-paste"
                        value={bulkText}
                        onChange={(e) => {
                          setBulkText(e.target.value);
                          setBulkResult(null);
                        }}
                        placeholder={"Nguyễn Văn An\t22/10/2011\nTrần Thị Bình\t05/03/2011"}
                        disabled={busy}
                      />
                    </label>

                    {bulkRows.length > 0 && (
                      <div className="admin-table-wrap acc-bulk-table">
                        <table className="admin-users-table">
                          <thead>
                            <tr>
                              <th>#</th>
                              <th>Họ và tên</th>
                              <th>Ngày sinh</th>
                              {userForm.role === "student" && <th>Mã HS</th>}
                              <th>Tên đăng nhập dự kiến</th>
                            </tr>
                          </thead>
                          <tbody>
                            {bulkRows.map((r, i) => (
                              <tr key={i}>
                                <td>{i + 1}</td>
                                <td>{r.name || "—"}</td>
                                <td>{formatDate(r.birthDate) || "—"}</td>
                                {userForm.role === "student" && <td>{r.studentCode || "—"}</td>}
                                <td className={r.error ? "bad-text" : ""}>
                                  {r.error || <code>{previewUsername(r.name, r.birthDate)}</code>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    <div className="acc-preview">
                      <span>
                        {bulkValid.length} dòng hợp lệ
                        {bulkRows.length > bulkValid.length && ` · ${bulkRows.length - bulkValid.length} dòng lỗi sẽ bỏ qua`}
                        {" · "}chức danh <b>{ROLE_LABEL[userForm.role]}</b> · mật khẩu <code>{DEFAULT_PASSWORD}</code>
                      </span>
                      <button
                        className="btn btn-primary"
                        type="button"
                        onClick={handleBulkCreate}
                        disabled={busy || !bulkValid.length}
                      >
                        + Tạo {bulkValid.length || ""} tài khoản
                      </button>
                    </div>

                    {bulkResult && (
                      <div className="acc-result">
                        <div className="acc-result-head">
                          <strong>✓ Đã tạo {bulkResult.created.length} tài khoản</strong>
                          <span className="spacer" />
                          {bulkResult.created.length > 0 && (
                            <button
                              type="button"
                              className="btn btn-sm btn-export"
                              onClick={() => exportList(bulkResult.created, "TÀI KHOẢN VỪA TẠO", "Tai-khoan-moi.xlsx")}
                            >
                              ⤓ Tải danh sách tài khoản (Excel)
                            </button>
                          )}
                        </div>
                        {bulkResult.errors.length > 0 && (
                          <ul>
                            {bulkResult.errors.map((e) => (
                              <li key={e.index}>
                                {e.name || `Dòng ${e.index + 1}`}: {e.error}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                )}
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
                <button
                  type="button"
                  className="btn btn-export"
                  disabled={!filteredUsers.length}
                  onClick={() => exportList(filteredUsers, "DANH SÁCH TÀI KHOẢN", "Danh-sach-tai-khoan.xlsx")}
                >
                  ⤓ Excel
                </button>
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
                    <th>Ngày sinh</th>
                    <th>Chức danh</th>
                    <th>Lớp</th>
                    <th>Trạng thái</th>
                    <th className="admin-action-head">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="admin-empty">
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
                        <td>{formatDate(u.birthDate) || "—"}</td>
                        <td>
                          <span className={"role-badge role-" + u.role}>
                            <span>{ROLE_ICON[u.role]}</span>
                            {ROLE_LABEL[u.role]}
                          </span>
                        </td>
                        <td>{u.className || "—"}</td>
                        <td>
                          {u.status === "locked" ? "Đã khóa" : "Hoạt động"}
                          {u.mustChangePassword && (
                            <small className="acc-default-pw" title={`Vẫn dùng mật khẩu mặc định ${DEFAULT_PASSWORD}`}>
                              {" "}
                              · MK mặc định
                            </small>
                          )}
                        </td>
                        <td>
                          {me.isVip && canEdit(u) && (
                            <div className="user-actions">
                              <button disabled={busy} onClick={() => openEdit(u)}>
                                Sửa
                              </button>
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

      {editing && (
        <div className="modal-backdrop" onClick={() => !busy && setEditing(null)}>
          <form className="modal modal-sm" onClick={(e) => e.stopPropagation()} onSubmit={saveEdit}>
            <div className="modal-head">
              <h3>Sửa tài khoản {editing.username}</h3>
            </div>
            <div className="as-form-grid">
              <label className="field as-span-2">
                <span>Họ và tên</span>
                <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </label>
              <label className="field">
                <span>Ngày sinh</span>
                <input
                  type="date"
                  value={editing.birthDate}
                  onChange={(e) => setEditing({ ...editing, birthDate: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Mã học sinh</span>
                <input
                  value={editing.studentCode}
                  onChange={(e) => setEditing({ ...editing, studentCode: e.target.value })}
                  placeholder="Không bắt buộc"
                />
              </label>
              {canManageUsers && (
                <label className="field">
                  <span>Chức danh</span>
                  <select value={editing.role} onChange={(e) => setEditing({ ...editing, role: e.target.value })}>
                    {creatableRoles.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {canManageUsers && ROLES_WITH_CLASS.includes(editing.role) && (
                <label className="field">
                  <span>Lớp</span>
                  <select value={editing.classId} onChange={(e) => setEditing({ ...editing, classId: e.target.value })}>
                    <option value="">— Chọn lớp —</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <p className="hint">Tên đăng nhập giữ nguyên khi đổi họ tên / ngày sinh.</p>
            <div className="btn-row modal-actions">
              <button type="button" className="btn btn-light" onClick={() => setEditing(null)} disabled={busy}>
                Hủy
              </button>
              <button className="btn btn-primary" type="submit" disabled={busy}>
                Lưu
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
