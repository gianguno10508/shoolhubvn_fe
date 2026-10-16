// pages/assignments/game/MillionaireGame.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LETTERS, shuffleArray } from "../../../utils/pdfQuestions";
import { boardKey } from "./leaderboard";
import {
  Confetti,
  LeaderboardCard,
  QuestionFileCard,
  ResultBoard,
  Switch,
  useFullscreen,
  useGameKit,
  useLeaderboard,
  usePlayingSignal,
} from "./GameShared";

/* Trò chơi "Ai là triệu phú": trả lời lần lượt từng câu để leo thang tiền thưởng.
 * Chọn đáp án → chốt → hồi hộp chờ kết quả. Sai / hết giờ: dừng cuộc chơi, nhận tiền ở mốc an toàn gần nhất.
 * Có thể dừng cuộc chơi bất cứ lúc nào để nhận số tiền đã có. 3 quyền trợ giúp, mỗi quyền dùng 1 lần. */

// Thang tiền thưởng chuẩn 15 câu; đề ít câu hơn thì lấy giá trị trải đều trên thang này
const STANDARD_LADDER = [
  200e3, 400e3, 600e3, 1e6, 2e6, 3e6, 6e6, 10e6, 14e6, 22e6, 30e6, 40e6, 80e6, 150e6, 250e6,
];
const MAX_COUNT = STANDARD_LADDER.length;
const SECONDS_CHOICES = [0, 15, 30, 45, 60, 90];
const INTRO_MS = 1500;
const SUSPENSE_MS = 2200;
const RIGHT_MS = 1900;
const WRONG_MS = 2800;
const NO_LIFELINES = { fifty: false, audience: false, phone: false };

const money = (v) => `${v.toLocaleString("vi-VN")} đ`;

/** Tiền thưởng cho từng câu + vị trí các mốc an toàn (sau câu 5 và 10 nếu đủ 15 câu) */
function ladderOf(count) {
  const prizes = Array.from({ length: count }, (_, i) => STANDARD_LADDER[Math.round(((i + 1) / count) * MAX_COUNT) - 1]);
  const milestones = count >= 3 ? [...new Set([Math.round(count / 3) - 1, Math.round((2 * count) / 3) - 1])] : [];
  return { prizes, milestones: milestones.filter((m) => m >= 0 && m < count - 1) };
}

/** Số tiền nhận được khi kết thúc ở câu `index` (chỉ số 0) */
function winningsOf(kind, index, ladder) {
  if (kind === "win") return ladder.prizes[ladder.prizes.length - 1];
  if (kind === "quit") return index > 0 ? ladder.prizes[index - 1] : 0;
  const safe = ladder.milestones.filter((m) => m < index);
  return safe.length ? ladder.prizes[safe[safe.length - 1]] : 0;
}

function buildRun(questions, settings) {
  const list = (settings.shuffleQuestions ? shuffleArray(questions) : [...questions]).slice(0, settings.count);
  return list.map((q) => ({
    ...q,
    options: (settings.shuffleOptions ? shuffleArray(q.options) : q.options).map((o, i) => ({
      ...o,
      letter: LETTERS[i],
      isCorrect: o.originalLetter === q.correctAnswer,
    })),
  }));
}

/** Khán giả bình chọn: 85% khả năng đáp án đúng được nhiều phiếu nhất */
function audienceVotes(options, hidden) {
  const visible = options.filter((o) => !hidden.includes(o.letter));
  const wrong = visible.filter((o) => !o.isCorrect);
  const top = Math.random() < 0.85 || !wrong.length ? visible.find((o) => o.isCorrect) : shuffleArray(wrong)[0];
  const topShare = Math.round((visible.length <= 2 ? 58 : 40) + Math.random() * 30);
  const others = visible.filter((o) => o !== top);
  const weights = others.map(() => 0.2 + Math.random());
  const sum = weights.reduce((a, b) => a + b, 0);
  const votes = { [top.letter]: topShare };
  let left = 100 - topShare;
  others.forEach((o, i) => {
    const v = i === others.length - 1 ? left : Math.min(left, Math.round(((100 - topShare) * weights[i]) / sum));
    votes[o.letter] = v;
    left -= v;
  });
  return votes;
}

/** Gọi điện cho người thân: 80% khả năng gợi ý đúng */
function phoneAdvice(options, hidden) {
  const visible = options.filter((o) => !hidden.includes(o.letter));
  const wrong = visible.filter((o) => !o.isCorrect);
  const right = Math.random() < 0.8 || !wrong.length;
  const pick = right ? visible.find((o) => o.isCorrect) : shuffleArray(wrong)[0];
  const confidence = right ? 65 + Math.floor(Math.random() * 30) : 40 + Math.floor(Math.random() * 25);
  return { letter: pick.letter, confidence };
}

