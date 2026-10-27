// pages/ProfilePage.jsx — người dùng tự sửa thông tin cá nhân và đổi mật khẩu
import { useState } from "react";
import PasswordChecklist from "../components/common/PasswordChecklist";
import { passwordError } from "../utils/passwordPolicy";
import { useAuth } from "../context/AuthContext";
import { ROLE_ICON, ROLE_LABEL } from "../utils/permissions";
import { dateInputValue, formatDate } from "../utils/accountName";
import { DateInput } from "../components/DateInput";
import {
  AtSign,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LockKeyhole,
  Save,
  School,
  ShieldAlert,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";

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

  const defaultPw = !!user?.mustChangePassword;

  return (
    <div className="page profile-page">
      {toast && (
        <div className={"admin-toast" + (toast.error ? " admin-toast-error" : "")}>
          <span>{toast.error ? "!" : "✓"}</span>
          {toast.msg}
        </div>
      )}

      <section className="pf-hero">
        <div className="pf-hero-main">
          <span className="pf-avatar">{initials}</span>
          <div className="pf-hero-text">
            <h2>{user?.name || user?.username}</h2>
            <p>
              <span className="pf-chip pf-chip-strong">
                <span>{ROLE_ICON[user?.role]}</span>
                {ROLE_LABEL[user?.role]}
              </span>
              {user?.className && (
                <span className="pf-chip">
                  <Users size={13} /> Lớp {user.className}
                </span>
              )}
              {user?.school && (
                <span className="pf-chip">
                  <School size={13} /> {user.school.name}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="pf-hero-stats">
          <div>
            <AtSign size={16} />
            <span>Tên đăng nhập</span>
            <strong>{user?.username}</strong>
          </div>
          <div className={defaultPw ? "warn" : "ok"}>
            {defaultPw ? <ShieldAlert size={16} /> : <ShieldCheck size={16} />}
            <span>Bảo mật</span>
            <strong>{defaultPw ? "Mật khẩu mặc định" : "Đã đặt mật khẩu riêng"}</strong>
          </div>
        </div>
      </section>

      {defaultPw && (
        <div className="pf-warn">
          <span className="pf-warn-icon">
            <ShieldAlert size={20} />
          </span>
          <p>
            Tài khoản đang dùng <b>mật khẩu mặc định</b> do nhà trường cấp. Hãy đổi sang mật khẩu của riêng bạn để bảo
            mật tài khoản.
          </p>
        </div>
      )}

      <div className="pf-grid">
        <form className="pf-card" onSubmit={saveProfile}>
          <header className="pf-card-head">
            <span className="pf-card-icon">
              <UserRound size={20} />
            </span>
            <div>
              <h3>Thông tin cá nhân</h3>
              <p>Tên đăng nhập, chức danh và lớp do nhà trường quản lý.</p>
            </div>
          </header>

          <div className="pf-form">
            <label className="field">
              <span>Tên đăng nhập</span>
              <input value={user?.username || ""} disabled />
            </label>
            <label className="field">
              <span>Họ và tên</span>
              <input value={form.name} onChange={set("name")} disabled={!!busy} placeholder="Nguyễn Văn A" />
            </label>
            <label className="field">
              <span>Ngày sinh</span>
              <DateInput value={form.birthDate} onChange={set("birthDate")} disabled={!!busy} />
            </label>
            <label className="field">
              <span>Số điện thoại</span>
              <input value={form.phone} onChange={set("phone")} inputMode="tel" disabled={!!busy} placeholder="09xx xxx xxx" />
            </label>
            <label className="field pf-span-2">
              <span>Email</span>
              <input
                type="email"
                value={form.email}
                onChange={set("email")}
                disabled={!!busy}
                placeholder="ten@email.com"
              />
            </label>
          </div>

          <footer className="pf-actions">
            <small>
              {user?.studentCode && <>Mã học sinh: <b>{user.studentCode}</b> · </>}
              {user?.birthDate ? <>Ngày sinh hiện tại: {formatDate(user.birthDate)}</> : "Thông tin chỉ nhà trường xem được."}
            </small>
            <button className="btn btn-primary" type="submit" disabled={!!busy}>
              {busy === "profile" ? <Loader2 size={16} className="ai-spin-icon" /> : <Save size={16} />}
              {busy === "profile" ? "Đang lưu..." : "Lưu thông tin"}
            </button>
          </footer>
        </form>

        <form className="pf-card pf-security" onSubmit={savePassword}>
          <header className="pf-card-head">
            <span className="pf-card-icon green">
              <LockKeyhole size={20} />
            </span>
            <div>
              <h3>Bảo mật & mật khẩu</h3>
              <p>Đổi mật khẩu định kỳ và không chia sẻ cho người khác.</p>
            </div>
          </header>

          <div className="pf-form pf-one-col">
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
          </div>

          <footer className="pf-actions">
            <label className="pf-check">
              <input type="checkbox" checked={showPw} onChange={(e) => setShowPw(e.target.checked)} />
              {showPw ? <EyeOff size={15} /> : <Eye size={15} />} Hiện mật khẩu
            </label>
            <button className="btn btn-primary" type="submit" disabled={!!busy}>
              {busy === "password" ? <Loader2 size={16} className="ai-spin-icon" /> : <KeyRound size={16} />}
              {busy === "password" ? "Đang đổi..." : "Đổi mật khẩu"}
            </button>
          </footer>

          <ul className="pf-tips">
            <li>
              <ShieldCheck size={15} /> Đăng xuất khi dùng máy tính chung.
            </li>
            <li>
              <ShieldCheck size={15} /> Không dùng lại mật khẩu của tài khoản khác.
            </li>
          </ul>
        </form>
      </div>
    </div>
  );
}
