// pages/assignments/AssignmentResultPage.jsx
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import * as XLSX from "xlsx";
import { deleteAssignment, getAssignment, getAssignmentResults, updateAssignment } from "../../api/assignments";
import { assignmentState, formatDateTime, formatDuration, formatScore, toLocalInput } from "./assignmentUtils";
import { GAMES, gameOf } from "./game/GameHub";
import { DateTimeInput } from "../../components/DateInput";

const STATUS_LABEL = {
  submitted: "Đã nộp",
  in_progress: "Đang làm",
  not_started: "Chưa làm",
};

/* Kết quả 1 bài tập: thống kê + bảng điểm từng học sinh */
export default function AssignmentResultPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const [classFilter, setClassFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showQuestions, setShowQuestions] = useState(false);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);

  function showToast(msg, isError = false) {
    setToast({ msg, error: isError });
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(null), 2600);
  }

  function load() {
    setLoading(true);
    setError("");
    Promise.all([getAssignmentResults(id), getAssignment(id)])
      .then(([results, d]) => {
        setData(results);
        setDetail(d);
      })
      .catch((err) => setError(err.message || "Không tải được kết quả."))
      .finally(() => setLoading(false));
  }

  useEffect(load, [id]);

  const rows = useMemo(() => {
    if (!data) return [];
    const keyword = search.trim().toLowerCase();
    return data.rows.filter(
      (r) =>
        (classFilter === "all" || r.className === classFilter) &&
        (statusFilter === "all" || r.status === statusFilter) &&
        (!keyword ||
          r.studentName?.toLowerCase().includes(keyword) ||
          r.studentUsername?.toLowerCase().includes(keyword) ||
          r.studentCode?.toLowerCase().includes(keyword)),
    );
  }, [data, classFilter, statusFilter, search]);

  const classNames = useMemo(() => [...new Set((data?.rows || []).map((r) => r.className).filter(Boolean))].sort(), [data]);

  async function run(action, msg) {
    setBusy(true);
    try {
      await action();
      showToast(msg);
      load();
    } catch (err) {
      showToast(err.message || "Có lỗi xảy ra.", true);
    } finally {
      setBusy(false);
    }
  }

  function toggleStatus() {
    const closed = data.assignment.status === "closed";
    run(
      () => updateAssignment(id, { status: closed ? "published" : "closed" }),
      closed ? "Đã mở lại bài tập." : "Đã đóng bài tập, học sinh không thể làm thêm.",
    );
  }

  async function handleDelete() {
    if (!window.confirm(`Xóa bài tập "${data.assignment.title}"? Kết quả của học sinh cũng sẽ bị ẩn.`)) return;
    try {
      await deleteAssignment(id);
      navigate("/giao-vien/bai-tap", { replace: true });
    } catch (err) {
      showToast(err.message || "Không xóa được.", true);
    }
  }

  function openEdit() {
    const a = data.assignment;
    setEditing({
      title: a.title,
      durationMinutes: a.durationMinutes,
      totalPoints: a.totalPoints,
      dueAt: toLocalInput(a.dueAt),
      maxAttempts: a.maxAttempts,
      showAnswers: a.showAnswers,
      game: a.game || "",
    });
  }

  async function saveEdit(e) {
    e.preventDefault();
    await run(
      () =>
        updateAssignment(id, {
          ...editing,
          durationMinutes: Number(editing.durationMinutes),
          totalPoints: Number(editing.totalPoints),
          maxAttempts: Number(editing.maxAttempts),
          dueAt: new Date(editing.dueAt).toISOString(),
        }),
      "Đã lưu cấu hình bài tập.",
    );
    setEditing(null);
  }

  function exportExcel() {
    const a = data.assignment;
    const sheet = XLSX.utils.json_to_sheet(
      data.rows.map((r, i) => ({
        STT: i + 1,
        "Họ tên": r.studentName,
        "Tài khoản": r.studentUsername,
        "Mã HS": r.studentCode,
        Lớp: r.className,
        "Trạng thái": STATUS_LABEL[r.status],
        "Số câu đúng": r.best ? `${r.best.correctCount}/${r.best.totalQuestions}` : "",
        [`Điểm (thang ${a.totalPoints})`]: r.best ? r.best.score : "",
        "Nộp lúc": r.best ? formatDateTime(r.best.submittedAt) : "",
        "Thời gian làm": r.best ? formatDuration(r.best.durationSeconds) : "",
        "Số lượt": r.attempts,
        "Tự nộp khi hết giờ": r.best?.autoSubmitted ? "Có" : "",
      })),
    );
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Kết quả");
    XLSX.writeFile(book, `Ket-qua-${a.title.replace(/[\\/:*?"<>|]/g, "-")}.xlsx`);
  }

  if (loading && !data) return <div className="page as-page"><p className="as-empty">Đang tải kết quả...</p></div>;

  if (error) {
    return (
      <div className="page as-page">
        <div className="auth-error as-alert">
          <span>!</span>
          <p>
            {error} <Link to="/giao-vien/bai-tap">Về danh sách</Link>
          </p>
        </div>
      </div>
    );
  }

  const a = data.assignment;
  const state = assignmentState(a);
  const { stats } = data;

  return (
    <div className="page as-page">
      {toast && <div className={"toast" + (toast.error ? " toast-error" : "")}>{toast.msg}</div>}

      <Link className="as-back" to="/giao-vien/bai-tap">
        ← Bài tập & Tự chấm
      </Link>

      <div className="as-detail-head">
        <div>
          <div className="as-item-top">
            <span className={"as-badge " + state.key}>{state.label}</span>
            {a.game && <span className="as-game-tag">{gameOf(a.game).icon} {gameOf(a.game).name}</span>}
            {detail?.classes?.map((c) => (
              <span key={c.id} className="as-class-tag">
                {c.name}
              </span>
            ))}
          </div>
          <h2>{a.title}</h2>
          {a.description && <p className="as-desc">{a.description}</p>}
          <p className="as-meta-line">
            {a.questionCount} câu · {a.durationMinutes} phút · thang {a.totalPoints} điểm · tối đa {a.maxAttempts} lượt
            · mở {formatDateTime(a.openAt)} · hạn <b>{formatDateTime(a.dueAt)}</b>
          </p>
        </div>
        <div className="as-detail-actions">
          <button className="btn btn-light" onClick={openEdit} disabled={busy}>
            Sửa cấu hình
          </button>
          <button className="btn btn-light" onClick={toggleStatus} disabled={busy}>
            {a.status === "closed" ? "Mở lại bài" : "Đóng bài"}
          </button>
          <button className="btn btn-export" onClick={exportExcel}>
            Xuất Excel
          </button>
          <button className="btn btn-danger" onClick={handleDelete}>
            Xóa
          </button>
        </div>
      </div>

      <div className="as-stats">
        <div>
          <span>Đã nộp</span>
          <strong>
            {stats.submitted}
            <small>/{stats.students}</small>
          </strong>
        </div>
        <div>
          <span>Điểm trung bình</span>
          <strong>{formatScore(stats.average)}</strong>
        </div>
        <div>
          <span>Cao nhất</span>
          <strong className="ok-text">{formatScore(stats.highest)}</strong>
        </div>
        <div>
          <span>Thấp nhất</span>
          <strong className="bad-text">{formatScore(stats.lowest)}</strong>
        </div>
      </div>

      <div className="admin-users-panel">
        <div className="admin-toolbar">
          <div className="admin-toolbar-title">
            <div>
              <h3>Bảng điểm</h3>
              <span>{rows.length} học sinh</span>
            </div>
          </div>
          <div className="admin-filters">
            <div className="admin-search">
              <span>⌕</span>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm học sinh, tài khoản..." />
            </div>
            <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
              <option value="all">Tất cả lớp</option>
              {classNames.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">Tất cả trạng thái</option>
              {Object.entries(STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-users-table as-result-table">
            <thead>
              <tr>
                <th>STT</th>
                <th>Học sinh</th>
                <th>Tài khoản</th>
                <th>Lớp</th>
                <th>Trạng thái</th>
                <th>Số câu đúng</th>
                <th>Điểm</th>
                <th>Nộp lúc</th>
                <th>Thời gian làm</th>
                <th>Lượt</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan="10" className="admin-empty">
                    Không có học sinh phù hợp.
                  </td>
                </tr>
              ) : (
                rows.map((r, i) => (
                  <tr key={String(r.studentId)}>
                    <td className="muted">{i + 1}</td>
                    <td>
                      <div className="user-information">
                        <strong>{r.studentName || "—"}</strong>
                        {r.studentCode && <span>Mã HS: {r.studentCode}</span>}
                        {r.leftClass && <span>Không còn trong lớp</span>}
                      </div>
                    </td>
                    <td className="as-mono">{r.studentUsername}</td>
                    <td>{r.className || "—"}</td>
                    <td>
                      <span className={"as-status " + r.status}>{STATUS_LABEL[r.status]}</span>
                      {r.best?.autoSubmitted && <small className="as-auto">tự nộp khi hết giờ</small>}
                    </td>
                    <td>{r.best ? `${r.best.correctCount}/${r.best.totalQuestions}` : "—"}</td>
                    <td>
                      <strong className="as-score">{r.best ? formatScore(r.best.score) : "—"}</strong>
                    </td>
                    <td>{r.best ? formatDateTime(r.best.submittedAt) : "—"}</td>
                    <td>{r.best ? formatDuration(r.best.durationSeconds) : "—"}</td>
                    <td>{r.attempts || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="admin-users-panel">
        <div className="admin-toolbar">
          <div className="admin-toolbar-title">
            <div>
              <h3>Câu hỏi & đáp án</h3>
              <span>{detail?.sourceFileName || `${a.questionCount} câu`}</span>
            </div>
          </div>
          <button className="btn btn-sm btn-light" onClick={() => setShowQuestions((v) => !v)}>
            {showQuestions ? "Thu gọn" : "Xem đề"}
          </button>
        </div>
        {showQuestions && detail && (
          <ol className="as-question-list as-readonly">
            {detail.questions.map((q) => (
              <li key={q.number} className="as-question">
                <div className="as-question-text">
                  <b>Câu {q.number}.</b> {q.text}
                </div>
                <div className="as-option-grid">
                  {q.options.map((o) => (
                    <span key={o.letter} className={"as-option" + (o.letter === q.correctAnswer ? " correct" : "")}>
                      <span className="as-option-letter">{o.letter}</span>
                      <span>{o.text}</span>
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      {editing && (
        <div className="modal-backdrop" onClick={() => !busy && setEditing(null)}>
          <form className="modal modal-sm" onClick={(e) => e.stopPropagation()} onSubmit={saveEdit}>
            <div className="modal-head">
              <h3>Cấu hình bài tập</h3>
            </div>
            <div className="as-form-grid">
              <label className="field as-span-2">
                <span>Tên bài</span>
                <input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
              </label>
              <label className="field">
                <span>Thời gian làm (phút)</span>
                <input type="number" min={1} value={editing.durationMinutes} onChange={(e) => setEditing({ ...editing, durationMinutes: e.target.value })} />
              </label>
              <label className="field">
                <span>Thang điểm</span>
                <input type="number" min={1} value={editing.totalPoints} onChange={(e) => setEditing({ ...editing, totalPoints: e.target.value })} />
              </label>
              <label className="field">
                <span>Hạn nộp</span>
                <DateTimeInput value={editing.dueAt} onChange={(e) => setEditing({ ...editing, dueAt: e.target.value })} />
              </label>
              <label className="field">
                <span>Hình thức làm bài</span>
                <select
                  value={editing.game}
                  disabled={detail?.hasSubmissions}
                  title={detail?.hasSubmissions ? "Đã có học sinh làm bài, không đổi được hình thức" : undefined}
                  onChange={(e) => setEditing({ ...editing, game: e.target.value })}
                >
                  <option value="">📝 Cổ điển</option>
                  {GAMES.map((g) => (
                    <option key={g.key} value={g.key}>
                      {g.icon} Trò chơi: {g.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Số lượt tối đa</span>
                <input type="number" min={1} max={10} value={editing.maxAttempts} onChange={(e) => setEditing({ ...editing, maxAttempts: e.target.value })} />
              </label>
              <label className="as-check as-span-2">
                <input type="checkbox" checked={editing.showAnswers} onChange={(e) => setEditing({ ...editing, showAnswers: e.target.checked })} />
                Cho học sinh xem đáp án sau khi nộp
              </label>
            </div>
            <p className="hint">Đổi thang điểm chỉ áp dụng cho các lượt nộp sau khi lưu.</p>
            <div className="btn-row modal-actions">
              <button type="button" className="btn btn-light" onClick={() => setEditing(null)} disabled={busy}>
                Hủy
              </button>
              <button className="btn btn-primary" type="submit" disabled={busy}>
                Lưu
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
