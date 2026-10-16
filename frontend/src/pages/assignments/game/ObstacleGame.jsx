// pages/assignments/game/ObstacleGame.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LETTERS, shuffleArray } from "../../../utils/pdfQuestions";
import { Confetti, Leaderboard, QuestionFileCard, starsOf, usePlayingSignal } from "./GameShared";
import { playSound, readMuted, writeMuted } from "./gameSound";
import {
  BOARD_SIZE,
  boardKey,
  clearBoard,
  loadBoard,
  qualifies,
  readPlayerName,
  saveScore,
  writePlayerName,
} from "./leaderboard";

/* Trò chơi "Vượt chướng ngại vật": mỗi câu hỏi là 1 chướng ngại vật.
 * Trả lời đúng → nhảy qua, cộng điểm (thưởng thời gian × combo).
 * Trả lời sai / hết giờ → mất 1 mạng, vẫn chạy tiếp; hết mạng là kết thúc.
 * Chạy hoàn toàn trên trình duyệt; bảng xếp hạng lưu ở trình duyệt theo từng file đề. */

const OBSTACLES = ["🪨", "🌵", "🧱", "🔥", "🪵", "🚧", "🛢️", "📦", "🗿", "🦔", "🌋", "🧊"];
const TREES = ["🌳", "🌲", "🌴", "🌳", "🏡", "🌲"];
const STEP = 170; // khoảng cách giữa 2 chướng ngại vật (px)
const RUNNER_X = 70; // vị trí cố định của nhân vật trên đường chạy
const JUMP_MS = 900;
const CRASH_MS = 1000;
const REVEAL_MS = 1800; // hiện đáp án đúng sau khi sai, rồi chạy tiếp
const COUNTDOWN_FROM = 3;
const MIN_SECONDS = 3;
const MAX_SECONDS = 300;
const BONUS_TIME_MS = 10000;
const BASE_POINTS = 100;
const MAX_TIME_BONUS = 200;

const clampSeconds = (v) => Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, Math.round(Number(v) || 0)));
const clampLives = (v) => Math.min(5, Math.max(1, Math.round(Number(v) || 1)));

/** Hệ số combo theo chuỗi trả lời đúng liên tiếp */
function multiplierOf(streak) {
  if (streak >= 8) return 3;
  if (streak >= 5) return 2;
  if (streak >= 3) return 1.5;
  return 1;
}

/** Tạo lượt chơi mới: trộn câu / phương án, gắn thời gian cho từng câu */
function buildRun(questions, settings) {
  const list = settings.shuffleQuestions ? shuffleArray(questions) : [...questions];
  return list.map((q) => {
    const options = (settings.shuffleOptions ? shuffleArray(q.options) : q.options).map((o, i) => ({
      ...o,
      letter: LETTERS[i],
      isCorrect: o.originalLetter === q.correctAnswer,
    }));
    return { ...q, options, seconds: clampSeconds(settings.overrides[q.id] ?? settings.defaultSeconds) };
  });
}

const NO_LIFELINES = { fifty: false, time: false, skip: false };

