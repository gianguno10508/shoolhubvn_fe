// pages/assignments/game/ZombieGame.jsx
import { useCallback, useEffect, useRef, useState } from "react";
import { LETTERS, shuffleArray } from "../../../utils/pdfQuestions";
import { boardKey } from "./leaderboard";
import {
  Confetti,
  LeaderboardCard,
  MissedList,
  QuestionFileCard,
  ResultBoard,
  Stars,
  starsOf,
  Switch,
  useFullscreen,
  useGameKit,
  useLeaderboard,
  usePlayingSignal,
} from "./GameShared";

/* Trò chơi "Bắn zombie": khẩu súng của người chơi đối mặt với 1 zombie, máu zombie = số câu hỏi.
 * Trả lời đúng → bắn 1 viên đạn, zombie mất 1 máu; đúng hết → zombie gục ngã.
 * Trả lời sai / hết giờ → zombie chém, người chơi mất 1 mạng (số mạng theo cài đặt); hết mạng là thua.
 * Thời gian trôi, zombie càng tiến lại gần. Câu sai có thể được hỏi lại ở cuối (nếu bật). */

const COUNTDOWN_FROM = 3;
const MIN_SECONDS = 5;
const MAX_SECONDS = 300;
const SHOOT_MS = 1000;
const SLASH_MS = 1300;
const REVEAL_MS = 2200; // hiện đáp án đúng sau khi bị chém rồi sang câu sau
const DEATH_MS = 1400;
const BASE_POINTS = 100;
const MAX_TIME_BONUS = 100;
const HEADSHOT_RATE = 0.7; // trả lời khi còn ≥ 70% thời gian → headshot
const HEADSHOT_BONUS = 50;

const clampSeconds = (v) => Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, Math.round(Number(v) || 0)));
const clampLives = (v) => Math.min(5, Math.max(1, Math.round(Number(v) || 1)));

function multiplierOf(streak) {
  if (streak >= 8) return 3;
  if (streak >= 5) return 2;
  if (streak >= 3) return 1.5;
  return 1;
}

function withOptions(q, shuffle) {
  return {
    ...q,
    options: (shuffle ? shuffleArray(q.options) : q.options).map((o, i) => ({
      ...o,
      letter: LETTERS[i],
      isCorrect: o.originalLetter === q.correctAnswer,
    })),
  };
}

/** Khẩu súng nhìn ngang, nòng hướng sang trái (về phía zombie) */
function Gun() {
  return (
    <svg className="zg-gun-svg" viewBox="0 0 220 140" aria-hidden="true">
      <defs>
        <linearGradient id="zg-slide" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9ca3af" />
          <stop offset="0.45" stopColor="#4b5563" />
          <stop offset="1" stopColor="#1f2937" />
        </linearGradient>
        <linearGradient id="zg-grip" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#78350f" />
          <stop offset="1" stopColor="#451a03" />
        </linearGradient>
      </defs>
      {/* nòng */}
      <rect x="2" y="30" width="22" height="16" rx="3" fill="#111827" />
      {/* khung dưới */}
      <path d="M30 52 H190 V66 H120 Q112 66 108 72 L100 84 H70 Q62 84 60 76 L56 66 H30 Z" fill="#1f2937" />
      {/* vòng cò */}
      <path d="M100 66 Q100 96 82 96 Q66 96 66 82" fill="none" stroke="#111827" strokeWidth="6" strokeLinecap="round" />
      <path d="M90 66 Q92 80 84 84" fill="none" stroke="#9ca3af" strokeWidth="4" strokeLinecap="round" />
      {/* báng súng */}
      <path d="M128 60 H192 L212 132 Q213 138 206 138 H156 Q150 138 149 132 Z" fill="url(#zg-grip)" />
      <path d="M150 74 H194 M154 88 H198 M158 102 H202 M162 116 H206" stroke="#2a1003" strokeWidth="3" opacity="0.6" />
      {/* thân trượt */}
      <rect x="18" y="18" width="182" height="38" rx="6" fill="url(#zg-slide)" />
      <path d="M150 24 V50 M158 24 V50 M166 24 V50 M174 24 V50 M182 24 V50" stroke="#111827" strokeWidth="3" opacity="0.7" />
      <rect x="26" y="12" width="10" height="8" rx="2" fill="#111827" />
      <rect x="182" y="12" width="12" height="8" rx="2" fill="#111827" />
      <circle cx="31" cy="15" r="2" fill="#fde047" />
    </svg>
  );
}

