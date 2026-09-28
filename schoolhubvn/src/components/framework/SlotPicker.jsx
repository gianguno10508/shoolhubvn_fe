import { getDays, getSessions, getTiets, slotKey, slotLabel } from "../../utils/timeHelpers";

export function SlotPicker({ item, subject, config, offSlots, onClose, onChange }) {
  const days = getDays(config.soNgay);
  const sessions = getSessions(config.soBuoi);
  const tiets = getTiets(config.soTiet);
  const fixed = item.fixed || [];
  const avoid = item.avoid || [];
  const maxFixed = Math.max(1, Number(item.soTiet) || 1);

  function cycle(slot) {
    if (offSlots.has(slot)) return;
    if (fixed.includes(slot)) {
      onChange({
        fixed: fixed.filter((s) => s !== slot),
        avoid: [...avoid, slot],
      });
    } else if (avoid.includes(slot)) {
      onChange({ avoid: avoid.filter((s) => s !== slot) });
    } else {
      if (fixed.length >= maxFixed) {
        onChange({ avoid: [...avoid, slot] });
        return;
      }
      onChange({ fixed: [...fixed, slot] });
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Cố định - Tránh: {subject ? subject.name : "môn chưa chọn"}</h3>
          <button className="btn btn-primary btn-sm" onClick={onClose}>
            Xong
          </button>
        </div>
        <p className="hint">
          Bấm một ô để chuyển lần lượt: trống →{" "}
          <strong className="ok-text">cố định</strong> →{" "}
          <strong className="bad-text">tránh</strong> → trống. Đã cố định{" "}
          {fixed.length}/{maxFixed} tiết, tránh {avoid.length} tiết.
        </p>
        <div className="fw-grid-wrap">
          <table className="fw-grid">
            <thead>
              <tr>
                <th colSpan={2} />
                {days.map((d) => (
                  <th key={d}>{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) =>
                tiets.map((tiet, i) => (
                  <tr key={session + tiet}>
                    {i === 0 && (
                      <td className="fw-session" rowSpan={tiets.length}>
                        {session}
                      </td>
                    )}
                    <td className="fw-tiet">Tiết {tiet}</td>
                    {days.map((d) => {
                      const slot = slotKey(d, session, tiet);
                      const off = offSlots.has(slot);
                      let cls = "fw-cell pick";
                      let text = "";
                      if (off) {
                        cls += " off";
                        text = "Nghỉ";
                      } else if (fixed.includes(slot)) {
                        cls += " fixed";
                        text = "Cố định";
                      } else if (avoid.includes(slot)) {
                        cls += " avoid";
                        text = "Tránh";
                      }
                      return (
                        <td
                          key={slot}
                          className={cls}
                          onClick={() => cycle(slot)}
                        >
                          {text}
                        </td>
                      );
                    })}
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
        {fixed.length > 0 && (
          <p className="hint">Cố định tại: {fixed.map(slotLabel).join("; ")}</p>
        )}
      </div>
    </div>
  );
}

export default SlotPicker;
