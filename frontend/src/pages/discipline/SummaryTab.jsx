// pages/discipline/SummaryTab.jsx
import { Fragment, useEffect, useState } from "react";
import { getDisciplineStudents, getDisciplineSummary, listDisciplineRecords } from "../../api/discipline";
import { hasPermission } from "../../utils/permissions";
import { exportDisciplineExcel, exportDisciplineStudentsExcel } from "../../utils/disciplineExport";
import { addDays, addMonths, formatPoints, today, viDate, weekdayName } from "./disciplineUtils";

/* Bảng xếp hạng thi đua theo tuần / tháng + chi tiết vi phạm từng lớp */
export default function SummaryTab({ user }) {
  const [period, setPeriod] = useState("week");
  const [date, setDate] = useState(today());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openClass, setOpenClass] = useState(null);
  const [details, setDetails] = useState({}); // classId -> records
  const [exporting, setExporting] = useState(false);
  const canExport = hasPermission(user, "discipline.config"); // Đoàn thanh niên

  async function handleExport() {
    if (!data) return;
    setExporting(true);
    try {
      await exportDisciplineExcel({ period, summary: data, schoolName: user?.school?.name || "" });
    } catch (err) {
      setError(err.message || "Không xuất được file Excel.");
    } finally {
      setExporting(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    setError("");
    setDetails({});
    getDisciplineSummary(period, date)
      .then(setData)
      .catch((err) => setError(err.message || "Không tải được bảng điểm."))
      .finally(() => setLoading(false));
  }, [period, date]);

  // Khi đổi kỳ: tải lại chi tiết lớp đang mở; GVCN mở sẵn lớp mình
  useEffect(() => {
    if (!data) return;
    const key = openClass === null ? (user?.classId ? String(user.classId) : "") : openClass;
    if (openClass === null) setOpenClass(key);
    if (key) fetchDetail(key, data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  function shift(step) {
    setDate((d) => (period === "week" ? addDays(d, step * 7) : addMonths(d, step)));
  }

  async function fetchDetail(key, summary) {
    const from = summary.period === "week" ? summary.start : summary.columns[0]?.key || summary.start;
    const to = summary.period === "week" ? summary.end : addDays(summary.columns[summary.columns.length - 1]?.key || summary.end, 6);
    try {
      const records = await listDisciplineRecords({ classId: key, from, to });
      setDetails((prev) => ({ ...prev, [key]: records }));
    } catch {
      setDetails((prev) => ({ ...prev, [key]: [] }));
    }
  }

  function toggleClass(classId) {
    const key = String(classId);
    if (openClass === key) return setOpenClass("");
    setOpenClass(key);
    if (!details[key] && data) fetchDetail(key, data);
  }

  const mine = data?.rows.find((r) => String(r.classId) === String(user?.classId));
  const title =
    period === "week"
      ? `Tuần ${viDate(data?.start || "")} – ${viDate(data?.end || "")}`
      : `Tháng ${date.slice(5, 7)}/${date.slice(0, 4)}`;

  return (
    <>
      <div className="dc-toolbar">
        <div className="tabs dc-period">
          <button className={"tab" + (period === "week" ? " active" : "")} onClick={() => setPeriod("week")}>
            Theo tuần
          </button>
          <button className={"tab" + (period === "month" ? " active" : "")} onClick={() => setPeriod("month")}>
            Theo tháng
          </button>
        </div>
        <div className="dc-date-nav">
          <button className="btn btn-sm btn-light" onClick={() => shift(-1)} aria-label="Kỳ trước">
            ‹
          </button>
          <strong>{data ? title : "…"}</strong>
          <button className="btn btn-sm btn-light" onClick={() => shift(1)} aria-label="Kỳ sau">
            ›
          </button>
          <button className="btn btn-sm btn-info" onClick={() => setDate(today())}>
            Hiện tại
          </button>
        </div>
      </div>

      {error && (
        <div className="auth-error">
          <span>!</span>
          <p>{error}</p>
        </div>
      )}

      {mine && (
        <div className="dc-mine">
          <div className="dc-mine-rank">
            <span>Hạng</span>
            <strong>{mine.rank}</strong>
            <small>/{data.totalClasses ?? data.rows.length} lớp</small>
          </div>
          <div className="dc-mine-info">
            <span className="dc-eyebrow">LỚP CHỦ NHIỆM</span>
            <h3>Lớp {mine.className}</h3>
            <p>
              {period === "week" ? "Điểm tuần" : "Điểm trung bình tháng"}: <b>{formatPoints(mine.score)}</b> /{" "}
              {data.basePoints} · bị trừ {formatPoints(mine.penalty)} · được cộng {formatPoints(mine.bonus)}
            </p>
          </div>
          <div className="dc-mine-cats">
            {Object.entries(mine.byCategory).length === 0 ? (
              <span className="dc-clean">✓ Không có vi phạm</span>
            ) : (
              Object.entries(mine.byCategory).map(([name, n]) => (
                <span key={name}>
                  {name} <b>−{formatPoints(n)}</b>
                </span>
              ))
            )}
          </div>
        </div>
      )}

      {data?.ownClassOnly && <StudentList period={period} date={date} schoolName={user?.school?.name || ""} />}

      <div className="admin-users-panel">
        <div className="admin-toolbar">
          <div className="admin-toolbar-title">
            <div>
              <h3>{data?.ownClassOnly ? "Điểm thi đua lớp chủ nhiệm" : "Bảng xếp hạng thi đua"}</h3>
              <span>
                Điểm gốc {data?.basePoints ?? "—"} ·{" "}
                {period === "week" ? "điểm tuần = gốc − trừ + cộng" : "điểm tháng = trung bình điểm các tuần"} · bấm vào
                lớp để xem chi tiết
              </span>
            </div>
          </div>
          {canExport && (
            <button className="btn btn-export" onClick={handleExport} disabled={!data || loading || exporting}>
              {exporting ? "Đang xuất..." : `⤓ Xuất Excel ${period === "week" ? "tuần" : "tháng"}`}
            </button>
          )}
        </div>

        <div className="admin-table-wrap">
          <table className="admin-users-table dc-rank-table">
            <thead>
              <tr>
                <th>Hạng</th>
                <th>Lớp</th>
                <th>GVCN</th>
                {data?.columns.map((c) => (
                  <th key={c.key} className="dc-num">
                    {c.label}
                  </th>
                ))}
                <th className="dc-num">Trừ</th>
                <th className="dc-num">Cộng</th>
                <th className="dc-num">Điểm</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan="20" className="admin-empty">
                    Đang tải...
                  </td>
                </tr>
              )}
              {!loading && data?.rows.length === 0 && (
                <tr>
                  <td colSpan="20" className="admin-empty">
                    Trường chưa có lớp nào.
                  </td>
                </tr>
              )}
              {!loading &&
                data?.rows.map((r) => {
                  const key = String(r.classId);
                  const isMine = key === String(user?.classId);
                  const open = openClass === key;
                  return (
                    <Fragment key={key}>
                      <tr className={"dc-row" + (isMine ? " mine" : "") + (open ? " open" : "")} onClick={() => toggleClass(key)}>
                        <td>
                          <span className={"dc-rank r" + Math.min(r.rank, 4)}>{r.rank}</span>
                        </td>
                        <td>
                          <strong>{r.className}</strong>
                          {isMine && <span className="self-badge">Lớp tôi</span>}
                        </td>
                        <td className="muted">{r.homeroomTeacher || "—"}</td>
                        {data.columns.map((c) => {
                          const cell = r.cells[c.key];
                          if (period === "week") {
                            if (!cell) return <td key={c.key} className="dc-num dc-none">·</td>;
                            return (
                              <td key={c.key} className={"dc-num " + (cell.net < 0 ? "bad-text" : cell.net > 0 ? "ok-text" : "dc-zero")}>
                                {cell.net > 0 ? "+" : ""}
                                {formatPoints(cell.net)}
                              </td>
                            );
                          }
                          return (
                            <td key={c.key} className="dc-num">
                              {cell ? formatPoints(cell.score) : <span className="dc-none">·</span>}
                            </td>
                          );
                        })}
                        <td className="dc-num bad-text">{r.penalty ? `−${formatPoints(r.penalty)}` : "0"}</td>
                        <td className="dc-num ok-text">{r.bonus ? `+${formatPoints(r.bonus)}` : "0"}</td>
                        <td className="dc-num">
                          <strong className="dc-score">{formatPoints(r.score)}</strong>
                        </td>
                      </tr>
                      {open && (
                        <tr className="dc-detail-row">
                          <td colSpan={6 + data.columns.length}>
                            <ClassDetail records={details[key]} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
            </tbody>
          </table>
        </div>
        {period === "week" && (
          <p className="dc-legend">
            Ô theo ngày: <b className="bad-text">−n</b> điểm bị trừ trong ngày · <b className="dc-zero">0</b> đã chấm, không vi
            phạm · <b className="dc-none">·</b> chưa chấm
          </p>
        )}
      </div>
    </>
  );
}

/* GVCN: học sinh lớp mình bị ghi tên trong sổ thi đua trong kỳ — xem và lưu lại ra Excel */
function StudentList({ period, date, schoolName }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(null);

  useEffect(() => {
    setData(null);
    setError("");
    getDisciplineStudents(period, date)
      .then(setData)
      .catch((err) => setError(err.message || "Không tải được danh sách học sinh."));
  }, [period, date]);

  async function save() {
    try {
      await exportDisciplineStudentsExcel(data, { schoolName });
    } catch (err) {
      setError(err.message || "Không xuất được file Excel.");
    }
  }

  return (
    <div className="admin-users-panel dc-students">
      <div className="admin-toolbar">
        <div className="admin-toolbar-title">
          <div>
            <h3>Học sinh bị ghi sổ thi đua</h3>
            <span>
              {data ? `Lớp ${data.className} · ${viDate(data.start)} – ${viDate(data.end)} · bấm vào tên để xem chi tiết` : "Đang tải..."}
            </span>
          </div>
        </div>
        <button className="btn btn-export" onClick={save} disabled={!data || data.students.length === 0}>
          ⤓ Lưu danh sách (Excel)
        </button>
      </div>
      {error && <p className="dc-detail-empty bad-text">{error}</p>}
      {data && data.students.length === 0 && <p className="dc-detail-empty">✓ Không có học sinh nào bị ghi tên trong kỳ này.</p>}
      {data && data.students.length > 0 && (
        <ul className="dc-student-list">
          {data.students.map((st) => (
            <li key={st.name} className={open === st.name ? "open" : ""}>
              <button type="button" onClick={() => setOpen(open === st.name ? null : st.name)}>
                <strong>{st.name}</strong>
                <span>
                  {st.count} lần · <b className="bad-text">−{formatPoints(st.totalPoints)}</b>
                </span>
              </button>
              {open === st.name && (
                <ul>
                  {st.items.map((it, i) => (
                    <li key={i}>
                      {weekdayName(it.date)}, {viDate(it.date)} — {it.categoryName}: {it.itemName}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ClassDetail({ records }) {
  if (!records) return <p className="dc-detail-empty">Đang tải chi tiết...</p>;
  if (records.length === 0) return <p className="dc-detail-empty">Chưa có phiếu chấm nào trong kỳ này.</p>;
  return (
    <div className="dc-detail">
      {records.map((r) => (
        <div key={r.id} className="dc-day">
          <div className="dc-day-head">
            <strong>
              {weekdayName(r.date)}, {viDate(r.date)}
            </strong>
            <span>
              {r.totalPenalty ? <b className="bad-text">−{formatPoints(r.totalPenalty)}</b> : null}
              {r.totalBonus ? <b className="ok-text"> +{formatPoints(r.totalBonus)}</b> : null}
              {!r.totalPenalty && !r.totalBonus && <b className="ok-text">Không vi phạm</b>}
              <small> · chấm bởi {r.recordedByName}</small>
            </span>
          </div>
          {r.entries.length > 0 && (
            <ul>
              {r.entries.map((e, i) => (
                <li key={i}>
                  <span className="dc-cat">{e.categoryName}</span>
                  <span className="dc-item">
                    {e.itemName}
                    {e.inputType !== "checkbox" && ` × ${e.quantity}`}
                    {e.studentNames.length > 0 && <em>: {e.studentNames.join(", ")}</em>}
                    {e.note && <em> ({e.note})</em>}
                  </span>
                  <b className={e.kind === "penalty" ? "bad-text" : "ok-text"}>
                    {e.kind === "penalty" ? "−" : "+"}
                    {formatPoints(e.total)}
                  </b>
                </li>
              ))}
            </ul>
          )}
          {r.note && <p className="dc-note">Ghi chú: {r.note}</p>}
        </div>
      ))}
    </div>
  );
}
