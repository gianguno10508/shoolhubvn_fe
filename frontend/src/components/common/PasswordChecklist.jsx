import { PASSWORD_RULES } from "../../utils/passwordPolicy";

/* Danh sách yêu cầu mật khẩu, tick xanh khi đạt — hiện dưới ô nhập mật khẩu mới */
export default function PasswordChecklist({ password }) {
  const p = String(password || "");
  return (
    <ul className="pw-rules" aria-live="polite">
      {PASSWORD_RULES.map((r) => {
        const ok = r.test(p);
        return (
          <li key={r.key} className={ok ? "ok" : ""}>
            <span aria-hidden="true">{ok ? "✓" : "•"}</span> {r.label}
          </li>
        );
      })}
    </ul>
  );
}
