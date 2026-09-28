import { NAV_GROUPS } from "../constants/appConstants";

export function Sidebar({
  activeStep,
  onSelect,
  checkResult,
  onCheck,
  onViewResult,
  onExport,
}) {
  return (
    <aside className="sidebar">
      {NAV_GROUPS.map((group) => (
        <div className="nav-group" key={group.title}>
          <h3>{group.title}</h3>
          <div className="nav-card">
            {group.items.map((item) => (
              <button
                key={item.key}
                className={
                  "nav-item" +
                  (activeStep === item.key ? " active" : "") +
                  (item.small ? " small" : "")
                }
                onClick={() => onSelect(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className="nav-card check-card">
        <button className="btn btn-check" onClick={onCheck}>
          Kiểm tra dữ liệu
        </button>
        {!checkResult && <p className="check-empty">Chưa kiểm tra lần nào</p>}
        {checkResult && checkResult.errors.length === 0 && (
          <p className="check-ok">Dữ liệu hợp lệ. Có thể xếp thời khóa biểu.</p>
        )}
        {checkResult && checkResult.errors.length > 0 && (
          <ul className="check-errors">
            {checkResult.errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        )}
      </div>

      <button className="btn btn-result" onClick={onViewResult}>
        Xem kết quả
      </button>
      <button className="btn btn-export" onClick={onExport}>
        Xuất Excel
      </button>
    </aside>
  );
}

export default Sidebar;
