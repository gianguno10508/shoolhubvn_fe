// pages/assignments/StudentAssignmentsPage.jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listMyAssignments } from "../../api/assignments";
import { useAuth } from "../../context/AuthContext";
import { assignmentState, formatDateTime, formatScore, timeLeft } from "./assignmentUtils";

function group(list) {
  const todo = [];
  const done = [];
  const missed = [];
  for (const a of list) {
    if (a.canStart) todo.push(a);
    else if (a.bestScore != null) done.push(a);
    else missed.push(a);
  }
  return { todo, done, missed };
}

function AssignmentCard({ a }) {
  const state = assignmentState(a);
  return (
    <div className="as-item as-student-item">
      <div className="as-item-top">
        <span className={"as-badge " + state.key}>{state.label}</span>
        {state.key === "open" && <span className="as-item-left">{timeLeft(a.dueAt)}</span>}
      </div>
      <h3>{a.title}</h3>
      {a.description && <p className="as-desc">{a.description}</p>}
      <dl className="as-item-meta">
        <div>
          <dt>Hạn nộp</dt>
          <dd>{formatDateTime(a.dueAt)}</dd>
        </div>
        <div>
          <dt>Thời gian</dt>
          <dd>{a.durationMinutes} phút</dd>
        </div>
        <div>
          <dt>Số câu</dt>
          <dd>{a.questionCount}</dd>
        </div>
        <div>
          <dt>Điểm</dt>
          <dd>{formatScore(a.bestScore, a.totalPoints)}</dd>
        </div>
      </dl>
      <div className="as-student-actions">
        <small>
          Lượt làm: {a.attemptsUsed}/{a.maxAttempts}
        </small>
        <div className="btn-row tight">
          {a.lastSubmissionId && (
            <Link className="btn btn-sm btn-light" to={`/bai-tap/ket-qua/${a.lastSubmissionId}`}>
              Xem kết quả
            </Link>
          )}
          {a.canStart && (
            <Link className="btn btn-sm btn-primary" to={`/bai-tap/${a.id}`}>
              {a.inProgressId ? "Làm tiếp" : a.attemptsUsed ? "Làm lại" : "Bắt đầu làm bài"}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

/* Học sinh / cờ đỏ: các bài tập được giao cho lớp mình */
export default function StudentAssignmentsPage() {
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    listMyAssignments()
      .then(setList)
      .catch((err) => setError(err.message || "Không tải được bài tập."))
      .finally(() => setLoading(false));
  }, []);

  const { todo, done, missed } = group(list);

  const sections = [
    ["Cần làm", todo, "Không có bài nào cần làm. Tuyệt vời!"],
    ["Đã nộp", done, null],
    ["Đã hết hạn", missed, null],
  ];

  return (
    <div className="page as-page">
      <div className="page-head">
        <span className="page-head-icon as-icon">📚</span>
        <div>
          <h2>Bài tập của em</h2>
          <p>
            {user?.name || user?.username}
            {user?.className ? ` · Lớp ${user.className}` : ""} — làm bài trước hạn nộp, hệ thống chấm điểm ngay sau khi nộp.
          </p>
        </div>
      </div>

      {loading && <p className="as-empty">Đang tải...</p>}
      {error && (
        <div className="auth-error as-alert">
          <span>!</span>
          <p>{error}</p>
        </div>
      )}

      {!loading &&
        !error &&
        sections.map(([title, items, emptyText]) =>
          items.length || emptyText ? (
            <section key={title} className="as-section">
              <h3>
                {title} <span>{items.length}</span>
              </h3>
              {items.length ? (
                <div className="as-grid">
                  {items.map((a) => (
                    <AssignmentCard key={a.id} a={a} />
                  ))}
                </div>
              ) : (
                <p className="as-empty small">{emptyText}</p>
              )}
            </section>
          ) : null,
        )}
    </div>
  );
}