export default function ObstacleGame({ deck, onDeckChange, onPlaying }) {
  const gameRef = useRef(null);
  const timers = useRef([]);
  const popId = useRef(0);
  const lastTick = useRef(null);

  /* ----- Cài đặt ----- */
  const { file, questions } = deck;
  const [settings, setSettings] = useState({
    defaultSeconds: 20,
    overrides: {}, // id câu -> số giây riêng
    shuffleQuestions: true,
    shuffleOptions: true,
    lives: 3,
    suddenDeath: false, // đột tử: sai 1 câu là kết thúc
    lifelines: true,
  });
  const [muted, setMuted] = useState(readMuted);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  /* ----- Lượt chơi ----- */
  const [run, setRun] = useState(null);
  const [phase, setPhase] = useState("setup"); // setup | countdown | question | jump | crash | over | win
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState(null);
  const [reason, setReason] = useState(null); // wrong | timeout
  const [countdown, setCountdown] = useState(COUNTDOWN_FROM);
  const [deadline, setDeadline] = useState(0);
  const [qTotal, setQTotal] = useState(1); // tổng thời gian câu hiện tại (ms), tăng khi dùng +10 giây
  const [now, setNow] = useState(Date.now());
  const [fullscreen, setFullscreen] = useState(false);

  const [lives, setLives] = useState(3);
  const [maxLives, setMaxLives] = useState(3);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [results, setResults] = useState([]); // [{ status: right|wrong|timeout|skip, points }] theo thứ tự câu
  const [used, setUsed] = useState(NO_LIFELINES);
  const [hidden, setHidden] = useState([]); // phương án bị ẩn bởi 50:50
  const [pops, setPops] = useState([]); // chữ bay lên: +150, COMBO x2...
  const [comboFlash, setComboFlash] = useState(0);

  /* ----- Bảng xếp hạng ----- */
  const [board, setBoard] = useState([]);
  const [entry, setEntry] = useState("none"); // none | ask | saved
  const [playerName, setPlayerName] = useState(readPlayerName);
  const [highlight, setHighlight] = useState(null);
  const lbKey = file ? boardKey(file.name, questions.length) : null;

  const sfx = useCallback((name) => {
    if (!mutedRef.current) playSound(name);
  }, []);

  const later = useCallback((fn, ms) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);

  const clearTimers = useCallback(() => {
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === gameRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    setBoard(lbKey ? loadBoard(lbKey) : []);
  }, [lbKey]);

  // Đổi đề → bỏ thời gian riêng của từng câu
  useEffect(() => {
    setSettings((prev) => ({ ...prev, overrides: {} }));
  }, [questions]);

  usePlayingSignal(phase !== "setup", onPlaying);

  function toggleMute() {
    setMuted((m) => {
      writeMuted(!m);
      return !m;
    });
  }

  const addPop = useCallback(
    (text, kind = "") => {
      const id = ++popId.current;
      setPops((p) => [...p, { id, text, kind }]);
      later(() => setPops((p) => p.filter((x) => x.id !== id)), 1300);
    },
    [later],
  );

  const set = (field, value) => setSettings((prev) => ({ ...prev, [field]: value }));

  function setOverride(id, value) {
    setSettings((prev) => {
      const overrides = { ...prev.overrides };
      if (value === "") delete overrides[id];
      else overrides[id] = value;
      return { ...prev, overrides };
    });
  }

  const totalSeconds = useMemo(
    () => questions.reduce((sum, q) => sum + clampSeconds(settings.overrides[q.id] ?? settings.defaultSeconds), 0),
    [questions, settings],
  );

  /* ----- Điều khiển lượt chơi ----- */
  const startQuestion = useCallback((i, list) => {
    const total = list[i].seconds * 1000;
    setIndex(i);
    setPicked(null);
    setHidden([]);
    setReason(null);
    setNow(Date.now());
    setQTotal(total);
    setDeadline(Date.now() + total);
    lastTick.current = null;
    setPhase("question");
  }, []);

  /** Sang câu sau, hoặc về đích nếu đã hết câu */
  const goNext = useCallback(
    (i, list) => {
      if (i + 1 >= list.length) {
        setPhase("win");
        sfx("win");
      } else startQuestion(i + 1, list);
    },
    [startQuestion, sfx],
  );

  function startGame() {
    clearTimers();
    const list = buildRun(questions, settings);
    const startLives = settings.suddenDeath ? 1 : clampLives(settings.lives);
    setRun(list);
    setIndex(0);
    setPicked(null);
    setReason(null);
    setHidden([]);
    setLives(startLives);
    setMaxLives(startLives);
    setScore(0);
    setStreak(0);
    setBestStreak(0);
    setResults([]);
    setUsed(settings.lifelines ? NO_LIFELINES : { fifty: true, time: true, skip: true });
    setPops([]);
    setEntry("none");
    setHighlight(null);
    setCountdown(COUNTDOWN_FROM);
    setPhase("countdown");
    sfx("count");
    for (let k = 1; k <= COUNTDOWN_FROM; k++) {
      later(() => {
        setCountdown(COUNTDOWN_FROM - k);
        sfx(k < COUNTDOWN_FROM ? "count" : "go");
      }, k * 800);
    }
    later(() => startQuestion(0, list), COUNTDOWN_FROM * 800 + 500);
  }

  function backToSetup() {
    clearTimers();
    if (document.fullscreenElement) document.exitFullscreen?.();
    setPhase("setup");
    setRun(null);
    if (lbKey) setBoard(loadBoard(lbKey));
  }

  const fail = useCallback(
    (why) => {
      const left = lives - 1;
      setReason(why);
      setStreak(0);
      setLives(left);
      setResults((r) => [...r, { status: why, points: 0 }]);
      setPhase("crash");
      sfx("wrong");
      if (left <= 0) {
        later(() => {
          setPhase("over");
          sfx("lose");
        }, CRASH_MS);
      } else {
        later(() => goNext(index, run), REVEAL_MS);
      }
    },
    [lives, index, run, later, goNext, sfx],
  );

  const answer = useCallback(
    (letter) => {
      if (phase !== "question" || !run || hidden.includes(letter)) return;
      const option = run[index].options.find((o) => o.letter === letter);
      if (!option) return;
      setPicked(letter);
      if (!option.isCorrect) return fail("wrong");

      const nextStreak = streak + 1;
      const mult = multiplierOf(nextStreak);
      const timeBonus = Math.min(MAX_TIME_BONUS, Math.floor(Math.max(0, deadline - Date.now()) / 1000) * 10);
      const points = Math.round((BASE_POINTS + timeBonus) * mult);
      setScore((s) => s + points);
      setStreak(nextStreak);
      setBestStreak((b) => Math.max(b, nextStreak));
      setResults((r) => [...r, { status: "right", points }]);
      addPop(`+${points}`, "points");
      if (mult > multiplierOf(streak)) {
        addPop(`COMBO x${mult}!`, "combo");
        setComboFlash((c) => c + 1);
        sfx("combo");
      } else sfx("correct");

      setPhase("jump");
      later(() => goNext(index, run), JUMP_MS);
    },
    [phase, run, index, hidden, streak, deadline, fail, later, goNext, addPop, sfx],
  );

  /* ----- Quyền trợ giúp ----- */
  const takeFifty = useCallback(() => {
    if (phase !== "question" || used.fifty) return;
    const wrong = run[index].options.filter((o) => !o.isCorrect).map((o) => o.letter);
    setHidden(shuffleArray(wrong).slice(0, 2));
    setUsed((u) => ({ ...u, fifty: true }));
    addPop("50 : 50", "power");
    sfx("power");
  }, [phase, used, run, index, addPop, sfx]);

  const takeTime = useCallback(() => {
    if (phase !== "question" || used.time) return;
    setDeadline((d) => d + BONUS_TIME_MS);
    setQTotal((t) => t + BONUS_TIME_MS);
    setUsed((u) => ({ ...u, time: true }));
    addPop("+10 giây", "power");
    sfx("power");
  }, [phase, used, addPop, sfx]);

  const takeSkip = useCallback(() => {
    if (phase !== "question" || used.skip) return;
    setUsed((u) => ({ ...u, skip: true }));
    setResults((r) => [...r, { status: "skip", points: 0 }]);
    addPop("Bỏ qua ⏭", "power");
    sfx("skip");
    setPhase("jump");
    later(() => goNext(index, run), JUMP_MS);
  }, [phase, used, index, run, later, goNext, addPop, sfx]);

  // Đồng hồ từng câu + tiếng tích tắc 5 giây cuối
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

  // Phím tắt: A–D hoặc 1–4 để trả lời; F = 50:50, T = +10 giây, S = bỏ qua
  useEffect(() => {
    if (!run) return undefined;
    const onKey = (e) => {
      if (e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      const k = e.key.toUpperCase();
      if (k === "F") return takeFifty();
      if (k === "T") return takeTime();
      if (k === "S") return takeSkip();
      const letter = LETTERS.includes(k) ? k : LETTERS[Number(k) - 1];
      if (letter) answer(letter);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [run, answer, takeFifty, takeTime, takeSkip]);

  // Kết thúc lượt: kiểm tra có lọt bảng xếp hạng không
  useEffect(() => {
    if ((phase !== "over" && phase !== "win") || !lbKey) return;
    const list = loadBoard(lbKey);
    setBoard(list);
    setEntry(qualifies(list, score) ? "ask" : "none");
  }, [phase, lbKey, score]);

  function submitScore(e) {
    e.preventDefault();
    const name = playerName.trim() || "Người chơi";
    writePlayerName(name);
    const date = Date.now();
    const right = results.filter((r) => r.status === "right").length;
    setBoard(saveScore(lbKey, { name, score, passed: right, total: run.length, date }));
    setHighlight(date);
    setEntry("saved");
  }

  function handleClearBoard() {
    if (!lbKey || !window.confirm("Xoá toàn bộ bảng xếp hạng của đề này?")) return;
    clearBoard(lbKey);
    setBoard([]);
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else gameRef.current?.requestFullscreen?.().catch(() => {});
  }

  /* =========================================================
     MÀN HÌNH CÀI ĐẶT
  ========================================================= */
  if (phase === "setup") {
    return (
      <>
        <QuestionFileCard deck={deck} onChange={onDeckChange} unit="chướng ngại vật" />

        <section className="as-card">
          <div className="as-card-head">
            <span className="as-step">2</span>
            <div>
              <h3>Cài đặt trò chơi</h3>
              <p>
                Trả lời đúng để nhảy qua và ghi điểm — càng nhanh càng nhiều điểm, đúng liên tiếp để nhân combo. Sai
                hoặc hết giờ sẽ mất 1 mạng ❤️.
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
                value={settings.defaultSeconds}
                onChange={(e) => set("defaultSeconds", e.target.value)}
                onBlur={(e) => set("defaultSeconds", clampSeconds(e.target.value))}
              />
            </label>
            <label className="field">
              <span>Số mạng</span>
              <select
                value={settings.suddenDeath ? 1 : settings.lives}
                onChange={(e) => set("lives", clampLives(e.target.value))}
                disabled={settings.suddenDeath}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {"❤️".repeat(n)} ({n} mạng)
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="as-switches">
            {[
              ["shuffleQuestions", "Trộn thứ tự câu hỏi", "Mỗi lượt chơi một thứ tự khác"],
              ["shuffleOptions", "Trộn phương án A–D", "Tránh nhớ vị trí đáp án"],
              ["lifelines", "Quyền trợ giúp", "50:50, +10 giây, Bỏ qua — mỗi loại dùng 1 lần"],
              ["suddenDeath", "Chế độ đột tử 💀", "Sai 1 câu là kết thúc ngay"],
            ].map(([key, label, sub]) => (
              <label key={key} className="as-switch">
                <input type="checkbox" checked={settings[key]} onChange={(e) => set(key, e.target.checked)} />
                <span className="as-switch-track" />
                <span>
                  <strong>{label}</strong>
                  <small>{sub}</small>
                </span>
              </label>
            ))}
            <label className="as-switch">
              <input type="checkbox" checked={!muted} onChange={toggleMute} />
              <span className="as-switch-track" />
              <span>
                <strong>Âm thanh</strong>
                <small>Tiếng hiệu ứng khi đúng, sai, sắp hết giờ</small>
              </span>
            </label>
          </div>

          {questions.length > 0 && (
            <details className="og-times">
              <summary>
                Tùy chỉnh thời gian từng câu
                {Object.keys(settings.overrides).length > 0 && ` (${Object.keys(settings.overrides).length} câu đã chỉnh)`}
              </summary>
              <ol className="og-time-list">
                {questions.map((q, i) => (
                  <li key={q.id}>
                    <span className="og-time-num">{i + 1}</span>
                    <span className="og-time-text" title={q.text}>
                      {q.text}
                    </span>
                    <input
                      type="number"
                      min={MIN_SECONDS}
                      max={MAX_SECONDS}
                      placeholder={String(settings.defaultSeconds)}
                      value={settings.overrides[q.id] ?? ""}
                      onChange={(e) => setOverride(q.id, e.target.value)}
                      onBlur={(e) => e.target.value !== "" && setOverride(q.id, clampSeconds(e.target.value))}
                    />
                    <small>giây</small>
                  </li>
                ))}
              </ol>
            </details>
          )}
        </section>

        {file && (
          <section className="as-card">
            <div className="as-card-head">
              <span className="as-step">🏆</span>
              <div>
                <h3>Bảng xếp hạng</h3>
                <p>Top {BOARD_SIZE} của đề này, lưu trên trình duyệt của máy đang chơi.</p>
              </div>
              {board.length > 0 && (
                <>
                  <div className="spacer" />
                  <button className="btn btn-sm btn-light" type="button" onClick={handleClearBoard}>
                    Xoá bảng
                  </button>
                </>
              )}
            </div>
            <Leaderboard list={board} />
          </section>
        )}

        <div className="as-submit-bar">
          <span>
            {questions.length ? `${questions.length} câu` : "Chưa có đề"}
            {questions.length > 0 && ` · tối đa ${Math.ceil(totalSeconds / 60)} phút`} · không lưu điểm lên hệ thống
          </span>
          <button className="btn btn-primary" type="button" onClick={startGame} disabled={!questions.length}>
            🏃 Bắt đầu chơi
          </button>
        </div>
      </>
    );
  }

  /* =========================================================
     MÀN HÌNH CHƠI
  ========================================================= */
  const current = run[index];
  const offset = phase === "jump" || phase === "win" ? index + 1 : index; // số chướng ngại vật đã đi qua
  const remainingMs = Math.max(0, deadline - now);
  const timePercent = phase === "question" ? (remainingMs / qTotal) * 100 : phase === "countdown" ? 100 : 0;
  const showResult = phase === "jump" || phase === "crash" || phase === "over";
  const mult = multiplierOf(streak);
  const ended = phase === "over" || phase === "win";
  const rightCount = results.filter((r) => r.status === "right").length;
  const stars = starsOf(rightCount, run.length);
  const missed = results
    .map((r, i) => ({ ...r, q: run[i], i }))
    .filter((r) => r.status === "wrong" || r.status === "timeout");
  const worldWidth = RUNNER_X + (run.length + 3) * STEP;
  const runSpeed = Math.max(0.22, 0.5 - Math.min(streak, 8) * 0.035);
  const correctOption = current.options.find((o) => o.isCorrect);

  return (
    <div ref={gameRef} className={"og-game" + (fullscreen ? " is-fullscreen" : "")}>
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
        <div className={"og-hud-item og-combo" + (mult > 1 ? " hot" : "")} key={`c${comboFlash}`}>
          <small>Chuỗi đúng</small>
          <strong>
            🔥 {streak}
            {mult > 1 && <em>x{mult}</em>}
          </strong>
        </div>
        <div className="og-hud-item">
          <small>Câu</small>
          <strong>
            {Math.min(index + 1, run.length)}/{run.length}
          </strong>
        </div>
        <div className="spacer" />
        <button className="btn btn-sm btn-light" type="button" onClick={toggleMute} title="Bật / tắt âm thanh">
          {muted ? "🔇" : "🔊"}
        </button>
        <button className="btn btn-sm btn-light" type="button" onClick={toggleFullscreen}>
          {fullscreen ? "Thu nhỏ" : "⛶ Toàn màn hình"}
        </button>
        <button className="btn btn-sm btn-light" type="button" onClick={backToSetup}>
          Thoát
        </button>
      </div>

      {/* ----- Đường chạy ----- */}
      <div
        className={"og-stage" + (phase === "crash" ? " shake" : "") + (streak >= 5 ? " on-fire" : "")}
        style={{ "--og-jump": `${JUMP_MS}ms`, "--og-run": `${runSpeed}s` }}
      >
        <span className="og-sun">☀️</span>
        <span className="og-cloud c1">☁️</span>
        <span className="og-cloud c2">☁️</span>
        <div
          className="og-layer og-hills"
          style={{ width: worldWidth * 0.3 + 2000, transform: `translateX(${-offset * STEP * 0.3}px)` }}
        />
        <div
          className="og-layer og-trees"
          style={{ width: worldWidth * 0.6 + 2000, transform: `translateX(${-offset * STEP * 0.6}px)` }}
        >
          {Array.from({ length: Math.ceil((worldWidth * 0.6 + 2000) / 130) }, (_, i) => (
            <span key={i} style={{ left: i * 130 + ((i * 37) % 50), fontSize: 26 + ((i * 13) % 3) * 6 }}>
              {TREES[i % TREES.length]}
            </span>
          ))}
        </div>
        <div className="og-world" style={{ width: worldWidth, transform: `translateX(${-offset * STEP}px)` }}>
          {run.map((q, i) => {
            const st = results[i]?.status;
            let cls = "";
            if (st === "right" || st === "skip") cls = " passed";
            if (st === "wrong" || st === "timeout") cls = i === index && phase === "crash" ? " hit" : " broken";
            if (i === index && phase === "over") cls = " hit";
            return (
              <span
                key={q.id}
                className={"og-obstacle" + cls}
                style={{ left: RUNNER_X + STEP / 2 + i * STEP, fontSize: 36 + ((i * 7) % 4) * 5 }}
              >
                {OBSTACLES[(i * 5) % OBSTACLES.length]}
              </span>
            );
          })}
          <span className="og-finish" style={{ left: RUNNER_X + STEP / 2 + run.length * STEP - 20 }}>
            🏁
          </span>
          <div className="og-ground" />
        </div>
        <span className={"og-runner " + phase} style={{ left: RUNNER_X }}>
          {streak >= 5 && (phase === "question" || phase === "jump") && <span className="og-trail">💨</span>}
          <span>🏃</span>
        </span>

        {pops.map((p) => (
          <span key={p.id} className={"og-pop " + p.kind}>
            {p.text}
          </span>
        ))}

        {phase === "countdown" && (
          <div className="og-countdown" key={countdown}>
            {countdown > 0 ? countdown : "Chạy!"}
          </div>
        )}
      </div>

      {/* ----- Tiến độ về đích ----- */}
      <div className="og-progress" title={`${offset}/${run.length} chướng ngại vật`}>
        <div className="og-progress-track">
          <span className="og-progress-fill" style={{ width: `${(offset / run.length) * 100}%` }} />
          {run.map((q, i) => (
            <span
              key={q.id}
              className={"og-progress-dot " + (results[i]?.status || (i === index ? "current" : ""))}
              style={{ left: `${((i + 0.5) / run.length) * 100}%` }}
            />
          ))}
          <span className="og-progress-runner" style={{ left: `${(offset / run.length) * 100}%` }}>
            🏃
          </span>
        </div>
        <span className="og-progress-flag">🏁</span>
      </div>

      {/* ----- Thời gian ----- */}
      <div className="og-timer">
        <div className={"og-timer-bar" + (timePercent < 30 ? " urgent" : "")}>
          <span style={{ width: `${Math.min(100, timePercent)}%` }} />
        </div>
        <strong className={timePercent < 30 && phase === "question" ? "urgent" : ""}>
          {phase === "question" ? Math.ceil(remainingMs / 1000) : current.seconds}s
        </strong>
      </div>

      {/* ----- Câu hỏi ----- */}
      {phase !== "countdown" && phase !== "win" && (
        <div className="og-question">
          <p className="og-question-text">
            <span className="as-qnum">{index + 1}</span>
            <span>{current.text}</span>
          </p>
          <div className="og-options">
            {current.options.map((o) => {
              let state = "";
              if (showResult && o.isCorrect) state = " right";
              if (showResult && picked === o.letter && !o.isCorrect) state = " wrong";
              if (hidden.includes(o.letter)) state = " gone";
              return (
                <button
                  key={o.letter}
                  type="button"
                  className={`og-option opt-${o.letter}${state}`}
                  onClick={() => answer(o.letter)}
                  disabled={phase !== "question" || hidden.includes(o.letter)}
                >
                  <span className="og-option-letter">{o.letter}</span>
                  <span>{o.text}</span>
                </button>
              );
            })}
          </div>

          {settings.lifelines && (
            <div className="og-lifelines">
              {[
                ["fifty", "50:50", "F", takeFifty],
                ["time", "⏱ +10 giây", "T", takeTime],
                ["skip", "⏭ Bỏ qua", "S", takeSkip],
              ].map(([key, label, hotkey, fn]) => (
                <button
                  key={key}
                  type="button"
                  className={"og-lifeline" + (used[key] ? " used" : "")}
                  onClick={fn}
                  disabled={used[key] || phase !== "question"}
                  title={used[key] ? "Đã dùng" : `Phím tắt: ${hotkey}`}
                >
                  {label}
                  <kbd>{hotkey}</kbd>
                </button>
              ))}
            </div>
          )}

          <p className={"og-hint" + (phase === "crash" ? " bad" : phase === "jump" ? " good" : "")}>
            {phase === "jump" && results[index]?.status === "skip" && "⏭ Đã bỏ qua câu này."}
            {phase === "jump" && results[index]?.status !== "skip" && "✅ Chính xác! Nhảy qua..."}
            {phase === "crash" &&
              `${reason === "timeout" ? "⏰ Hết giờ!" : "❌ Sai rồi!"} Mất 1 mạng — đáp án đúng: ${correctOption?.letter}. ${correctOption?.text}`}
            {phase === "question" && "Bấm vào đáp án hoặc dùng phím A – D / 1 – 4"}
          </p>
        </div>
      )}

      {/* ----- Kết thúc ----- */}
      {ended && (
        <div className="og-overlay">
          {(phase === "win" || stars >= 2) && <Confetti />}
          <div className={"og-result " + phase}>
            <span className="og-result-icon">{phase === "win" ? "🏆" : reason === "timeout" ? "⏰" : "💥"}</span>
            <h3>{phase === "win" ? "Về đích!" : "Hết mạng!"}</h3>
            <div className="og-stars" aria-label={`${stars}/3 sao`}>
              {[1, 2, 3].map((n) => (
                <span key={n} className={n <= stars ? "lit" : ""} style={{ animationDelay: `${n * 0.18}s` }}>
                  ★
                </span>
              ))}
            </div>
            <p>
              {phase === "win"
                ? `Đã chạy hết ${run.length} chướng ngại vật!`
                : `Dừng lại ở chướng ngại vật ${index + 1}/${run.length}.`}
            </p>

            <div className="og-stats">
              <div>
                <small>Điểm</small>
                <strong>{score.toLocaleString("vi-VN")}</strong>
              </div>
              <div>
                <small>Trả lời đúng</small>
                <strong>
                  {rightCount}/{run.length}
                </strong>
              </div>
              <div>
                <small>Chuỗi dài nhất</small>
                <strong>🔥 {bestStreak}</strong>
              </div>
            </div>

            {missed.length > 0 && (
              <details className="og-missed">
                <summary>Xem lại {missed.length} câu trả lời sai / hết giờ</summary>
                <ol>
                  {missed.map((m) => {
                    const right = m.q.options.find((o) => o.isCorrect);
                    return (
                      <li key={m.q.id}>
                        <span className="og-missed-q">
                          <b>Câu {m.i + 1}.</b> {m.q.text}
                        </span>
                        <span className="og-missed-a">
                          ✓ {right?.letter}. {right?.text}
                          {m.status === "timeout" && <em> · hết giờ</em>}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </details>
            )}

            {entry === "ask" && (
              <form className="og-name-form" onSubmit={submitScore}>
                <label>
                  🎉 Bạn lọt vào top {BOARD_SIZE}! Nhập tên để lưu điểm:
                  <input
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value.slice(0, 30))}
                    placeholder="Tên người chơi / tên đội"
                    autoFocus
                  />
                </label>
                <button className="btn btn-primary btn-sm" type="submit">
                  Lưu điểm
                </button>
              </form>
            )}

            {(entry === "saved" || board.length > 0) && (
              <div className="og-result-board">
                <small>Bảng xếp hạng</small>
                <Leaderboard list={board} highlight={highlight} />
              </div>
            )}

            <div className="og-result-actions">
              <button className="btn btn-light" type="button" onClick={backToSetup}>
                Đổi đề / cài đặt
              </button>
              <button className="btn btn-primary" type="button" onClick={startGame} autoFocus={entry !== "ask"}>
                ↻ Chơi lại
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