export default function MillionaireGame({ deck, onDeckChange, onPlaying }) {
  const gameRef = useRef(null);
  const { later, clearTimers, sfx, muted, toggleMute } = useGameKit();
  const fs = useFullscreen(gameRef);
  const { file, questions } = deck;

  const [settings, setSettings] = useState({
    count: MAX_COUNT,
    seconds: 30,
    shuffleQuestions: true,
    shuffleOptions: true,
    lifelines: true,
  });
  const set = (field, value) => setSettings((prev) => ({ ...prev, [field]: value }));
  const count = Math.min(settings.count, questions.length) || 0;

  const [run, setRun] = useState(null);
  const [phase, setPhase] = useState("setup"); // setup | intro | question | locked | right | wrong | ended
  const [endKind, setEndKind] = useState(null); // win | lose | quit
  const [reason, setReason] = useState(null); // wrong | timeout
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [hidden, setHidden] = useState([]);
  const [used, setUsed] = useState(NO_LIFELINES);
  const [help, setHelp] = useState(null); // { type: "audience", votes } | { type: "phone", letter, confidence }
  const [deadline, setDeadline] = useState(0);
  const [now, setNow] = useState(Date.now());
  const lastTick = useRef(null);

  const ladder = useMemo(() => ladderOf(run ? run.length : count), [run, count]);
  const lb = useLeaderboard(file ? boardKey(file.name, questions.length, "millionaire") : null);

  usePlayingSignal(phase !== "setup", onPlaying);

  const countChoices = useMemo(() => {
    const list = [5, 10, 15].filter((n) => n < questions.length);
    if (questions.length) list.push(Math.min(MAX_COUNT, questions.length));
    return [...new Set(list)];
  }, [questions.length]);

  /* ----- Điều khiển lượt chơi ----- */
  const showIntro = useCallback(
    (i) => {
      setIndex(i);
      setSelected(null);
      setHidden([]);
      setHelp(null);
      setReason(null);
      setPhase("intro");
      sfx("intro");
      later(() => {
        const t = Date.now();
        setNow(t);
        setDeadline(t + settings.seconds * 1000);
        lastTick.current = null;
        setPhase("question");
      }, INTRO_MS);
    },
    [later, sfx, settings.seconds],
  );

  const finish = useCallback(
    (kind, i, list) => {
      setEndKind(kind);
      setIndex(i);
      setPhase("ended");
      sfx(kind === "lose" ? "lose" : "win");
      lb.finish(winningsOf(kind, i, ladderOf(list.length)));
    },
    [sfx, lb],
  );

  function startGame() {
    clearTimers();
    const list = buildRun(questions, { ...settings, count });
    setRun(list);
    setEndKind(null);
    setUsed(settings.lifelines ? NO_LIFELINES : { fifty: true, audience: true, phone: true });
    lb.reset();
    showIntro(0);
  }

  function backToSetup() {
    clearTimers();
    fs.exit();
    setPhase("setup");
    setRun(null);
    lb.reset();
  }

  const reveal = useCallback(
    (letter, why) => {
      const option = run[index].options.find((o) => o.letter === letter);
      if (option?.isCorrect) {
        setPhase("right");
        sfx("combo");
        later(() => (index + 1 >= run.length ? finish("win", index + 1, run) : showIntro(index + 1)), RIGHT_MS);
      } else {
        setReason(why);
        setPhase("wrong");
        sfx("wrong");
        later(() => finish("lose", index, run), WRONG_MS);
      }
    },
    [run, index, later, sfx, finish, showIntro],
  );

  const lock = useCallback(() => {
    if (phase !== "question" || !selected) return;
    setPhase("locked");
    sfx("suspense");
    later(() => reveal(selected, "wrong"), SUSPENSE_MS);
  }, [phase, selected, sfx, later, reveal]);

  const choose = useCallback(
    (letter) => {
      if (phase !== "question" || hidden.includes(letter)) return;
      if (selected === letter) lock();
      else setSelected(letter);
    },
    [phase, hidden, selected, lock],
  );

  function quit() {
    if (phase !== "question") return;
    const prize = winningsOf("quit", index, ladder);
    if (!window.confirm(`Dừng cuộc chơi và ra về với ${money(prize)}?`)) return;
    clearTimers();
    finish("quit", index, run);
  }

  /* ----- Quyền trợ giúp ----- */
  const takeFifty = useCallback(() => {
    if (phase !== "question" || used.fifty) return;
    const wrong = run[index].options.filter((o) => !o.isCorrect).map((o) => o.letter);
    const gone = shuffleArray(wrong).slice(0, 2);
    setHidden(gone);
    setSelected((s) => (gone.includes(s) ? null : s));
    setHelp((h) => (h?.type === "audience" ? null : h));
    setUsed((u) => ({ ...u, fifty: true }));
    sfx("power");
  }, [phase, used, run, index, sfx]);

  const takeAudience = useCallback(() => {
    if (phase !== "question" || used.audience) return;
    setHelp({ type: "audience", votes: audienceVotes(run[index].options, hidden) });
    setUsed((u) => ({ ...u, audience: true }));
    sfx("power");
  }, [phase, used, run, index, hidden, sfx]);

  const takePhone = useCallback(() => {
    if (phase !== "question" || used.phone) return;
    setHelp({ type: "phone", ...phoneAdvice(run[index].options, hidden) });
    setUsed((u) => ({ ...u, phone: true }));
    sfx("power");
  }, [phase, used, run, index, hidden, sfx]);

  // Đồng hồ + tích tắc 5 giây cuối
  const timed = settings.seconds > 0;
  useEffect(() => {
    if (phase !== "question" || !timed) return undefined;
    const t = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(t);
  }, [phase, timed]);

  useEffect(() => {
    if (phase !== "question" || !timed) return;
    if (now >= deadline) {
      reveal(null, "timeout");
      return;
    }
    const sec = Math.ceil((deadline - now) / 1000);
    if (sec <= 5 && lastTick.current !== sec) {
      lastTick.current = sec;
      sfx("tick");
    }
  }, [phase, timed, now, deadline, reveal, sfx]);

  // Phím tắt: A–D / 1–4 chọn, Enter chốt; F = 50:50, K = khán giả, G = gọi điện
  useEffect(() => {
    if (!run) return undefined;
    const onKey = (e) => {
      const tag = e.target instanceof HTMLElement ? e.target.tagName : "";
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) return;
      const k = e.key.toUpperCase();
      if (k === "ENTER") return tag === "BUTTON" ? undefined : lock(); // Enter trên nút → để nút tự xử lý
      if (k === "F") return takeFifty();
      if (k === "K") return takeAudience();
      if (k === "G") return takePhone();
      const letter = LETTERS.includes(k) ? k : LETTERS[Number(k) - 1];
      if (letter) choose(letter);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [run, lock, choose, takeFifty, takeAudience, takePhone]);

  /* =========================================================
     MÀN HÌNH CÀI ĐẶT
  ========================================================= */
  if (phase === "setup") {
    const preview = ladderOf(count);
    return (
      <>
        <QuestionFileCard deck={deck} onChange={onDeckChange} />

        <section className="as-card">
          <div className="as-card-head">
            <span className="as-step">2</span>
            <div>
              <h3>Cài đặt trò chơi</h3>
              <p>
                Chọn đáp án rồi <b>chốt</b> — đúng thì leo lên bậc tiền thưởng tiếp theo. Sai hoặc hết giờ là dừng cuộc
                chơi và nhận tiền ở <b>mốc an toàn</b> gần nhất. Có thể dừng cuộc chơi để giữ số tiền đã có.
              </p>
            </div>
          </div>

          <div className="as-form-grid">
            <label className="field">
              <span>Số câu hỏi</span>
              <select
                value={count}
                onChange={(e) => set("count", Number(e.target.value))}
                disabled={!questions.length}
              >
                {!questions.length && <option value={0}>Chưa có đề</option>}
                {countChoices.map((n) => (
                  <option key={n} value={n}>
                    {n} câu{n === questions.length ? " (cả đề)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Thời gian mỗi câu</span>
              <select value={settings.seconds} onChange={(e) => set("seconds", Number(e.target.value))}>
                {SECONDS_CHOICES.map((s) => (
                  <option key={s} value={s}>
                    {s ? `${s} giây` : "Không giới hạn"}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="as-switches">
            <Switch
              checked={settings.shuffleQuestions}
              onChange={(v) => set("shuffleQuestions", v)}
              label="Trộn thứ tự câu hỏi"
              sub="Mỗi lượt chơi một bộ câu khác"
            />
            <Switch
              checked={settings.shuffleOptions}
              onChange={(v) => set("shuffleOptions", v)}
              label="Trộn phương án A–D"
              sub="Tránh nhớ vị trí đáp án"
            />
            <Switch
              checked={settings.lifelines}
              onChange={(v) => set("lifelines", v)}
              label="Quyền trợ giúp"
              sub="50:50, Hỏi ý kiến khán giả, Gọi điện thoại cho người thân"
            />
            <Switch
              checked={!muted}
              onChange={toggleMute}
              label="Âm thanh"
              sub="Nhạc hồi hộp khi chốt đáp án, tiếng đúng / sai"
            />
          </div>

          {count > 0 && (
            <p className="mg-setup-ladder">
              🏆 Giải cao nhất <b>{money(preview.prizes[count - 1])}</b>
              {preview.milestones.length > 0 && (
                <>
                  {" · "}Mốc an toàn: {preview.milestones.map((m) => `câu ${m + 1} (${money(preview.prizes[m])})`).join(", ")}
                </>
              )}
            </p>
          )}
        </section>

        {file && <LeaderboardCard lb={lb} format={money} />}

        <div className="as-submit-bar">
          <span>{count ? `${count} câu · không lưu điểm lên hệ thống` : "Chưa có đề"}</span>
          <button className="btn btn-primary" type="button" onClick={startGame} disabled={!count}>
            💰 Bắt đầu chơi
          </button>
        </div>
      </>
    );
  }

  /* =========================================================
     MÀN HÌNH CHƠI
  ========================================================= */
  const current = run[index] || run[run.length - 1];
  const banked = index > 0 ? ladder.prizes[index - 1] : 0;
  const revealed = phase === "right" || phase === "wrong" || phase === "ended";
  const remainingMs = Math.max(0, deadline - now);
  const remainingSec = phase === "question" ? Math.ceil(remainingMs / 1000) : settings.seconds;
  const timePercent = phase === "question" ? (remainingMs / (settings.seconds * 1000)) * 100 : 100;
  const correct = current.options.find((o) => o.isCorrect);
  const won = endKind ? winningsOf(endKind, index, ladder) : 0;
  const passed = endKind === "win" ? run.length : index;
  const safeIndex = ladder.milestones.filter((m) => m < index).pop();

  return (
    <div ref={gameRef} className={"mg-game" + (fs.fullscreen ? " is-fullscreen" : "")}>
      <div className="og-hud mg-hud">
        <div className="og-hud-item">
          <small>Câu</small>
          <strong>
            {Math.min(index + 1, run.length)}/{run.length}
          </strong>
        </div>
        <div className="og-hud-item">
          <small>Đang có</small>
          <strong className="mg-money">{money(banked)}</strong>
        </div>
        <div className="og-hud-item mg-hud-safe">
          <small>Mốc an toàn</small>
          <strong>{safeIndex === undefined ? "—" : money(ladder.prizes[safeIndex])}</strong>
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

      <div className="mg-main">
        <div className={"mg-stage" + (phase === "locked" ? " is-locked" : "")}>
          <span className="mg-light l1" aria-hidden="true" />
          <span className="mg-light l2" aria-hidden="true" />

          <div className="mg-top">
            {settings.lifelines && (
              <div className="mg-lifelines">
                {[
                  ["fifty", "50:50", "F", "50:50 — bỏ 2 phương án sai", takeFifty],
                  ["audience", "👥", "K", "Hỏi ý kiến khán giả", takeAudience],
                  ["phone", "📞", "G", "Gọi điện thoại cho người thân", takePhone],
                ].map(([key, label, hotkey, title, fn]) => (
                  <button
                    key={key}
                    type="button"
                    className={"mg-lifeline" + (used[key] ? " used" : "")}
                    onClick={fn}
                    disabled={used[key] || phase !== "question"}
                    title={used[key] ? `${title} (đã dùng)` : `${title} — phím ${hotkey}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            {timed && (
              <div
                className={"mg-clock" + (phase === "question" && remainingSec <= 5 ? " urgent" : "")}
                style={{ "--p": `${Math.min(100, timePercent)}%` }}
              >
                <span>{remainingSec}</span>
              </div>
            )}
          </div>

          {help?.type === "audience" && (
            <div className="mg-help mg-audience" aria-label="Kết quả bình chọn của khán giả">
              <small>👥 Khán giả bình chọn</small>
              <div className="mg-bars">
                {current.options.map((o) => (
                  <div key={o.letter} className="mg-bar">
                    <em>{help.votes[o.letter] ?? 0}%</em>
                    <span style={{ height: `${help.votes[o.letter] ?? 0}%` }} />
                    <b>{o.letter}</b>
                  </div>
                ))}
              </div>
            </div>
          )}
          {help?.type === "phone" && (
            <div className="mg-help mg-phone">
              <span className="mg-phone-icon">📞</span>
              <p>
                “Mình nghĩ là đáp án <b>{help.letter}</b> đấy, chắc khoảng <b>{help.confidence}%</b>.”
              </p>
            </div>
          )}

          {phase === "intro" ? (
            <div className="mg-intro" key={index}>
              <small>Câu hỏi số {index + 1}</small>
              <strong>{money(ladder.prizes[index])}</strong>
              {ladder.milestones.includes(index) && <em>⭐ Mốc an toàn</em>}
            </div>
          ) : (
            <>
              <div className="mg-hex mg-question">
                <div className="mg-hex-in">
                  <p>
                    <b>Câu {index + 1}:</b> {current.text}
                  </p>
                </div>
              </div>

              <div className="mg-options">
                {current.options.map((o) => {
                  let state = "";
                  if (selected === o.letter) state = phase === "locked" ? " locked" : " selected";
                  if (revealed && o.isCorrect) state = phase === "right" ? " right blink" : " right";
                  if (revealed && selected === o.letter && !o.isCorrect) state = " wrong";
                  if (hidden.includes(o.letter)) state = " gone";
                  return (
                    <button
                      key={o.letter}
                      type="button"
                      className={"mg-hex mg-option" + state}
                      onClick={() => choose(o.letter)}
                      disabled={phase !== "question" || hidden.includes(o.letter)}
                    >
                      <span className="mg-hex-in">
                        <b>{o.letter}:</b>
                        <span>{hidden.includes(o.letter) ? "" : o.text}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          <div className="mg-actions">
            {phase === "question" && (
              <>
                <button className="btn mg-quit" type="button" onClick={quit}>
                  🚪 Dừng cuộc chơi
                </button>
                <button className="btn mg-lock" type="button" onClick={lock} disabled={!selected}>
                  🔒 Chốt đáp án {selected ? selected : ""}
                </button>
              </>
            )}
            <p className={"mg-hint" + (phase === "right" ? " good" : phase === "wrong" ? " bad" : "")}>
              {phase === "question" &&
                (selected
                  ? "Bấm lại đáp án hoặc Enter để chốt"
                  : "Chọn đáp án (A – D / 1 – 4), rồi chốt để trả lời")}
              {phase === "locked" && "Đáp án đã được chốt... 🥁"}
              {phase === "right" &&
                (index + 1 >= run.length
                  ? "🎉 Chính xác! Bạn đã trả lời đúng tất cả câu hỏi!"
                  : `✅ Chính xác! Bạn đang có ${money(ladder.prizes[index])}`)}
              {phase === "wrong" &&
                `${reason === "timeout" ? "⏰ Hết giờ!" : "❌ Rất tiếc!"} Đáp án đúng là ${correct.letter}. ${correct.text}`}
            </p>
          </div>
        </div>

        <ol className="mg-ladder" aria-label="Thang tiền thưởng">
          {ladder.prizes
            .map((p, i) => ({ p, i }))
            .reverse()
            .map(({ p, i }) => (
              <li
                key={i}
                className={
                  (ladder.milestones.includes(i) || i === run.length - 1 ? "safe " : "") +
                  (i === index && phase !== "ended" ? "current " : "") +
                  (i < index ? "done" : "")
                }
              >
                <span>{i + 1}</span>
                {i < index && <i>✓</i>}
                <strong>{money(p)}</strong>
              </li>
            ))}
        </ol>
      </div>

      {phase === "ended" && (
        <div className="og-overlay">
          {endKind === "win" && <Confetti />}
          <div className={"og-result" + (won > 0 ? " win" : "")}>
            <span className="og-result-icon">{endKind === "win" ? "🏆" : endKind === "quit" ? "🚪" : "💸"}</span>
            <h3>
              {endKind === "win" ? "Triệu phú!" : endKind === "quit" ? "Dừng cuộc chơi" : "Rất tiếc!"}
            </h3>
            <p>
              {endKind === "win"
                ? `Trả lời đúng cả ${run.length} câu hỏi!`
                : `Trả lời đúng ${passed}/${run.length} câu.`}
            </p>
            <div className="mg-won">
              <small>Tiền thưởng ra về</small>
              <strong>{money(won)}</strong>
            </div>
            {endKind !== "win" && (
              <div className="og-result-answer">
                <small>Câu {index + 1} — đáp án đúng</small>
                <span>
                  {correct.letter}. {correct.text}
                </span>
              </div>
            )}

            <ResultBoard lb={lb} result={{ score: won, passed, total: run.length }} format={money} />

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
