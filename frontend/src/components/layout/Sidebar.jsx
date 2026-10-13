// components/layout/Sidebar.jsx
import { NAV_GROUPS } from "../../constants/config";

/* Danh sách bước soạn thời khóa biểu (stepper dọc) + kết quả kiểm tra dữ liệu */
export default function Sidebar({ activeStep, onSelect, counts, checkResult, onDismissCheck }) {
  let index = 0;
  return (
    <aside className="sidebar ed-steps">
      {NAV_GROUPS.map((group) => (
        <div className="ed-step-group" key={group.title}>
          <h3>{group.title}</h3>
          {group.items.map((item) => {
            index += 1;
            const n = item.count ? counts[item.count] || 0 : null;
            return (
              <button
                key={item.key}
                className={
                  "ed-step" +
                  (activeStep === item.key ? " active" : "") +
                  (n ? " filled" : "") +
                  (item.small ? " small" : "")
                }
                onClick={() => onSelect(item.key)}
              >
                <span className="ed-step-num">{n ? "✓" : index}</span>
                <span className="ed-step-label">
                  {item.label}
                  {item.hint && <small>{item.hint}</small>}
                </span>
                {n !== null && <span className="ed-step-count">{n}</span>}
              </button>
            );
          })}
        </div>
      ))}

      {checkResult && (
        <div className={"ed-check" + (checkResult.errors.length ? " bad" : " ok")}>
          <div className="ed-check-head">
            <strong>
              {checkResult.errors.length ? `${checkResult.errors.length} vấn đề cần xử lý` : "✓ Dữ liệu hợp lệ"}
            </strong>
            <button onClick={onDismissCheck} aria-label="Đóng">
              ×
            </button>
          </div>
          {checkResult.errors.length ? (
            <ul>
              {checkResult.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          ) : (
            <p>Có thể bắt đầu xếp thời khóa biểu.</p>
          )}
        </div>
      )}
    </aside>
  );
}
