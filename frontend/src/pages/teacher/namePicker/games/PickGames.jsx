// games/PickGames.jsx — Lật thẻ bí mật · Bắn bóng bay · Rút thăm · Hộp quà may mắn
import { useMemo, useState } from "react";
import { colorOf, randomBetween, randomInt, shuffle, useTimers } from "../pickerUtils";

/* =========================================================
   LẬT THẺ BÍ MẬT — chọn 1 số, lật thẻ ra tên
========================================================= */

export function CardsGame({ pool, sfx, onResult }) {
  const { later } = useTimers();
  const [deck, setDeck] = useState(() => shuffle(pool));
  const [flipped, setFlipped] = useState(-1);
  const [shuffling, setShuffling] = useState(false);
  const n = deck.length;
  const size = n <= 12 ? "lg" : n <= 30 ? "md" : "sm";
  const busy = flipped >= 0 || shuffling;

  const flip = (i) => {
    if (busy) return;
    setFlipped(i);
    sfx("power");
    later(() => onResult(deck[i]), 1100);
  };

  const reshuffle = () => {
    if (busy) return;
    setShuffling(true);
    sfx("skip");
    later(() => {
      setDeck(shuffle(pool));
      setShuffling(false);
    }, 800);
  };

  return (
    <div className="np-game">
      <p className="np-help">Mời một bạn chọn số thẻ bất kỳ, hoặc để máy chọn giúp.</p>
      <div className={`np-cards ${size} ${shuffling ? "shuffling" : ""}`}>
        {deck.map((p, i) => (
          <button
            type="button"
            key={p.id}
            className={`np-card ${flipped === i ? "flipped" : ""}`}
            onClick={() => flip(i)}
            disabled={busy && flipped !== i}
            style={{ "--c": colorOf(i), "--d": `${(i % 7) * 40}ms` }}
          >
            <span className="np-card-inner">
              <span className="np-card-back">{i + 1}</span>
              <span className="np-card-front">{p.name}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="np-go-row">
        <button type="button" className="np-go ghost" onClick={reshuffle} disabled={busy}>🔀 Xáo thẻ</button>
        <button type="button" className="np-go" onClick={() => flip(randomInt(n))} disabled={busy}>🎲 Máy chọn giúp</button>
      </div>
    </div>
  );
}

/* =========================================================
   BẮN BÓNG BAY — bấm vào quả bóng để xem tên bên trong
========================================================= */

const MAX_BALLOONS = 12;

export function BalloonGame({ pool, sfx, onResult }) {
  const { later } = useTimers();
  const [popped, setPopped] = useState(-1);
  const balloons = useMemo(() => {
    const picked = shuffle(pool).slice(0, MAX_BALLOONS);
    const lanes = shuffle(picked.map((_, i) => i));
    return picked.map((p, i) => ({
      p,
      color: colorOf(randomInt(12)),
      left: ((lanes[i] + 0.5) / picked.length) * 88 + 4,
      duration: randomBetween(9, 14),
      delay: -randomBetween(0, 14),
      sway: randomBetween(2.4, 4),
    }));
  }, [pool]);

  const pop = (i) => {
    if (popped >= 0) return;
    setPopped(i);
    sfx("shot");
    later(() => onResult(balloons[i].p), 1200);
  };

  return (
    <div className="np-game">
      <p className="np-help">Mỗi quả bóng giấu tên một bạn. Bấm vào quả bóng để bắn nổ!</p>
      <div className={`np-sky ${popped >= 0 ? "frozen" : ""}`}>
        <span className="np-cloud c1">☁️</span>
        <span className="np-cloud c2">☁️</span>
        <span className="np-cloud c3">☁️</span>
        {balloons.map((b, i) => (
          <button
            type="button"
            key={b.p.id}
            className={`np-balloon ${popped === i ? "popped" : ""}`}
            onClick={() => pop(i)}
            style={{
              left: `${b.left}%`,
              "--c": b.color,
              animationDuration: `${b.duration}s, ${b.sway}s`,
              animationDelay: `${b.delay}s, ${b.delay}s`,
            }}
            aria-label="Bóng bay"
          >
            {popped === i ? (
              <span className="np-balloon-name">💥 {b.p.name}</span>
            ) : (
              <span className="np-balloon-body">?</span>
            )}
          </button>
        ))}
      </div>
      <button type="button" className="np-go" onClick={() => pop(randomInt(balloons.length))} disabled={popped >= 0}>
        🎯 Bắn ngẫu nhiên
      </button>
    </div>
  );
}

/* =========================================================
   RÚT THĂM — lắc hũ, một lá thăm bay ra
========================================================= */

export function JarGame({ pool, sfx, onResult }) {
  const { later } = useTimers();
  const [phase, setPhase] = useState("idle"); // idle | shake | draw
  const [picked, setPicked] = useState(null);
  const papers = useMemo(
    () => Array.from({ length: Math.min(24, pool.length) }, (_, i) => ({ rot: randomBetween(-50, 50), x: randomBetween(8, 82), y: randomBetween(30, 82), c: colorOf(i) })),
    [pool],
  );

  const draw = () => {
    if (phase !== "idle") return;
    const w = pool[randomInt(pool.length)];
    setPicked(w);
    setPhase("shake");
    for (let k = 0; k < 8; k++) later(() => sfx("tick"), k * 220);
    later(() => {
      setPhase("draw");
      sfx("power");
    }, 1900);
    later(() => onResult(w), 3500);
  };

  return (
    <div className="np-game">
      <div className="np-jar-stage">
        <div className={`np-jar ${phase}`}>
          <div className="np-jar-lid" />
          <div className="np-jar-body">
            {papers.map((p, i) => (
              <span key={i} className="np-paper" style={{ left: `${p.x}%`, top: `${p.y}%`, transform: `rotate(${p.rot}deg)`, background: p.c }} />
            ))}
          </div>
        </div>
        {phase === "draw" && picked && (
          <div className="np-ticket">
            <small>Lá thăm số {picked.no}</small>
            <strong>{picked.name}</strong>
          </div>
        )}
      </div>
      <button type="button" className="np-go" onClick={draw} disabled={phase !== "idle"}>
        {phase === "idle" ? "🫙 Lắc hũ rút thăm" : "Đang rút..."}
      </button>
    </div>
  );
}

/* =========================================================
   HỘP QUÀ MAY MẮN — chọn 1 trong các hộp quà, mỗi hộp có tên 1 bạn
========================================================= */

const GIFT_COUNT = 6;
const GIFTS = ["🎁", "🎀", "🧧", "📦", "🎁", "🎀"];

export function GiftGame({ pool, sfx, onResult }) {
  const { later } = useTimers();
  const [opened, setOpened] = useState(-1);
  const gifts = useMemo(() => shuffle(pool).slice(0, GIFT_COUNT), [pool]);

  const open = (i) => {
    if (opened >= 0) return;
    setOpened(i);
    sfx("intro");
    later(() => onResult(gifts[i]), 1500);
  };

  return (
    <div className="np-game">
      <p className="np-help">Có {gifts.length} hộp quà, mỗi hộp chứa tên một bạn ngẫu nhiên. Mời lớp chọn một hộp!</p>
      <div className="np-gifts">
        {gifts.map((p, i) => (
          <button
            type="button"
            key={p.id}
            className={`np-gift ${opened === i ? "opened" : opened >= 0 ? "faded" : ""}`}
            onClick={() => open(i)}
            disabled={opened >= 0}
            style={{ "--c": colorOf(i * 2), animationDelay: `${i * 0.15}s` }}
          >
            <span className="np-gift-box">{GIFTS[i % GIFTS.length]}</span>
            <span className="np-gift-label">{opened === i ? p.name : `Hộp ${i + 1}`}</span>
          </button>
        ))}
      </div>
      <button type="button" className="np-go" onClick={() => open(randomInt(gifts.length))} disabled={opened >= 0}>
        🎲 Mở hộp ngẫu nhiên
      </button>
    </div>
  );
}
