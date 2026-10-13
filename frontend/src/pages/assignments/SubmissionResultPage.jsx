// pages/assignments/SubmissionResultPage.jsx
import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { getMySubmission } from "../../api/assignments";
import { formatDateTime, formatDuration, formatScore } from "./assignmentUtils";

/* Kết quả 1 lượt làm bài của học sinh (+ xem lại đáp án nếu giáo viên cho phép) */
export default function SubmissionResultPage() {
  const { sid } = useParams();
  const location = useLocation();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getMySubmission(sid)
      .then(setData)
      .catch((err) => setError(err.message || "Không tải được kết quả."));
  }, [sid]);

  if (error) {
    return (
      <div className="page as-page">
        <div className="auth-error as-alert">
          <span>!</span>
          <p>{error}</p>
        </div>
      </div>
    );
  }
  if (!data) return <div className="page as-page"><p className="as-empty">Đang tải kết quả...</p></div>;

  const { assignment: a, submission: s, review } = data;
  const percent = s.totalQuestions ? Math.round((s.correctCount / s.totalQuestions) * 100) : 0;

  return (
    <div className="page as-page as-result-page">
      <Link className="as-back" to="/bai-tap">
        ← Bài tập của em
      </Link>

      <div className="as-score-card">
        <div className="as-score-ring" style={{ "--p": percent }}>
          <strong>{formatScore(s.score)}</strong>
          <span>/ {a.totalPoints} điểm</span>
        </div>
        <div className="as-score-info">
          <span className="as-badge open">Đã nộp bài</span>
          <h2>{a.title}</h2>
          {(location.state?.auto || s.autoSubmitted) && <p className="as-auto-note">⏱ Hết giờ — hệ thống đã tự nộp bài.</p>}
          <dl className="as-item-meta">
            <div>
              <dt>Số câu đúng</dt>
              <dd>
                {s.correctCount}/{s.totalQuestions}
              </dd>
            </div>
            <div>
              <dt>Thời gian làm</dt>
              <dd>{formatDuration(s.durationSeconds)}</dd>
            </div>
            <div>
              <dt>Nộp lúc</dt>
              <dd>{formatDateTime(s.submittedAt)}</dd>
            </div>
            <div>
              <dt>Lượt</dt>
              <dd>
                {s.attempt}/{a.maxAttempts}
              </dd>
            </div>
          </dl>
          <p className="as-meta-line">
            {s.studentName} · {s.studentUsername}
            {s.className ? ` · Lớp ${s.className}` : ""}
          </p>
        </div>
      </div>

      {review ? (
        <section className="as-card">
          <div className="as-card-head">
            <div>
              <h3>Xem lại bài làm</h3>
              <p>Xanh: đáp án đúng · Đỏ: lựa chọn sai của em.</p>
            </div>
          </div>
          <ol className="as-question-list as-readonly">
            {review.map((q) => (
              <li key={q.number} className={"as-question" + (q.chosen === q.correct ? " right" : " wrong")}>
                <div className="as-question-text">
                  <b>Câu {q.displayNumber}.</b> {q.text}
                  {!q.chosen && <em className="as-skip">Chưa trả lời</em>}
                </div>
                <div className="as-option-grid">
                  {q.options.map((o) => (
                    <span
                      key={o.key}
                      className={
                        "as-option" +
                        (o.key === q.correct ? " correct" : "") +
                        (o.key === q.chosen && o.key !== q.correct ? " wrong" : "")
                      }
                    >
                      <span className="as-option-letter">{o.letter}</span>
                      <span>{o.text}</span>
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : (
        <p className="as-empty small">Giáo viên chưa cho xem đáp án của bài này.</p>
      )}
    </div>
  );
}
