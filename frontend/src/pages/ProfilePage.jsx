// pages/ProfilePage.jsx — người dùng tự sửa thông tin cá nhân và đổi mật khẩu
import { useState } from "react";
import PasswordChecklist from "../components/common/PasswordChecklist";
import { passwordError } from "../utils/passwordPolicy";
import { useAuth } from "../context/AuthContext";
import { ROLE_ICON, ROLE_LABEL } from "../utils/permissions";
import { dateInputValue, formatDate } from "../utils/accountName";

const EMPTY_PW = { current: "", next: "", confirm: "" };

/** Độ mạnh mật khẩu 0–4 (độ dài, chữ hoa, số, ký tự đặc biệt) */
function strengthOf(pw) {
  if (!pw) return 0;
  let score = pw.length >= 8 ? 1 : 0;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.max(1, score);
}
const STRENGTH_LABEL = ["", "Yếu", "Trung bình", "Khá", "Mạnh"];

export default function ProfilePage() {
  const { user, updateProfile, changePassword } = useAuth();
  const [form, setForm] = useState(() => ({
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
    birthDate: dateInputValue(user?.birthDate),
  }));
  const [pw, setPw] = useState(EMPTY_PW);
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState("");
  const [toast, setToast] = useState(null);

  function showToast(msg, isError = false) {
    setToast({ msg, error: isError });
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(null), 3000);
  }

  const set = (field) => (e) => setForm((p) => ({ ...p, [field]: e.target.value }));
  const setP = (field) => (e) => setPw((p) => ({ ...p, [field]: e.target.value }));

  async function saveProfile(e) {
    e.preventDefault();
    if (!form.name.trim()) return showToast("Vui lòng nhập họ và tên.", true);
    setBusy("profile");
    try {
      await updateProfile({ ...form, name: form.name.trim(), birthDate: form.birthDate || null });
      showToast("Đã lưu thông tin cá nhân.");
    } catch (err) {
      showToast(err.message || "Không lưu được thông tin.", true);
    } finally {
      setBusy("");
    }
  }

  async function savePassword(e) {
    e.preventDefault();
    if (!pw.current || !pw.next) return showToast("Vui lòng nhập đủ mật khẩu hiện tại và mật khẩu mới.", true);
    const weak = passwordError(pw.next, user?.username);
    if (weak) return showToast(weak, true);
    if (pw.next !== pw.confirm) return showToast("Nhập lại mật khẩu mới chưa khớp.", true);
    setBusy("password");
    try {
      await changePassword(pw.current, pw.next);
      setPw(EMPTY_PW);
      showToast("Đã đổi mật khẩu.");
    } catch (err) {
      showToast(err.message || "Không đổi được mật khẩu.", true);
    } finally {
      setBusy("");
    }
  }

  const strength = strengthOf(pw.next);
  const initials = (user?.name || user?.username || "?")
    .split(" ")
    .filter(Boolean)
    .slice(-2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <div className="page profile-page">
      {toast && (
        <div className={"admin-toast" + (toast.error ? " admin-toast-error" : "")}>
          <span>{toast.error ? "!" : "✓"}</span>
          {toast.msg}
        </div>
      )}

      <div className="pf-hero">
        <span className="pf-avatar">{initials}</span>
        <div>
          <h2>{user?.name || user?.username}</h2>
          <p>
            <span className={"role-badge role-" + user?.role}>
              <span>{ROLE_ICON[user?.role]}</span>
              {ROLE_LABEL[user?.role]}
            </span>
            {user?.className && <span className="pf-chip">Lớp {user.className}</span>}
            {user?.school && <span className="pf-chip">{user.school.name}</span>}
          </p>
        </div>
      </div>

      {user?.mustChangePassword && (
        <div className="pf-warn">
          <span>🔐</span>
          <p>
            Tài khoản đang dùng <b>mật khẩu mặc định</b> do nhà trường cấp. Hãy đổi sang mật khẩu của riêng bạn để bảo
            mật tài khoản.
          </p>
        </div>
      )}

      <div className="pf-grid">
        <form className="as-card" onSubmit={saveProfile}>
          <div className="as-card-head">
            <span className="as-step">👤</span>
            <div>
              <h3>Thông tin cá nhân</h3>
              <p>Tên đăng nhập, chức danh và lớp do nhà trường quản lý.</p>
            </div>
          </div>
          <div className="as-form-grid">
            <label className="field">
              <span>Tên đăng nhập</span>
              <input value={user?.username || ""} disabled />
            </label>
            <label className="field">
              <span>Họ và tên</span>
              <input value={form.name} onChange={set("name")} disabled={!!busy} />
            </label>
            <label className="field">
              <span>Ngày sinh</span>
              <input type="date" value={form.birthDate} onChange={set("birthDate")} disabled={!!busy} />
            </label>
            <label className="field">
              <span>Số điện thoại</span>
              <input value={form.phone} onChange={set("phone")} inputMode="tel" disabled={!!busy} />
            </label>
            <label className="field as-span-2">
              <span>Email</span>
              <input type="email" value={form.email} onChange={set("email")} disabled={!!busy} />
            </label>
          </div>
          {user?.studentCode && <p className="hint">Mã học sinh: {user.studentCode}</p>}
          <div className="pf-actions">
            {user?.birthDate && <small>Ngày sinh hiện tại: {formatDate(user.birthDate)}</small>}
            <button className="btn btn-primary" type="submit" disabled={!!busy}>
              {busy === "profile" ? "Đang lưu..." : "Lưu thông tin"}
            </button>
          </div>
        </form>

        <form className="as-card" onSubmit={savePassword}>
          <div className="as-card-head">
            <span className="as-step">🔑</span>
            <div>
              <h3>Đổi mật khẩu</h3>
              <p>Ít nhất 6 ký tự; nên có chữ hoa, chữ thường, số và ký tự đặc biệt.</p>
            </div>
          </div>
          <div className="as-form-grid pf-one-col">
            <label className="field">
              <span>Mật khẩu hiện tại</span>
              <input
                type={showPw ? "text" : "password"}
                value={pw.current}
                onChange={setP("current")}
                autoComplete="current-password"
                disabled={!!busy}
              />
            </label>
            <label className="field">
              <span>Mật khẩu mới</span>
              <input
                type={showPw ? "text" : "password"}
                value={pw.next}
                onChange={setP("next")}
                autoComplete="new-password"
                disabled={!!busy}
              />
              {pw.next && (
                <span className={"pf-strength s" + strength}>
                  <i />
                  {STRENGTH_LABEL[strength]}
                </span>
              )}
              <PasswordChecklist password={pw.next} />
            </label>
            <label className={"field" + (pw.confirm && pw.confirm !== pw.next ? " warn" : "")}>
              <span>Nhập lại mật khẩu mới</span>
              <input
                type={showPw ? "text" : "password"}
                value={pw.confirm}
                onChange={setP("confirm")}
                autoComplete="new-password"
                disabled={!!busy}
              />
            </label>
            <label className="as-check">
              <input type="checkbox" checked={showPw} onChange={(e) => setShowPw(e.target.checked)} />
              Hiện mật khẩu
            </label>
          </div>
          <div className="pf-actions">
            <span />
            <button className="btn btn-primary" type="submit" disabled={!!busy}>
              {busy === "password" ? "Đang đổi..." : "Đổi mật khẩu"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
