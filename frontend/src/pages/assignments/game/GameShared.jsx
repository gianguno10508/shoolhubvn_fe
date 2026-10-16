// pages/assignments/game/GameShared.jsx — phần dùng chung cho các trò chơi: tải đề PDF, bảng xếp hạng, pháo giấy...
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { readQuestionsFromPdf, validateQuestions } from "../../../utils/pdfQuestions";
import { playSound, readMuted, writeMuted } from "./gameSound";
import { BOARD_SIZE, clearBoard, loadBoard, qualifies, readPlayerName, saveScore, writePlayerName } from "./leaderboard";

/** Bộ đề đang dùng — giữ ở GameHub để đổi trò chơi không phải tải lại file */
export const EMPTY_DECK = { file: null, questions: [], skipped: 0 };

/** Thẻ "Tải đề PDF" (bước 1 của mọi trò chơi) */
export function QuestionFileCard({ deck, onChange, unit = "câu hỏi" }) {
  const inputRef = useRef(null);
  const [reading, setReading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState("");

  async function processFile(selected) {
    if (!selected) return;
    setError("");
    setReading(true);
    try {
      const checked = validateQuestions(await readQuestionsFromPdf(selected));
      const valid = checked.filter((q) => !q.errors.length);
      if (!valid.length) throw new Error("Không có câu hỏi nào đủ 4 phương án và đáp án đúng (đánh dấu “_A.”).");
      onChange({ file: selected, questions: valid, skipped: checked.length - valid.length });
    } catch (err) {
      onChange(EMPTY_DECK);
      setError(err.message || "Không thể đọc file PDF.");
    } finally {
      setReading(false);
    }
  }

  function removeFile() {
    onChange(EMPTY_DECK);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <>
      {error && (
        <div className="auth-error as-alert">
          <span>!</span>
          <p>{error}</p>
        </div>
      )}

      <section className="as-card">
        <div className="as-card-head">
          <span className="as-step">1</span>
          <div>
            <h3>Tải đề PDF</h3>
            <p>
              Cùng định dạng với bài tập cổ điển: <b>“Câu 1.”</b>, phương án <b>A. B. C. D.</b>, đáp án đúng có dấu gạch
              dưới phía trước, ví dụ <b>“_B.”</b>. Câu thiếu phương án hoặc chưa có đáp án sẽ bị bỏ qua.
            </p>
          </div>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          hidden
          onChange={(e) => processFile(e.target.files?.[0])}
        />

        {!deck.file ? (
          <div
            className={"as-dropzone" + (dragActive ? " drag-active" : "")}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              processFile(e.dataTransfer.files?.[0]);
            }}
          >
            <span className="as-dropzone-icon">{reading ? <span className="spin">↻</span> : "↑"}</span>
            <strong>{reading ? "Đang đọc đề..." : "Kéo thả file PDF vào đây"}</strong>
            <span>
              hoặc <b>chọn file từ máy tính</b>
            </span>
          </div>
        ) : (
          <div className="as-file">
            <span className="as-file-icon">PDF</span>
            <div className="as-file-info">
              <strong>{deck.file.name}</strong>
              <span>
                {deck.questions.length} {unit}
                {deck.skipped > 0 && (
                  <>
                    {" · "}
                    <b className="bad-text">bỏ qua {deck.skipped} câu chưa hoàn chỉnh</b>
                  </>
                )}
              </span>
            </div>
            <button className="btn btn-sm btn-light" type="button" onClick={removeFile}>
              Chọn file khác
            </button>
          </div>
        )}
      </section>
    </>
  );
}

/** Công tắc bật/tắt trong thẻ cài đặt */
export function Switch({ checked, onChange, label, sub }) {
  return (
    <label className="as-switch">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="as-switch-track" />
      <span>
        <strong>{label}</strong>
        <small>{sub}</small>
      </span>
    </label>
  );
}

/** Hẹn giờ có huỷ hàng loạt + âm thanh có nút tắt tiếng — dùng chung cho các trò chơi */
export function useGameKit() {
  const timers = useRef([]);
  const [muted, setMuted] = useState(readMuted);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  const later = useCallback((fn, ms) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);

  const clearTimers = useCallback(() => {
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const sfx = useCallback((name) => {
    if (!mutedRef.current) playSound(name);
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      writeMuted(!m);
      return !m;
    });
  }, []);

  return { later, clearTimers, sfx, muted, toggleMute };
}

/** Toàn màn hình cho khung trò chơi */
export function useFullscreen(ref) {
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === ref.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [ref]);

  const toggle = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else ref.current?.requestFullscreen?.().catch(() => {});
  }, [ref]);

  const exit = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen?.();
  }, []);

  return { fullscreen, toggle, exit };
}

/** Pháo giấy khi thắng / đạt kết quả tốt */
export function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 70 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 1.2,
        duration: 2.2 + Math.random() * 1.8,
        color: ["#f43f5e", "#3b82f6", "#f59e0b", "#22c55e", "#a855f7", "#06b6d4"][i % 6],
        rotate: Math.random() * 360,
        size: 6 + Math.random() * 6,
      })),
    [],
  );
  return (
    <div className="og-confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={i}
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 1.6,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            transform: `rotate(${p.rotate}deg)`,
          }}
        />
      ))}
    </div>
  );
}

const defaultFormat = (score) => score.toLocaleString("vi-VN");

