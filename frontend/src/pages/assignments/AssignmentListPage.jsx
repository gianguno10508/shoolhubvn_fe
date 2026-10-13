// pages/assignments/AssignmentListPage.jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listAssignments } from "../../api/assignments";
import { useAuth } from "../../context/AuthContext";
import { hasPermission } from "../../utils/permissions";
import { assignmentState, formatDateTime, formatScore, timeLeft } from "./assignmentUtils";

/* Danh sách bài tập đã giao (mọi chức danh trừ học sinh / cờ đỏ) */
export default function AssignmentListPage() {
  const { user } = useAuth();
  const canSeeAll = hasPermission(user, "users.view");

  const [scope, setScope] = useState("mine");
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function load() {
    setLoading(true);
    setError("");
    listAssignments(scope)
      .then(setList)
      .catch((err) => setError(err.message || "Không tải được danh sách bài tập."))
      .finally(() => setLoading(false));
  }

  useEffect(load, [scope]);

  return (
    <div className="page as-page">
      <div className="page-head">
        <span className="page-head-icon as-icon">📝</span>
        <div>
          <h2>Bài tập & Tự chấm</h2>
          <p>Giao bài trắc nghiệm từ file PDF, học sinh làm trực tuyến và được chấm điểm tự động.</p>
        </div>
        <div className="spacer" />
        <Link className="btn btn-primary" to="/giao-vien/bai-tap/moi">
          + Giao bài mới
        </Link>
      </div>

      {canSeeAll && (
        <div className="tabs">
          <button className={"tab" + (scope === "mine" ? " active" : "")} onClick={() => setScope("mine")}>
            Bài tôi giao
          </button>
          <button className={"tab" + (scope === "all" ? " active" : "")} onClick={() => setScope("all")}>
            Toàn trường
          </button>
        </div>
      )}

      {loading && <p className="as-empty">Đang tải...</p>}

      {!loading && error && (
        <div className="auth-error as-alert">
          <span>!</span>
          <p>
            {error}{" "}
            <button className="link-btn" onClick={load}>
              Thử lại
            </button>
          </p>
        </div>
      )}

      {!loading && !error && list.length === 0 && (
        <div className="as-empty">
          <span>📭</span>
          <strong>Chưa có bài tập nào</strong>
          <p>Bấm “Giao bài mới” để tải đề PDF và giao cho lớp.</p>
        </div>
      )}

      {!loading && !error && list.length > 0 && (
        <div className="as-grid">
          {list.map((a) => {
            const state = assignmentState(a);
            const percent = a.studentCount ? Math.round((a.submittedCount / a.studentCount) * 100) : 0;
            return (
              <Link key={a.id} to={`/giao-vien/bai-tap/${a.id}`} className="as-item">
                <div className="as-item-top">
                  <span className={"as-badge " + state.key}>{state.label}</span>
                  {state.key === "open" && <span className="as-item-left">{timeLeft(a.dueAt)}</span>}
                </div>
                <h3>{a.title}</h3>
                <div className="as-item-classes">
                  {a.classNames.map((n) => (
                    <span key={n}>{n}</span>
                  ))}
                </div>
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
                    <dt>Điểm TB</dt>
                    <dd>{formatScore(a.averageScore, a.totalPoints)}</dd>
                  </div>
                </dl>
                <div className="as-progress">
                  <div className="as-progress-bar">
                    <span style={{ width: `${percent}%` }} />
                  </div>
                  <small>
                    {a.submittedCount}/{a.studentCount} học sinh đã nộp
                  </small>
                </div>
                {scope === "all" && a.createdBy && (
                  <small className="as-item-owner">Giao bởi {a.createdBy.name || a.createdBy.username}</small>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