export default function ZombieGame({ deck, onDeckChange, onPlaying }) {
  const gameRef = useRef(null);
  const popId = useRef(0);
  const lastTick = useRef(null);
  const { later, clearTimers, sfx, muted, toggleMute } = useGameKit();
  const fs = useFullscreen(gameRef);
  const { file, questions } = deck;

  /* ----- Cài đặt ----- */
  const [settings, setSettings] = useState({
    seconds: 20,
    lives: 3,
    retry: true, // câu sai được hỏi lại ở cuối
    shuffleQuestions: true,
    shuffleOptions: true,
  });
  const set = (field, value) => setSettings((prev) => ({ ...prev, [field]: value }));

  /* ----- Lượt chơi ----- */
  const [queue, setQueue] = useState([]); // [{ key, n, q }] — mỗi phần tử là 1 viên đạn
  const queueRef = useRef(queue);
  queueRef.current = queue;
  const [pos, setPos] = useState(0);
  const [phase, setPhase] = useState("setup"); // setup | countdown | question | shoot | slash | win | over | empty
  const [countdown, setCountdown] = useState(COUNTDOWN_FROM);
  const [picked, setPicked] = useState(null);
  const [reason, setReason] = useState(null); // wrong | timeout
  const [deadline, setDeadline] = useState(0);
  const [qTotal, setQTotal] = useState(1);
  const [now, setNow] = useState(Date.now());
  const [frozenNear, setFrozenNear] = useState(0); // khoảng cách zombie lúc trả lời

  const [hp, setHp] = useState(1);
  const [maxHp, setMaxHp] = useState(1);
  const [lives, setLives] = useState(3);
  const [maxLives, setMaxLives] = useState(3);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [misses, setMisses] = useState([]); // [{ q, i, status }] — mỗi câu 1 lần
  const [fx, setFx] = useState(0); // tăng mỗi phát bắn / nhát chém để chạy lại hiệu ứng
  const [pops, setPops] = useState([]);

  const lb = useLeaderboard(file ? boardKey(file.name, questions.length, "zombie") : null);
  usePlayingSignal(phase !== "setup", onPlaying);

  const addPop = useCallback(
    (text, kind = "") => {
      const id = ++popId.current;
      setPops((p) => [...p, { id, text, kind }]);
      later(() => setPops((p) => p.filter((x) => x.id !== id)), 1300);
    },
    [later],
  );

  /* ----- Điều khiển ----- */
  const startQuestion = useCallback(
    (p) => {
      const total = clampSeconds(settings.seconds) * 1000;
      const t = Date.now();
      setPos(p);
      setPicked(null);
      setReason(null);
      setNow(t);
      setQTotal(total);
      setDeadline(t + total);
      setFrozenNear(0);
      lastTick.current = null;
      setPhase("question");
      if (p % 3 === 0) sfx("groan");
    },
    [settings.seconds, sfx],
  );

  const endGame = useCallback(
    (kind, finalScore) => {
      setPhase(kind);
      sfx(kind === "win" ? "win" : "lose");
      lb.finish(finalScore);
    },
    [sfx, lb],
  );

  /** Sang viên đạn tiếp theo; hết đạn mà zombie còn sống là thua */
  const goNext = useCallback(
    (p, finalScore) => {
      if (p + 1 >= queueRef.current.length) endGame("empty", finalScore);
      else startQuestion(p + 1);
    },
    [startQuestion, endGame],
  );

  function startGame() {
    clearTimers();
    const list = settings.shuffleQuestions ? shuffleArray(questions) : [...questions];
    const startLives = clampLives(settings.lives);
    setQueue(list.map((q, n) => ({ key: q.id, n, q: withOptions(q, settings.shuffleOptions) })));
    setHp(list.length);
    setMaxHp(list.length);
    setLives(startLives);
    setMaxLives(startLives);
    setScore(0);
    setStreak(0);
    setBestStreak(0);
    setAttempts(0);
    setMisses([]);
    setPops([]);
    setPos(0);
    lb.reset();
    setCountdown(COUNTDOWN_FROM);
    setPhase("countdown");
    sfx("count");
    for (let k = 1; k <= COUNTDOWN_FROM; k++) {
      later(() => {
        setCountdown(COUNTDOWN_FROM - k);
        sfx(k < COUNTDOWN_FROM ? "count" : "go");
      }, k * 800);
    }
    later(() => startQuestion(0), COUNTDOWN_FROM * 800 + 500);
  }

  function backToSetup() {
    clearTimers();
    fs.exit();
    setPhase("setup");
    setQueue([]);
    lb.reset();
  }

  const near = phase === "question" ? Math.min(1, 1 - Math.max(0, deadline - now) / qTotal) : frozenNear;

  const fail = useCallback(
    (why) => {
      const item = queueRef.current[pos];
      const left = lives - 1;
      setFrozenNear(near);
      setReason(why);
      setStreak(0);
      setLives(left);
      setAttempts((a) => a + 1);
      setMisses((m) => (m.some((x) => x.q.id === item.q.id) ? m : [...m, { q: item.q, i: item.n, status: why }]));
      if (settings.retry) {
        setQueue((list) => [
          ...list,
          { key: `${item.q.id}#${list.length}`, n: item.n, q: withOptions(item.q, settings.shuffleOptions) },
        ]);
      }
      setFx((f) => f + 1);
      setPhase("slash");
      sfx("slash");
      addPop(`-1 ❤️`, "hurt");
      if (left <= 0) later(() => endGame("over", score), SLASH_MS);
      else later(() => goNext(pos, score), REVEAL_MS);
    },
    [pos, lives, near, settings.retry, settings.shuffleOptions, score, later, goNext, endGame, addPop, sfx],
  );

  const answer = useCallback(
    (letter) => {
      if (phase !== "question") return;
      const option = queueRef.current[pos].q.options.find((o) => o.letter === letter);
      if (!option) return;
      setPicked(letter);
      if (!option.isCorrect) return fail("wrong");

      const leftRate = Math.max(0, deadline - Date.now()) / qTotal;
      const headshot = leftRate >= HEADSHOT_RATE;
      const nextStreak = streak + 1;
      const mult = multiplierOf(nextStreak);
      const timeBonus = Math.round(MAX_TIME_BONUS * leftRate);
      const points = Math.round((BASE_POINTS + timeBonus + (headshot ? HEADSHOT_BONUS : 0)) * mult);
      const nextScore = score + points;
      const nextHp = hp - 1;

      setFrozenNear(near);
      setScore(nextScore);
      setStreak(nextStreak);
      setBestStreak((b) => Math.max(b, nextStreak));
      setAttempts((a) => a + 1);
      setHp(nextHp);
      setFx((f) => f + 1);
      setPhase("shoot");
      sfx("shot");
      addPop(headshot ? "HEADSHOT! 🎯" : `+${points}`, headshot ? "headshot" : "points");
      if (mult > multiplierOf(streak)) later(() => addPop(`COMBO x${mult}!`, "combo"), 250);

      if (nextHp <= 0) {
        later(() => {
          setPhase("dying");
          sfx("zombieDie");
        }, SHOOT_MS * 0.6);
        later(() => endGame("win", nextScore), SHOOT_MS * 0.6 + DEATH_MS);
      } else later(() => goNext(pos, nextScore), SHOOT_MS);
    },
    [phase, pos, deadline, qTotal, streak, score, hp, near, fail, later, goNext, endGame, addPop, sfx],
  );

  // Đồng hồ + tích tắc 5 giây cuối
  useEffect(() => {
    if (phase !== "question") return undefined;
    const t = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== "question") return;
    if (now >= deadline) {
      fail("timeout");
      return;
    }
    const sec = Math.ceil((deadline - now) / 1000);
    if (sec <= 5 && lastTick.current !== sec) {
      lastTick.current = sec;
      sfx("tick");
    }
  }, [phase, now, deadline, fail, sfx]);

  // Phím tắt: A–D hoặc 1–4
  useEffect(() => {
    if (phase === "setup") return undefined;
    const onKey = (e) => {
      if (e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      const k = e.key.toUpperCase();
      const letter = LETTERS.includes(k) ? k : LETTERS[Number(k) - 1];
      if (letter) answer(letter);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, answer]);

  /* =========================================================
     MÀN HÌNH CÀI ĐẶT
  ========================================================= */
  if (phase === "setup") {
    return (
      <>
        <QuestionFileCard deck={deck} onChange={onDeckChange} unit="viên đạn (máu zombie)" />

        <section className="as-card">
          <div className="as-card-head">
            <span className="as-step">2</span>
            <div>
              <h3>Cài đặt trò chơi</h3>
              <p>
                Mỗi câu đúng là 1 viên đạn bắn trúng zombie — trả lời đúng hết các câu thì zombie gục ngã 🧟. Sai hoặc hết
                giờ, zombie sẽ chém bạn mất 1 mạng ❤️. Thời gian càng trôi, zombie càng tiến lại gần!
              </p>
            </div>
          </div>

          <div className="as-form-grid">
            <label className="field">
              <span>Thời gian mỗi câu (giây)</span>
              <input
                type="number"
                min={MIN_SECONDS}
                max={MAX_SECONDS}
                value={settings.seconds}
                onChange={(e) => set("seconds", e.target.value)}
                onBlur={(e) => set("seconds", clampSeconds(e.target.value))}
              />
            </label>
            <label className="field">
              <span>Số mạng</span>
              <select value={settings.lives} onChange={(e) => set("lives", clampLives(e.target.value))}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {"❤️".repeat(n)} ({n} mạng)
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="as-switches">
            <Switch
              checked={settings.retry}
              onChange={(v) => set("retry", v)}
              label="Hỏi lại câu sai"
              sub="Câu trả lời sai được nạp lại vào cuối băng đạn. Tắt: sai là mất luôn viên đạn đó"
            />
            <Switch
              checked={settings.shuffleQuestions}
              onChange={(v) => set("shuffleQuestions", v)}
              label="Trộn thứ tự câu hỏi"
              sub="Mỗi lượt chơi một thứ tự khác"
            />
            <Switch
              checked={settings.shuffleOptions}
              onChange={(v) => set("shuffleOptions", v)}
              label="Trộn phương án A–D"
              sub="Tránh nhớ vị trí đáp án"
            />
            <Switch checked={!muted} onChange={toggleMute} label="Âm thanh" sub="Tiếng súng, tiếng zombie, tiếng chém" />
          </div>
        </section>

        {file && <LeaderboardCard lb={lb} />}

        <div className="as-submit-bar">
          <span>
            {questions.length
              ? `Zombie ${questions.length} máu · ${clampLives(settings.lives)} mạng · không lưu điểm lên hệ thống`
              : "Chưa có đề"}
          </span>
          <button className="btn btn-primary" type="button" onClick={startGame} disabled={!questions.length}>
            🔫 Bắt đầu chơi
          </button>
        </div>
      </>
    );
  }

  /* =========================================================
     MÀN HÌNH CHƠI
  ========================================================= */
  const item = queue[pos];
  const current = item.q;
  const isRetry = item.key !== current.id;
  const ended = phase === "win" || phase === "over" || phase === "empty";
  const showResult = phase === "shoot" || phase === "slash" || phase === "over" || phase === "dying";
  const remainingMs = Math.max(0, deadline - now);
  const timePercent = phase === "question" ? (remainingMs / qTotal) * 100 : phase === "countdown" ? 100 : 0;
  const ammo = Math.max(0, queue.length - pos - (phase === "question" || phase === "countdown" ? 0 : 1));
  const hpPercent = (hp / maxHp) * 100;
  const rightCount = maxHp - hp;
  const stars = starsOf(rightCount, Math.max(attempts, maxHp));
  const correctOption = current.options.find((o) => o.isCorrect);
  const mult = multiplierOf(streak);
  const zombieState =
    phase === "dying" || phase === "win"
      ? "dead"
      : phase === "shoot"
        ? "hit"
        : phase === "slash" || phase === "over"
          ? "attack"
          : phase === "countdown"
            ? "idle"
            : "walk";

  return (
    <div ref={gameRef} className={"og-game zg-game" + (fs.fullscreen ? " is-fullscreen" : "")}>
      <div className="og-hud">
        <div className="og-hud-item og-lives" title={`${lives}/${maxLives} mạng`}>
          <small>Mạng</small>
          <strong>
            {Array.from({ length: maxLives }, (_, i) => (
              <span key={i} className={i < lives ? "on" : "off"}>
                {i < lives ? "❤️" : "🤍"}
              </span>
            ))}
          </strong>
        </div>
        <div className="og-hud-item">
          <small>Điểm</small>
          <strong className="og-score" key={score}>
            {score.toLocaleString("vi-VN")}
          </strong>
        </div>
        <div className={"og-hud-item og-combo" + (mult > 1 ? " hot" : "")}>
          <small>Chuỗi đúng</small>
          <strong>
            🔥 {streak}
            {mult > 1 && <em>x{mult}</em>}
          </strong>
        </div>
        <div className="og-hud-item" title="Số câu hỏi còn lại">
          <small>Băng đạn</small>
          <strong>🔫 {ammo}</strong>
        </div>
        <div className="spacer" />
        <button className="btn btn-sm btn-light" type="button" onClick={toggleMute} title="Bật / tắt âm thanh">
          {muted ? "🔇" : "🔊"}
        </button>
        <button className="btn btn-sm btn-light" type="button" onClick={fs.toggle}>
          {fs.fullscreen ? "Thu nhỏ" : "⛶ Toàn màn hình"}
        </button>
        <button className="btn btn-sm btn-light" type="button" onClick={backToSetup}>
          Thoát
        </button>
      </div>

      {/* ----- Hiện trường ----- */}
      <div
        className={
          "zg-stage" + (phase === "slash" ? " is-hurt" : "") + (lives === 1 && !ended ? " is-critical" : "")
        }
        style={{ "--near": near }}
      >
        <span className="zg-moon" aria-hidden="true" />
        <div className="zg-horizon" aria-hidden="true">
          <span>🏚️</span>
          <span>🪦</span>
          <span>🌲</span>
          <span>🪦</span>
          <span>⚰️</span>
          <span>🌲</span>
          <span>🪦</span>
        </div>
        <span className="zg-fog f1" aria-hidden="true" />
        <span className="zg-fog f2" aria-hidden="true" />
        <div className="zg-ground" aria-hidden="true" />

        <div className={"zg-zombie " + zombieState}>
          <div className="zg-hp" title={`Máu zombie: ${hp}/${maxHp}`}>
            <span style={{ width: `${hpPercent}%` }} className={hpPercent <= 30 ? "low" : ""} />
            <b>
              🧟 {hp}/{maxHp}
            </b>
          </div>
          <span className="zg-zombie-body" key={zombieState === "hit" || zombieState === "attack" ? `z${fx}` : zombieState}>
            🧟
          </span>
          {phase === "shoot" && (
            <span className="zg-splat" key={`s${fx}`} aria-hidden="true">
              💥
            </span>
          )}
          {(phase === "dying" || phase === "win") && (
            <span className="zg-skull" aria-hidden="true">
              💀
            </span>
          )}
        </div>

        {phase === "question" && <span className="zg-crosshair" aria-hidden="true" />}

        {phase === "shoot" && <span className="zg-bullet" key={`b${fx}`} aria-hidden="true" />}

        <div className={"zg-gun" + (phase === "shoot" ? " recoil" : "")} key={phase === "shoot" ? `g${fx}` : "gun"}>
          {phase === "shoot" && <span className="zg-flash" aria-hidden="true" />}
          <Gun />
        </div>

        {phase === "slash" && (
          <div className="zg-claws" key={`c${fx}`} aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        )}

        {pops.map((p) => (
          <span key={p.id} className={"zg-pop " + p.kind}>
            {p.text}
          </span>
        ))}

        {phase === "countdown" && (
          <div className="og-countdown" key={countdown}>
            {countdown > 0 ? countdown : "Bắn!"}
          </div>
        )}
      </div>

      {/* ----- Thời gian ----- */}
      <div className="og-timer">
        <div className={"og-timer-bar zg-timer-bar" + (timePercent < 30 ? " urgent" : "")}>
          <span style={{ width: `${Math.min(100, timePercent)}%` }} />
        </div>
        <strong className={timePercent < 30 && phase === "question" ? "urgent" : ""}>
          {phase === "question" ? Math.ceil(remainingMs / 1000) : clampSeconds(settings.seconds)}s
        </strong>
      </div>

      {/* ----- Câu hỏi ----- */}
      {phase !== "countdown" && !ended && (
        <div className="og-question">
          <p className="og-question-text">
            <span className="as-qnum">{item.n + 1}</span>
            <span>
              {isRetry && <em className="zg-retry">Hỏi lại</em>}
              {current.text}
            </span>
          </p>
          <div className="og-options">
            {current.options.map((o) => {
              let state = "";
              if (showResult && o.isCorrect) state = " right";
              if (showResult && picked === o.letter && !o.isCorrect) state = " wrong";
              return (
                <button
                  key={o.letter}
                  type="button"
                  className={`og-option opt-${o.letter}${state}`}
                  onClick={() => answer(o.letter)}
                  disabled={phase !== "question"}
                >
                  <span className="og-option-letter">{o.letter}</span>
                  <span>{o.text}</span>
                </button>
              );
            })}
          </div>

          <p className={"og-hint" + (phase === "slash" ? " bad" : phase === "shoot" || phase === "dying" ? " good" : "")}>
            {phase === "question" && "Bấm vào đáp án hoặc dùng phím A – D / 1 – 4 để bắn"}
            {phase === "shoot" && `🎯 Trúng! Zombie mất 1 máu — còn ${hp}/${maxHp}.`}
            {phase === "dying" && "💀 Phát đạn cuối cùng! Zombie gục ngã!"}
            {phase === "slash" &&
              `🧟 ${reason === "timeout" ? "Hết giờ!" : "Sai rồi!"} Zombie chém bạn mất 1 mạng — đáp án đúng: ${correctOption?.letter}. ${correctOption?.text}${settings.retry && lives > 0 ? " (câu này sẽ được hỏi lại)" : ""}`}
          </p>
        </div>
      )}

      {/* ----- Kết thúc ----- */}
      {ended && (
        <div className="og-overlay">
          {(phase === "win" || stars >= 2) && <Confetti />}
          <div className={"og-result" + (phase === "win" ? " win" : "")}>
            <span className="og-result-icon">{phase === "win" ? "🎯" : phase === "empty" ? "🪫" : "🧟"}</span>
            <h3>{phase === "win" ? "Zombie đã gục ngã!" : phase === "empty" ? "Hết đạn!" : "Bạn bị zombie hạ gục!"}</h3>
            <Stars count={stars} />
            <p>
              {phase === "win"
                ? `Hạ zombie với ${lives}/${maxLives} mạng còn lại.`
                : `Zombie vẫn còn ${hp}/${maxHp} máu.`}
            </p>

            <div className="og-stats">
              <div>
                <small>Điểm</small>
                <strong>{score.toLocaleString("vi-VN")}</strong>
              </div>
              <div>
                <small>Bắn trúng</small>
                <strong>
                  {rightCount}/{attempts}
                </strong>
              </div>
              <div>
                <small>Chuỗi dài nhất</small>
                <strong>🔥 {bestStreak}</strong>
              </div>
            </div>

            <MissedList items={misses} />

            <ResultBoard lb={lb} result={{ score, passed: rightCount, total: maxHp }} />

            <div className="og-result-actions">
              <button className="btn btn-light" type="button" onClick={backToSetup}>
                Đổi đề / cài đặt
              </button>
              <button className="btn btn-primary" type="button" onClick={startGame} autoFocus={lb.entry !== "ask"}>
                ↻ Chơi lại
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