export function Leaderboard({ list, highlight, format = defaultFormat }) {
  if (!list.length) return <p className="og-board-empty">Chưa có ai trên bảng xếp hạng. Hãy là người đầu tiên!</p>;
  return (
    <ol className="og-board">
      {list.map((e, i) => (
        <li key={e.date + e.name} className={e.date === highlight ? "me" : ""}>
          <span className="og-board-rank">{["🥇", "🥈", "🥉"][i] || i + 1}</span>
          <span className="og-board-name">{e.name}</span>
          <span className="og-board-meta">
            {e.passed}/{e.total} câu
          </span>
          <strong>{format(e.score)}</strong>
        </li>
      ))}
    </ol>
  );
}

/** Thẻ bảng xếp hạng ở màn hình cài đặt */
export function LeaderboardCard({ lb, format }) {
  function handleClear() {
    if (window.confirm("Xoá toàn bộ bảng xếp hạng của đề này?")) lb.clear();
  }
  return (
    <section className="as-card">
      <div className="as-card-head">
        <span className="as-step">🏆</span>
        <div>
          <h3>Bảng xếp hạng</h3>
          <p>Top {BOARD_SIZE} của đề này, lưu trên trình duyệt của máy đang chơi.</p>
        </div>
        {lb.board.length > 0 && (
          <>
            <div className="spacer" />
            <button className="btn btn-sm btn-light" type="button" onClick={handleClear}>
              Xoá bảng
            </button>
          </>
        )}
      </div>
      <Leaderboard list={lb.board} format={format} />
    </section>
  );
}

/** Trạng thái bảng xếp hạng của 1 đề: tải, kiểm tra lọt top, lưu tên */
export function useLeaderboard(key) {
  const [board, setBoard] = useState([]);
  const [entry, setEntry] = useState("none"); // none | ask | saved
  const [playerName, setPlayerName] = useState(readPlayerName);
  const [highlight, setHighlight] = useState(null);

  useEffect(() => {
    setBoard(key ? loadBoard(key) : []);
  }, [key]);

  const reset = useCallback(() => {
    setEntry("none");
    setHighlight(null);
    if (key) setBoard(loadBoard(key));
  }, [key]);

  /** Gọi khi kết thúc lượt chơi */
  const finish = useCallback(
    (score) => {
      if (!key) return;
      const list = loadBoard(key);
      setBoard(list);
      setEntry(qualifies(list, score) ? "ask" : "none");
    },
    [key],
  );

  const submit = useCallback(
    ({ score, passed, total }) => {
      const name = playerName.trim() || "Người chơi";
      writePlayerName(name);
      const date = Date.now();
      setBoard(saveScore(key, { name, score, passed, total, date }));
      setHighlight(date);
      setEntry("saved");
    },
    [key, playerName],
  );

  const clear = useCallback(() => {
    if (!key) return;
    clearBoard(key);
    setBoard([]);
  }, [key]);

  return { board, entry, playerName, setPlayerName, highlight, reset, finish, submit, clear };
}

/** Ô nhập tên khi lọt top + bảng xếp hạng ở màn hình kết quả */
export function ResultBoard({ lb, result, format }) {
  return (
    <>
      {lb.entry === "ask" && (
        <form
          className="og-name-form"
          onSubmit={(e) => {
            e.preventDefault();
            lb.submit(result);
          }}
        >
          <label>
            🎉 Bạn lọt vào top {BOARD_SIZE}! Nhập tên để lưu điểm:
            <input
              value={lb.playerName}
              onChange={(e) => lb.setPlayerName(e.target.value.slice(0, 30))}
              placeholder="Tên người chơi / tên đội"
              autoFocus
            />
          </label>
          <button className="btn btn-primary btn-sm" type="submit">
            Lưu điểm
          </button>
        </form>
      )}

      {(lb.entry === "saved" || lb.board.length > 0) && (
        <div className="og-result-board">
          <small>Bảng xếp hạng</small>
          <Leaderboard list={lb.board} highlight={lb.highlight} format={format} />
        </div>
      )}
    </>
  );
}

/** Xem lại các câu trả lời sai / hết giờ. items: [{ q, i, status }] */
export function MissedList({ items }) {
  if (!items.length) return null;
  return (
    <details className="og-missed">
      <summary>Xem lại {items.length} câu trả lời sai / hết giờ</summary>
      <ol>
        {items.map((m) => {
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
  );
}

/** 0–3 sao theo tỉ lệ câu đúng */
export function Stars({ count }) {
  return (
    <div className="og-stars" aria-label={`${count}/3 sao`}>
      {[1, 2, 3].map((n) => (
        <span key={n} className={n <= count ? "lit" : ""} style={{ animationDelay: `${n * 0.18}s` }}>
          ★
        </span>
      ))}
    </div>
  );
}

export function starsOf(right, total) {
  if (!right || !total) return 0;
  const rate = right / total;
  if (rate >= 0.9) return 3;
  if (rate >= 0.6) return 2;
  return 1;
}

/** Báo cho GameHub biết trò chơi đang chạy (để ẩn thanh chọn trò chơi) */
export function usePlayingSignal(playing, onPlaying) {
  useEffect(() => {
    onPlaying?.(playing);
  }, [playing, onPlaying]);
  useEffect(() => () => onPlaying?.(false), [onPlaying]);
}
