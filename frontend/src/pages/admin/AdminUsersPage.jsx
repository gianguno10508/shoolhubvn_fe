// pages/admin/AdminUsersPage.jsx
import { useEffect, useState } from "react";
import { listUsers, grantVip, revokeVip, setUserRole } from "../../api/admin";
import { useAuth } from "../../context/AuthContext";
import { formatVipUntil } from "../../utils/permissions";

const ROLE_LABEL = {
  admin: "Admin",
  giao_vien: "Giáo viên",
  to_truong: "Tổ trưởng",
};

export default function AdminUsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [toast, setToast] = useState(null);

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

  useEffect(load, []);

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
    if (!window.confirm(`Thu hồi VIP của "${u.username}" ngay bây giờ?`))
      return;
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

  return (
    <div className="page">
      <div className="page-head">
        <h2>Quản lý tài khoản</h2>
      </div>

      {toast && (
        <div className={"toast" + (toast.error ? " toast-error" : "")}>
          {toast.msg}
        </div>
      )}

      {loading && <p className="hint">Đang tải...</p>}
      {!loading && error && (
        <p className="auth-error">
          {error}{" "}
          <button className="link-btn" onClick={load}>
            Thử lại
          </button>
        </p>
      )}

      {!loading && !error && (
        <table className="grid-table admin-table">
          <thead>
            <tr>
              <th>Tài khoản</th>
              <th>Họ tên</th>
              <th>Lớp</th>
              <th>Quyền</th>
              <th>Trạng thái VIP</th>
              <th className="w-act2">Hành động</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const busy = busyId === u.id;
              const isSelf = me && me.id === u.id;
              return (
                <tr key={u.id}>
                  <td>{u.username}</td>
                  <td>{u.name || <span className="muted">—</span>}</td>
                  <td>{u.className || <span className="muted">—</span>}</td>
                  <td>
                    <select
                      value={u.role}
                      disabled={busy || isSelf}
                      title={
                        isSelf ? "Không thể tự đổi quyền của chính mình" : ""
                      }
                      onChange={(e) => handleRoleChange(u, e.target.value)}
                    >
                      {Object.entries(ROLE_LABEL).map(([v, label]) => (
                        <option key={v} value={v}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    {u.role === "admin" ? (
                      <span className="ok-text">Không cần VIP (Admin)</span>
                    ) : u.isVip ? (
                      <span className="ok-text">
                        Còn hạn đến {formatVipUntil(u.vipUntil)}
                      </span>
                    ) : u.vipUntil ? (
                      <span className="bad-text">
                        Đã hết hạn ({formatVipUntil(u.vipUntil)})
                      </span>
                    ) : (
                      <span className="muted">Chưa có VIP</span>
                    )}
                  </td>
                  <td className="actions">
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={busy}
                      onClick={() => handleGrantVip(u, 1)}
                    >
                      +1 năm
                    </button>
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={busy}
                      onClick={() => handleGrantVip(u, 2)}
                    >
                      +2 năm
                    </button>
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={busy}
                      onClick={() => handleGrantVip(u, 3)}
                    >
                      +3 năm
                    </button>
                    {(u.isVip || u.vipUntil) && (
                      <button
                        className="btn btn-danger btn-sm"
                        disabled={busy}
                        onClick={() => handleRevoke(u)}
                      >
                        Thu hồi
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
