// pages/assignments/TakeAssignmentPage.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { saveAnswers, startAssignment, submitAssignment } from "../../api/assignments";
import { formatClock } from "./assignmentUtils";
import GamePlay from "./play/GamePlay";

/* Học sinh làm bài: đồng hồ đếm ngược, tự lưu đáp án, tự nộp khi hết giờ.
 * Bài giáo viên giao dạng trò chơi thì chơi ở GamePlay (tự chấm, tự nộp riêng). */
export default function TakeAssignmentPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [paper, setPaper] = useState(null);
  const [answers, setAnswers] = useState({}); // questionNumber -> key
  const [error, setError] = useState("");
  const [saveState, setSaveState] = useState("idle"); // idle | saving | saved | error
  const [submitting, setSubmitting] = useState(false);
  const [now, setNow] = useState(Date.now());

  const skewRef = useRef(0); // chênh lệch giờ máy khách so với server
  const saveTimer = useRef(null);
  const submittedRef = useRef(false);

  useEffect(() => {
    startAssignment(id)
      .then((res) => {
        skewRef.current = new Date(res.serverTime).getTime() - Date.now();
        setPaper(res);
        setAnswers(Object.fromEntries(res.answers.map((a) => [a.questionNumber, a.answer])));
      })
      .catch((err) => setError(err.message || "Không mở được bài tập."));
  }, [id]);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const answerList = useCallback(
    (map) => Object.entries(map).map(([questionNumber, answer]) => ({ questionNumber: Number(questionNumber), answer })),
    [],
  );

  const doSubmit = useCallback(
    async (auto = false) => {
      if (!paper || submittedRef.current) return;
      submittedRef.current = true;
      setSubmitting(true);
      window.clearTimeout(saveTimer.current);
      try {
        const res = await submitAssignment(paper.submission.id, answerList(answers));
        navigate(`/bai-tap/ket-qua/${res.submission.id}`, { replace: true, state: { auto } });
      } catch (err) {
        submittedRef.current = false;
        setSubmitting(false);
        setError(err.message || "Nộp bài thất bại, vui lòng thử lại.");
      }
    },
    [paper, answers, answerList, navigate],
  );

  const remaining = paper ? new Date(paper.submission.expiresAt).getTime() - (now + skewRef.current) : 0;
  const isGame = !!paper?.assignment.game;

  // Hết giờ -> tự nộp
  useEffect(() => {
    if (paper && !isGame && remaining <= 0 && !submittedRef.current) doSubmit(true);
  }, [paper, isGame, remaining, doSubmit]);

  // Cảnh báo khi rời trang lúc đang làm (trò chơi tự cảnh báo trong GamePlay)
  useEffect(() => {
    if (isGame) return undefined;
    const warn = (e) => {
      if (!submittedRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isGame]);

  function choose(number, key) {
    if (submitting) return;
    const next = { ...answers, [number]: key };
    setAnswers(next);
    setSaveState("saving");
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      saveAnswers(paper.submission.id, answerList(next))
        .then(() => setSaveState("saved"))
        .catch(() => setSaveState("error"));
    }, 700);
  }

  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);

  function confirmSubmit() {
    const left = paper.questions.length - answeredCount;
    const msg = left > 0 ? `Em còn ${left} câu chưa trả lời. Vẫn nộp bài?` : "Nộp bài ngay bây giờ?";
    if (window.confirm(msg)) doSubmit(false);
  }

  if (error && !paper) {
    return (
      <div className="page as-page">
        <div className="as-empty">
          <span>🔒</span>
          <strong>{error}</strong>
          <Link className="btn btn-light" to="/bai-tap">
            ← Về danh sách bài tập
          </Link>
        </div>
      </div>
    );
  }

  if (!paper) return <div className="page as-page"><p className="as-empty">Đang mở đề...</p></div>;
  if (isGame) return <GamePlay paper={paper} />;

  const { assignment, questions } = paper;
  const urgent = remaining < 60 * 1000;

  return (
    <div className="as-take">
      <header className="as-take-bar">
        <div className="as-take-title">
          <strong>{assignment.title}</strong>
          <span>
            {answeredCount}/{questions.length} câu đã trả lời ·{" "}
            {saveState === "saving" ? "Đang lưu..." : saveState === "saved" ? "Đã lưu" : saveState === "error" ? "Chưa lưu được" : "Tự động lưu"}
          </span>
        </div>
        <div className={"as-timer" + (urgent ? " urgent" : "")}>⏱ {formatClock(remaining)}</div>
        <button className="btn btn-primary" onClick={confirmSubmit} disabled={submitting}>
          {submitting ? "Đang nộp..." : "Nộp bài"}
        </button>
      </header>

      <div className="as-take-progress">
        <span style={{ width: `${(answeredCount / questions.length) * 100}%` }} />
      </div>

      {error && (
        <div className="auth-error as-alert as-take-alert">
          <span>!</span>
          <p>{error}</p>
        </div>
      )}

      <div className="as-take-layout">
        <ol className="as-take-questions">
          {questions.map((q) => (
            <li key={q.number} id={`q-${q.displayNumber}`} className="as-take-question">
              <div className="as-question-text">
                <span className="as-qnum">{q.displayNumber}</span>
                <span>{q.text}</span>
              </div>
              <div className="as-option-grid">
                {q.options.map((o) => (
                  <button
                    key={o.key}
                    type="button"
                    className={"as-option" + (answers[q.number] === o.key ? " chosen" : "")}
                    onClick={() => choose(q.number, o.key)}
                    disabled={submitting}
                  >
                    <span className="as-option-letter">{o.letter}</span>
                    <span>{o.text}</span>
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ol>

        <aside className="as-take-nav">
          <strong>Danh sách câu</strong>
          <div className="as-take-nav-grid">
            {questions.map((q) => (
              <a key={q.number} href={`#q-${q.displayNumber}`} className={answers[q.number] ? "done" : ""}>
                {q.displayNumber}
              </a>
            ))}
          </div>
          <button className="btn btn-primary block" onClick={confirmSubmit} disabled={submitting}>
            Nộp bài
          </button>
        </aside>
      </div>
    </div>
  );
}
