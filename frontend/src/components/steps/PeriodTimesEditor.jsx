// components/steps/PeriodTimesEditor.jsx — cài giờ bắt đầu / kết thúc từng tiết của mỗi buổi
import { useState } from "react";
import { buildSessionTimes, DEFAULT_SESSION_START, resolvePeriodTimes } from "../../utils/periodTimes";

export default function PeriodTimesEditor({ config, setConfig }) {
  const times = resolvePeriodTimes(config);
  const sessions = Object.keys(times);
  const [auto, setAuto] = useState({ length: 45, gap: 5, bigBreakAfter: 2, bigBreak: 15 });

  function setTime(session, index, field, value) {
    setConfig((prev) => {
      const current = resolvePeriodTimes(prev);
      current[session][index] = { ...current[session][index], [field]: value };
      return { ...prev, periodTimes: current };
    });
  }

  /** Tự điền cả buổi từ giờ vào tiết 1 + quy tắc nghỉ */
  function fill(session) {
    setConfig((prev) => {
      const current = resolvePeriodTimes(prev);
      current[session] = buildSessionTimes({
        start: current[session][0]?.start || DEFAULT_SESSION_START[session],
        count: current[session].length,
        length: Number(auto.length) || 45,
        gap: Number(auto.gap) || 0,
        bigBreakAfter: Number(auto.bigBreakAfter) || 0,
        bigBreak: Number(auto.bigBreak) || 0,
      });
      return { ...prev, periodTimes: current };
    });
  }

  const setAutoField = (field) => (e) => setAuto((a) => ({ ...a, [field]: e.target.value }));

  return (
    <div className="pt-editor">
      <p className="hint">
        Giờ học hiển thị trên thời khóa biểu và trên app di động của giáo viên, học sinh. Sửa giờ vào tiết 1 rồi bấm{" "}
        <b>Tự điền</b> để tính các tiết sau, hoặc sửa từng tiết.
      </p>
      <div className="pt-auto">
        <label>
          Mỗi tiết <input type="number" min={1} max={180} value={auto.length} onChange={setAutoField("length")} /> phút
        </label>
        <label>
          Nghỉ giữa tiết <input type="number" min={0} max={60} value={auto.gap} onChange={setAutoField("gap")} /> phút
        </label>
        <label>
          Ra chơi sau tiết <input type="number" min={0} max={10} value={auto.bigBreakAfter} onChange={setAutoField("bigBreakAfter")} />
        </label>
        <label>
          Ra chơi <input type="number" min={0} max={90} value={auto.bigBreak} onChange={setAutoField("bigBreak")} /> phút
        </label>
      </div>
      <div className="pt-sessions">
        {sessions.map((s) => (
          <div className="pt-session" key={s}>
            <div className="pt-session-head">
              <strong>Buổi {s.toLowerCase()}</strong>
              <button type="button" className="btn btn-sm btn-info" onClick={() => fill(s)}>
                Tự điền
              </button>
            </div>
            <table className="grid-table pt-table">
              <thead>
                <tr>
                  <th className="w-stt">Tiết</th>
                  <th>Bắt đầu</th>
                  <th>Kết thúc</th>
                </tr>
              </thead>
              <tbody>
                {times[s].map((t, i) => (
                  <tr key={i}>
                    <td className="stt">{i + 1}</td>
                    <td>
                      <input type="time" value={t.start} onChange={(e) => setTime(s, i, "start", e.target.value)} />
                    </td>
                    <td>
                      <input
                        type="time"
                        value={t.end}
                        onChange={(e) => setTime(s, i, "end", e.target.value)}
                        className={t.end <= t.start ? "pt-bad" : ""}
                        title={t.end <= t.start ? "Giờ kết thúc phải sau giờ bắt đầu" : undefined}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
