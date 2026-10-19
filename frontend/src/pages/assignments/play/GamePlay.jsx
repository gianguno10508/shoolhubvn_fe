// pages/assignments/play/GamePlay.jsx — học sinh chơi bài tập dạng trò chơi trên web (cùng luật với app mobile).
// Điểm được chấm và lưu như bài cổ điển; không có bảng xếp hạng.
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { formatClock } from "../assignmentUtils";
import { gameOf } from "../game/GameHub";
import { playSound, readMuted, writeMuted } from "../game/gameSound";
import useGameSession from "./useGameSession";

const OBSTACLES = ["🧱", "🌵", "🪨", "🚧", "🛢️"];
const PRIZES = [
  200_000, 400_000, 600_000, 1_000_000, 2_000_000, 3_000_000, 6_000_000, 10_000_000, 14_000_000, 22_000_000, 30_000_000,
  40_000_000, 80_000_000, 150_000_000, 250_000_000,
];

/** Giãn thang 15 bậc theo số câu của đề */
function prizeAt(level, total) {
  if (level <= 0 || !total) return 0;
  return PRIZES[Math.min(PRIZES.length, Math.ceil((level * PRIZES.length) / total)) - 1];
}

const money = (n) => n.toLocaleString("vi-VN") + " đ";

export default function GamePlay({ paper }) {
  const navigate = useNavigate();
  const s = useGameSession(paper);
  const key = paper.assignment.game;
  const info = gameOf(key);
  const [muted, setMuted] = useState(readMuted);
  const [helps, setHelps] = useState({ postpone: false, time: false });

  const sound = (name) => !muted && playSound(name);
  const soundRef = useRef(sound);
  soundRef.current = sound;

  // Âm thanh theo diễn biến
  useEffect(() => {
    if (!s.feedback) return;
    const zombie = key === "zombie";
    soundRef.current(s.feedback.correct ? (zombie ? "shot" : "correct") : zombie ? "slash" : "wrong");
  }, [s.feedback, key]);

  useEffect(() => {
    if (s.result) soundRef.current(s.result.outcome === "win" ? "win" : "lose");
  }, [s.result?.outcome]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (s.phase === "question" && s.qLeft > 0 && s.qLeft <= 5) soundRef.current("tick");
  }, [s.phase, s.qLeft]);

  // Cảnh báo khi đóng tab giữa chừng
  useEffect(() => {
    const playing = s.phase !== "intro" && s.phase !== "over";
    if (!playing) return undefined;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [s.phase]);

  function toggleMute() {
    setMuted((m) => {
      writeMuted(!m);
      return !m;
    });
  }

  const playing = s.phase === "question" || s.phase === "checking" || s.phase === "reveal";
  const winTitle =
    key === "millionaire" ? `Bạn giành được ${money(prizeAt(s.correct, s.total))}!` : key === "zombie" ? "Zombie đã bị hạ gục!" : "Về đích!";

  return (
    <div className={"pg pg-" + key}>
      <header className="pg-bar">
        <Link className="pg-back" to="/bai-tap" onClick={(e) => playing && !window.confirm("Thoát trò chơi? Các câu đã trả lời vẫn được giữ, thời gian vẫn chạy.") && e.preventDefault()}>
          ←
        </Link>
        <div className="pg-title">
          <strong>
            {info.icon} {paper.assignment.title}
          </strong>
          <span>{info.name}</span>
        </div>
        {s.game.lives > 1 && (
          <span className="pg-hearts" title="Số mạng">
            {Array.from({ length: s.game.lives }, (_, i) => (i < s.lives ? "❤️" : "🖤")).join(" ")}
          </span>
        )}
        <span className="pg-stat">✓ {s.correct}</span>
        <span className={"pg-stat" + (s.timeLeft !== null && s.timeLeft <= 60 ? " urgent" : "")}>
          ⏱ {s.timeLeft === null ? "--:--" : formatClock(Math.max(0, s.timeLeft) * 1000)}
        </span>
        <button type="button" className="pg-mute" onClick={toggleMute} title={muted ? "Bật âm thanh" : "Tắt âm thanh"}>
          {muted ? "🔇" : "🔊"}
        </button>
      </header>

      <main className="pg-body">
        {s.error && s.phase !== "over" && (
          <div className="auth-error as-alert">
            <span>!</span>
            <p>{s.error}</p>
          </div>
        )}

        {key === "millionaire" ? (
          <MillionaireStage
            level={s.correct}
            total={s.total}
            feedback={s.feedback}
            helps={helps}
            canHelp={s.phase === "question"}
            onPostpone={() => s.postpone() && setHelps((h) => ({ ...h, postpone: true }))}
            onAddTime={() => {
              s.addTime(15);
              setHelps((h) => ({ ...h, time: true }));
            }}
          />
        ) : key === "zombie" ? (
          <ZombieStage hp={s.total - s.correct} maxHp={s.total} livesLost={s.wrong} maxLives={s.game.lives} feedback={s.feedback} />
        ) : (
          <ObstacleStage done={s.answeredCount} total={s.total} feedback={s.feedback} />
        )}

        {s.phase === "intro" && (
          <section className="pg-card pg-center">
            <div className="pg-big-icon">{info.icon}</div>
            <h2>{info.name}</h2>
            <p className="pg-sub">{paper.assignment.title}</p>
            <p className="pg-rules">{s.game.rules}</p>
            <p className="pg-sub">
              {s.total} câu · {s.game.seconds} giây/câu{s.resumed ? ` · đã chơi ${s.answeredCount} câu` : ""}
            </p>
            <button type="button" className="pg-btn" onClick={s.begin}>
              {s.resumed ? "▶ Chơi tiếp" : "▶ Bắt đầu"}
            </button>
          </section>
        )}

        {playing && s.question && (
          <>
            <div className="pg-timer">
              <span style={{ width: `${Math.min(100, (s.qLeft / s.game.seconds) * 100)}%` }} className={s.qLeft <= 5 ? "urgent" : ""} />
              <b className={s.qLeft <= 5 ? "urgent" : ""}>{s.qLeft}s</b>
            </div>
            <QuestionCard
              question={s.question}
              index={Math.min(s.answeredCount + (s.phase === "reveal" ? 0 : 1), s.total)}
              total={s.total}
              phase={s.phase}
              feedback={s.feedback}
              onAnswer={s.answer}
            />
          </>
        )}

        {s.phase === "over" && s.result && (
          <section className="pg-card pg-center">
            <div className="pg-big-icon">{{ win: "🏆", lose: "💀", timeup: "⏰" }[s.result.outcome]}</div>
            <h2>{s.result.outcome === "win" ? winTitle : s.result.outcome === "lose" ? "Thua rồi!" : "Hết giờ làm bài!"}</h2>
            <p className="pg-count">
              Đúng {s.correct}/{s.total} câu
            </p>
            {s.result.submission ? (
              <>
                <p className="pg-sub">
                  Điểm: <b>{s.result.submission.score}</b>/{paper.assignment.totalPoints} — đã ghi vào bài tập
                </p>
                <button
                  type="button"
                  className="pg-btn"
                  onClick={() => navigate(`/bai-tap/ket-qua/${s.result.submission.id}`, { replace: true })}
                >
                  Xem kết quả
                </button>
                <Link className="pg-btn ghost" to="/bai-tap">
                  Về danh sách bài
                </Link>
              </>
            ) : s.error ? (
              <>
                <p className="pg-sub bad-text">{s.error}</p>
                <button type="button" className="pg-btn" onClick={() => s.finish(s.result.outcome)}>
                  Nộp lại
                </button>
              </>
            ) : (
              <p className="pg-sub">Đang nộp kết quả...</p>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

/** Câu hỏi + 4 phương án; lúc hiện kết quả tô xanh/đỏ (và đáp án đúng nếu giáo viên cho xem) */
function QuestionCard({ question, index, total, phase, feedback, onAnswer }) {
  const [picked, setPicked] = useState(null);
  useEffect(() => setPicked(null), [question.number]);
  const showing = phase === "reveal" && feedback?.number === question.number ? feedback : null;

  // Phím 1-4 / A-D để chọn nhanh
  useEffect(() => {
    if (phase !== "question") return undefined;
    const onKey = (e) => {
      const i = "1234".indexOf(e.key) >= 0 ? "1234".indexOf(e.key) : "abcd".indexOf(e.key.toLowerCase());
      const o = question.options[i];
      if (o && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setPicked(o.key);
        onAnswer(o.key);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, question, onAnswer]);

  return (
    <section className={"pg-card pg-question" + (showing && !showing.correct ? " shake" : "")} key={showing?.seq}>
      <div className="pg-qnum">
        Câu {index}/{total}
      </div>
      <p className="pg-qtext">{question.text}</p>
      <div className="pg-options">
        {question.options.map((o) => {
          const chosen = showing ? showing.chosen === o.key : phase === "checking" && picked === o.key;
          const right = showing && (showing.correctAnswer === o.key || (chosen && showing.correct));
          const bad = showing && chosen && !showing.correct;
          return (
            <button
              key={o.key}
              type="button"
              disabled={phase !== "question"}
              className={"pg-option" + (right ? " right" : bad ? " bad" : chosen ? " chosen" : "")}
              onClick={() => {
                setPicked(o.key);
                onAnswer(o.key);
              }}
            >
              <span className="pg-letter">{o.letter}</span>
              <span>{o.text}</span>
            </button>
          );
        })}
      </div>
      {phase === "checking" && <p className="pg-verdict">Đang chấm...</p>}
      {showing && (
        <p className={"pg-verdict " + (showing.correct ? "ok" : "no")}>
          {showing.correct ? "✓ Chính xác!" : showing.chosen ? "✗ Sai rồi!" : "⏰ Hết giờ!"}
        </p>
      )}
    </section>
  );
}

/* ---------- Vượt chướng ngại vật ---------- */
function ObstacleStage({ done, total, feedback }) {
  const obstacle = feedback ? OBSTACLES[feedback.seq % OBSTACLES.length] : null;
  const progress = total ? (done / total) * 100 : 0;
  return (
    <div className="pg-stage">
      <div className="pg-track">
        <span className="pg-track-fill" style={{ width: `${progress}%` }} />
        <span className="pg-track-runner" style={{ left: `${Math.min(progress, 94)}%` }}>
          🏃
        </span>
        <span className="pg-track-flag">🏁</span>
      </div>
      <div className="pg-scene ob-scene">
        <span className="pg-cloud" style={{ left: "15%" }}>
          ☁️
        </span>
        <span className="pg-cloud" style={{ left: "62%", top: 26 }}>
          ☁️
        </span>
        <div className="ob-ground" />
        <span key={"r" + (feedback?.seq || 0)} className={"ob-runner" + (feedback ? (feedback.correct ? " jump" : " hit") : "")}>
          <span>🏃</span>
        </span>
        {feedback && (
          <span key={"o" + feedback.seq} className={"ob-obstacle " + (feedback.correct ? "pass" : "crash")}>
            {obstacle}
          </span>
        )}
        {feedback && !feedback.correct && (
          <span key={"b" + feedback.seq} className="ob-boom">
            💥
          </span>
        )}
      </div>
    </div>
  );
}

/* ---------- Bắn zombie ---------- */
function ZombieStage({ hp, maxHp, livesLost, maxLives, feedback }) {
  // Mỗi mạng mất, zombie tiến lại gần thêm một đoạn (vị trí tính theo % chiều rộng sân khấu)
  const zx = 86 - (livesLost / Math.max(1, maxLives)) * 62;
  const dead = hp <= 0;
  return (
    <div className="pg-stage">
      <div className="pg-scene zb-scene" style={{ "--zx": `${zx}%` }}>
        <span className="pg-cloud" style={{ left: "72%", top: 10 }}>
          🌕
        </span>
        <span className="zb-prop" style={{ left: "38%" }}>
          🪦
        </span>
        <span className="zb-prop small" style={{ left: "56%" }}>
          🪦
        </span>
        <div className="zb-ground" />
        <span className="zb-player">🧍</span>
        <span className="zb-gun">🔫</span>
        <div
          key={"z" + (feedback?.seq || 0)}
          className={"zb-zombie" + (dead ? " dead" : feedback && !feedback.correct ? " lunge" : "")}
        >
          <div className={"zb-body" + (feedback?.correct && !dead ? " flinch" : "")}>
            <div className="zb-hp">
              <span style={{ width: `${maxHp ? (Math.max(0, hp) / maxHp) * 100 : 0}%` }} />
            </div>
            <span className="zb-face">{dead ? "☠️" : "🧟"}</span>
            {feedback?.correct && <span className="zb-hit">💥</span>}
          </div>
        </div>
        {feedback?.correct && <span key={"b" + feedback.seq} className="zb-bullet" />}
        {feedback && !feedback.correct && <span key={"f" + feedback.seq} className="zb-flash" />}
      </div>
      <p className="zb-caption">
        Zombie còn {Math.max(0, hp)}/{maxHp} máu
      </p>
    </div>
  );
}

/* ---------- Ai là triệu phú ---------- */
function MillionaireStage({ level, total, feedback, helps, canHelp, onPostpone, onAddTime }) {
  const ladderRef = useRef(null);
  useEffect(() => {
    ladderRef.current?.children[Math.min(level, total - 1)]?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [level, total]);

  return (
    <div className="pg-stage">
      <div className="mp-prize">
        <small>Tiền thưởng hiện có</small>
        <strong key={feedback?.correct ? feedback.seq : "p"} className={feedback?.correct ? "pulse" : ""}>
          {money(prizeAt(level, total))}
        </strong>
        {level < total && <small>Câu tiếp theo: {money(prizeAt(level + 1, total))}</small>}
      </div>
      <div className="mp-ladder" ref={ladderRef}>
        {Array.from({ length: total }, (_, i) => (
          <div key={i} className={"mp-step" + (i < level ? " passed" : i === level ? " current" : "")}>
            <b>{i + 1}</b>
            <span>{money(prizeAt(i + 1, total))}</span>
          </div>
        ))}
      </div>
      <div className="mp-helps">
        <button type="button" disabled={helps.postpone || !canHelp} onClick={onPostpone}>
          🔄 Hoãn câu này{helps.postpone ? " ✗" : ""}
        </button>
        <button type="button" disabled={helps.time || !canHelp} onClick={onAddTime}>
          ⏱ +15 giây{helps.time ? " ✗" : ""}
        </button>
      </div>
    </div>
  );
}
