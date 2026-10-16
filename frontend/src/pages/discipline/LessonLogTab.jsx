// pages/discipline/LessonLogTab.jsx
import { useRef, useState } from "react";
import { SESSIONS, normalizeScore, readLessonLog } from "../../utils/lessonLogPdf";
import { exportLessonLogExcel, summarizeLessonLog } from "../../utils/lessonLogExport";

const fmt = (v) => (v === null ? "—" : String(Math.round(v * 100) / 100));
const toScore = (s) => (typeof s === "string" ? normalizeScore(s) : s);

/* Sổ đầu bài: đọc file PDF (bảng 1 trang Thứ | Tiết | Môn | … | Điểm, hoặc sổ in 2 trang trái / phải),
 * lấy Thứ – Buổi (sáng / chiều) – Tiết – Môn – Điểm của từng tiết, cho sửa lại nếu đọc sai rồi xuất Excel.
 * Xử lý hoàn toàn trên trình duyệt, không lưu lên máy chủ. */
export default function LessonLogTab({ user, showToast }) {
  const inputRef = useRef(null);
  const [files, setFiles] = useState([]); // { key, name, rows, warnings }
  const [reading, setReading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [errors, setErrors] = useState([]);
  const [exporting, setExporting] = useState(false);

  async function addFiles(list) {
    const picked = Array.from(list || []);
    if (!picked.length) return;
    setReading(true);
    setErrors([]);
    const added = [];
    const failed = [];
    for (const f of picked) {
      try {
        const { rows, warnings } = await readLessonLog(f);
        added.push({ key: `${f.name}-${f.lastModified}-${Math.random()}`, name: f.name, rows, warnings });
      } catch (err) {
        failed.push(`${f.name}: ${err.message || "không đọc được"}`);
      }
    }
    setFiles((prev) => [...prev, ...added]);
    setErrors(failed);
    setReading(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  function updateRow(fileKey, index, field, value) {
    setFiles((prev) =>
      prev.map((f) =>
        f.key !== fileKey ? f : { ...f, rows: f.rows.map((r, i) => (i === index ? { ...r, [field]: value } : r)) },
      ),
    );
  }

  function removeRow(fileKey, index) {
    setFiles((prev) => prev.map((f) => (f.key !== fileKey ? f : { ...f, rows: f.rows.filter((_, i) => i !== index) })));
  }

  async function handleExport() {
    setExporting(true);
    try {
      await exportLessonLogExcel({
        files: files.map((f) => ({
          name: f.name,
          rows: f.rows.map((r) => ({
            ...r,
            day: r.day.trim(),
            subject: (r.subject || "").trim(),
            period: Number(r.period) || r.period,
            score: toScore(r.score),
          })),
        })),
        schoolName: user?.school?.name || "",
      });
    } catch (err) {
      showToast(err.message || "Không xuất được file Excel.", true);
    } finally {
      setExporting(false);
    }
  }

  const totalRows = files.reduce((n, f) => n + f.rows.length, 0);

  return (
    <>
      <section className="as-card">
        <div className="as-card-head">
          <span className="as-step">📖</span>
          <div>
            <h3>Đọc sổ đầu bài từ file PDF</h3>
            <p>
              Đọc được sổ in 2 trang (trang trái <b>Thứ – Tiết – Môn học</b>, trang phải <b>Xếp loại tiết học → Cộng</b>)
              có tiêu đề <b>BUỔI SÁNG / BUỔI CHIỀU</b>, hoặc bảng 1 trang có cột <b>Thứ</b>, <b>Tiết</b>, <b>Điểm</b>.
              File phải là PDF có chữ, không phải ảnh scan. Có thể chọn nhiều file — mỗi file là 1 sheet trong Excel.
            </p>
          </div>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          hidden
          onChange={(e) => addFiles(e.target.files)}
        />
        <div
          className={"as-dropzone" + (dragActive ? " drag-active" : "")}
          onClick={() => !reading && inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            addFiles(e.dataTransfer.files);
          }}
        >
          <span className="as-dropzone-icon">{reading ? <span className="spin">↻</span> : "↑"}</span>
          <strong>{reading ? "Đang đọc sổ đầu bài..." : "Kéo thả file PDF sổ đầu bài vào đây"}</strong>
          <span>
            hoặc <b>chọn file từ máy tính</b>
          </span>
        </div>

        {errors.length > 0 && (
          <div className="auth-error ll-errors">
            <span>!</span>
            <p>
              {errors.map((e) => (
                <span key={e}>{e}</span>
              ))}
            </p>
          </div>
        )}
      </section>

      {files.length > 0 && (
        <div className="admin-users-panel">
          <div className="admin-toolbar">
            <div className="admin-toolbar-title">
              <div>
                <h3>Thứ – Buổi – Tiết – Điểm</h3>
                <span>
                  {files.length} file · {totalRows} tiết · kiểm tra và sửa trực tiếp trong bảng trước khi xuất
                </span>
              </div>
            </div>
            <button className="btn btn-light" onClick={() => setFiles([])}>
              Xoá tất cả
            </button>
            <button className="btn btn-export" onClick={handleExport} disabled={exporting || !totalRows}>
              {exporting ? "Đang xuất..." : "⤓ Xuất Excel"}
            </button>
          </div>

          <div className="ll-files">
            {files.map((f) => {
              const summary = summarizeLessonLog(f.rows.map((r) => ({ ...r, score: toScore(r.score) })));
              return (
                <div key={f.key} className="ll-file">
                  <div className="ll-file-head">
                    <span className="as-file-icon">PDF</span>
                    <div>
                      <strong>{f.name}</strong>
                      <small>
                        {f.rows.length} tiết
                        {f.warnings.length > 0 && <b className="bad-text"> · {f.warnings.join(" · ")}</b>}
                      </small>
                    </div>
                    <div className="spacer" />
                    <button
                      className="btn btn-sm btn-light"
                      onClick={() => setFiles((p) => p.filter((x) => x.key !== f.key))}
                    >
                      Bỏ file
                    </button>
                  </div>

                  <div className="ll-stats">
                    <span className="ll-stat am">
                      <small>TB buổi sáng</small>
                      <strong>{fmt(summary.morning)}</strong>
                    </span>
                    <span className="ll-stat pm">
                      <small>TB buổi chiều</small>
                      <strong>{fmt(summary.afternoon)}</strong>
                    </span>
                    <span className="ll-stat">
                      <small>TB cả tuần · {summary.scored} tiết có điểm</small>
                      <strong>{fmt(summary.all)}</strong>
                    </span>
                  </div>

                  <div className="ll-body">
                    <div className="admin-table-wrap">
                      <table className="admin-users-table ll-table">
                        <thead>
                          <tr>
                            <th>Thứ</th>
                            <th className="ll-mid">Buổi</th>
                            <th className="ll-narrow">Tiết</th>
                            <th>Môn học</th>
                            <th className="ll-narrow">Điểm</th>
                            <th className="ll-act" />
                          </tr>
                        </thead>
                        <tbody>
                          {f.rows.map((r, i) => {
                            const prev = f.rows[i - 1];
                            const cls = !prev
                              ? ""
                              : prev.day !== r.day
                                ? "ll-new-day"
                                : prev.session !== r.session
                                  ? "ll-new-session"
                                  : "";
                            return (
                              <tr key={i} className={cls}>
                                <td>
                                  <input value={r.day} onChange={(e) => updateRow(f.key, i, "day", e.target.value)} />
                                </td>
                                <td className="ll-mid">
                                  <select
                                    className={"ll-session" + (r.session === "Chiều" ? " pm" : r.session ? " am" : "")}
                                    value={r.session || ""}
                                    onChange={(e) => updateRow(f.key, i, "session", e.target.value)}
                                  >
                                    <option value="">—</option>
                                    {SESSIONS.map((s) => (
                                      <option key={s} value={s}>
                                        {s}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td>
                                  <input
                                    className="ll-center"
                                    value={r.period}
                                    onChange={(e) => updateRow(f.key, i, "period", e.target.value)}
                                  />
                                </td>
                                <td>
                                  <input
                                    value={r.subject || ""}
                                    placeholder="—"
                                    onChange={(e) => updateRow(f.key, i, "subject", e.target.value)}
                                  />
                                </td>
                                <td>
                                  <input
                                    className={"ll-center" + (r.score === "" ? " ll-missing" : "")}
                                    value={r.score}
                                    placeholder="—"
                                    onChange={(e) => updateRow(f.key, i, "score", e.target.value)}
                                  />
                                </td>
                                <td className="ll-act">
                                  <button className="link-btn" title="Xoá dòng" onClick={() => removeRow(f.key, i)}>
                                    ✕
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="admin-table-wrap ll-summary">
                      <table className="admin-users-table">
                        <thead>
                          <tr>
                            <th>Thứ</th>
                            <th className="ll-narrow">Sáng</th>
                            <th className="ll-narrow">Chiều</th>
                            <th className="ll-narrow">Cả ngày</th>
                          </tr>
                        </thead>
                        <tbody>
                          {summary.days.map((d) => (
                            <tr key={d.day}>
                              <td>
                                <strong>{d.day}</strong>
                              </td>
                              <td className="ll-center">{fmt(d.morning)}</td>
                              <td className="ll-center">{fmt(d.afternoon)}</td>
                              <td className="ll-center">
                                <b>{fmt(d.all)}</b>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
