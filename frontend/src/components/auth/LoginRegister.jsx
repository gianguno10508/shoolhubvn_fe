import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import Field from "../common/Field";

export default function LoginRegister() {
  const { login, register } = useAuth();

  const [mode, setMode] = useState("login");
  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState({
    username: "",
    password: "",
    name: "",
    className: "",
  });

  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const switchMode = () => {
    setMode((prev) => (prev === "login" ? "register" : "login"));
    setError("");
    setShowPassword(false);
  };

  async function submit(e) {
    e.preventDefault();
    setError("");

    if (!form.username.trim() || !form.password) {
      setError("Vui lòng nhập tên đăng nhập và mật khẩu.");
      return;
    }

    if (mode === "register" && !form.name.trim()) {
      setError("Vui lòng nhập họ và tên.");
      return;
    }

    setBusy(true);

    try {
      if (mode === "login") {
        await login(form.username.trim(), form.password);
      } else {
        await register({
          username: form.username.trim(),
          password: form.password,
          name: form.name.trim(),
          className: form.className.trim(),
        });
      }
    } catch (err) {
      setError(err.message || "Có lỗi xảy ra, vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }

  const isLogin = mode === "login";

  return (
    <div className="auth-page">
      {/* Background decoration */}
      <div className="auth-bg auth-bg-1"></div>
      <div className="auth-bg auth-bg-2"></div>

      <div className="auth-container">
        {/* Brand / intro */}
        <div className="auth-intro">
          <div className="auth-logo">
            <span>📅</span>
          </div>

          <h1>
            Thời khóa biểu
            <br />
            <span>thông minh</span>
          </h1>

          <p>
            Quản lý và xây dựng thời khóa biểu thuận tiện, nhanh chóng và hiệu
            quả.
          </p>

          <div className="auth-features">
            <div>
              <span>✓</span>
              Dữ liệu được lưu riêng
            </div>

            <div>
              <span>✓</span>
              Sử dụng trên nhiều thiết bị
            </div>

            <div>
              <span>✓</span>
              Hỗ trợ nâng cấp tài khoản VIP
            </div>
          </div>
        </div>

        {/* Auth Card */}
        <div className="auth-card">
          {/* Header */}
          <div className="auth-card-header">
            <div className="auth-mobile-logo">📅</div>

            <span className="auth-card-label">
              {isLogin ? "CHÀO MỪNG QUAY TRỞ LẠI" : "BẮT ĐẦU SỬ DỤNG"}
            </span>

            <h2>{isLogin ? "Đăng nhập" : "Tạo tài khoản"}</h2>

            <p>
              {isLogin
                ? "Đăng nhập để tiếp tục sử dụng hệ thống."
                : "Tạo tài khoản để lưu và quản lý thời khóa biểu."}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={submit}>
            {/* Username */}
            <div className="auth-field">
              <label>Tên đăng nhập</label>

              <div className="auth-input-wrap">
                <span className="auth-input-icon">👤</span>

                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => set("username", e.target.value)}
                  placeholder="Nhập tên đăng nhập"
                  autoComplete="username"
                  disabled={busy}
                />
              </div>
            </div>

            {/* Password */}
            <div className="auth-field">
              <div className="auth-label-row">
                <label>Mật khẩu</label>

                {isLogin && <span className="auth-forgot">Quên mật khẩu?</span>}
              </div>

              <div className="auth-input-wrap">
                <span className="auth-input-icon">🔒</span>

                <input
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => set("password", e.target.value)}
                  placeholder="Nhập mật khẩu"
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  disabled={busy}
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((prev) => !prev)}
                  tabIndex="-1"
                  aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                >
                  {showPassword ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            {/* Register fields */}
            {!isLogin && (
              <>
                <div className="auth-field">
                  <label>Họ và tên</label>

                  <div className="auth-input-wrap">
                    <span className="auth-input-icon">✨</span>

                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => set("name", e.target.value)}
                      placeholder="Nhập họ và tên"
                      autoComplete="name"
                      disabled={busy}
                    />
                  </div>
                </div>

                <div className="auth-field">
                  <label>
                    Lớp phụ trách
                    <span className="optional">Không bắt buộc</span>
                  </label>

                  <div className="auth-input-wrap">
                    <span className="auth-input-icon">🏫</span>

                    <input
                      type="text"
                      value={form.className}
                      onChange={(e) => set("className", e.target.value)}
                      placeholder="Ví dụ: 10A1"
                      disabled={busy}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Error */}
            {error && (
              <div className="auth-error">
                <span>!</span>
                <p>{error}</p>
              </div>
            )}

            {/* Submit */}
            <button className="auth-submit" type="submit" disabled={busy}>
              {busy ? (
                <>
                  <span className="auth-spinner"></span>
                  Đang xử lý...
                </>
              ) : (
                <>
                  {isLogin ? "Đăng nhập" : "Tạo tài khoản"}

                  <span className="submit-arrow">→</span>
                </>
              )}
            </button>

            {/* Switch */}
            <div className="auth-switch">
              <span>{isLogin ? "Chưa có tài khoản?" : "Đã có tài khoản?"}</span>

              <button type="button" onClick={switchMode} disabled={busy}>
                {isLogin ? "Đăng ký ngay" : "Đăng nhập"}
              </button>
            </div>
          </form>

          {/* Bottom note */}
          <div className="auth-security">
            <span>🔐</span>
            <span>Thông tin tài khoản được bảo mật</span>
          </div>
        </div>
      </div>
    </div>
  );
}
