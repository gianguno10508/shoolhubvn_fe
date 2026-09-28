import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import Field from "../common/Field";

export default function LoginRegister() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState("login"); // login | register
  const [form, setForm] = useState({
    username: "",
    password: "",
    name: "",
    className: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!form.username.trim() || !form.password) {
      setError("Vui lòng nhập tên đăng nhập và mật khẩu.");
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

  return (
    <div className="auth-wrap">
      <form className="auth-card panel" onSubmit={submit}>
        <h2>{mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}</h2>
        <p className="hint">Thời khóa biểu của mỗi tài khoản được lưu riêng trên máy chủ.</p>

        <div className="auth-fields">
          <Field label="Tên đăng nhập">
            <input
              value={form.username}
              onChange={(e) => set("username", e.target.value)}
              autoComplete="username"
            />
          </Field>
          <Field label="Mật khẩu">
            <input
              type="password"
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </Field>
          {mode === "register" && (
            <>
              <Field label="Họ và tên">
                <input value={form.name} onChange={(e) => set("name", e.target.value)} />
              </Field>
              <Field label="Lớp phụ trách (nếu có)">
                <input
                  value={form.className}
                  onChange={(e) => set("className", e.target.value)}
                  placeholder="Ví dụ: 10A1"
                />
              </Field>
            </>
          )}
        </div>

        {error && <p className="auth-error">{error}</p>}

        <button className="btn btn-primary auth-submit" type="submit" disabled={busy}>
          {busy ? "Đang xử lý..." : mode === "login" ? "Đăng nhập" : "Đăng ký"}
        </button>

        <p className="auth-switch">
          {mode === "login" ? "Chưa có tài khoản?" : "Đã có tài khoản?"}{" "}
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError("");
            }}
          >
            {mode === "login" ? "Đăng ký" : "Đăng nhập"}
          </button>
        </p>
      </form>
    </div>
  );
}
