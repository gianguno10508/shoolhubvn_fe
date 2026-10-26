// games/SpinGames.jsx — Vòng quay may mắn · Mũi tên định mệnh
import { useState } from "react";
import { colorOf, easeOutQuart, randomBetween, randomInt, shortName, useTimers } from "../pickerUtils";

const R = 240;
const norm = (deg) => ((deg % 360) + 360) % 360;
const point = (deg, r) => {
  const a = (deg * Math.PI) / 180;
  return `${(r * Math.sin(a)).toFixed(2)} ${(-r * Math.cos(a)).toFixed(2)}`;
};

/** Quay `rot` sao cho vị trí góc `angle` (tính từ đỉnh, theo chiều kim đồng hồ) dừng ở đỉnh / ở `aim` */
function useSpin({ memoKey, memo, sfx, segCount, invert }) {
  const { animate } = useTimers();
  const [rot, setRot] = useState(memo[memoKey] || 0);
  const [spinning, setSpinning] = useState(false);
  const seg = 360 / segCount;

  const spin = (targetIdx, done) => {
    const angle = targetIdx * seg + (invert ? 0 : seg / 2) + randomBetween(-0.32, 0.32) * seg;
    const from = rot;
    const goal = invert ? angle : -angle; // vòng quay: đưa ô lên đỉnh; mũi tên: chỉ vào ô
    const to = from + 360 * (5 + randomInt(3)) + norm(goal - from);
    setSpinning(true);
    let lastIdx = -1;
    let lastTick = -100;
    animate(
      6000,
      (t, ms) => {
        const r = from + (to - from) * easeOutQuart(t);
        setRot(r);
        const idx = Math.floor(norm(invert ? r + seg / 2 : -r) / seg);
        if (idx !== lastIdx && ms - lastTick > 45) {
          sfx("tick");
          lastTick = ms;
        }
        lastIdx = idx;
      },
      () => {
        memo[memoKey] = norm(to);
        setSpinning(false);
        done();
      },
    );
  };

  return { rot, spinning, spin, seg };
}

export function WheelGame({ pool, sfx, onResult, memo }) {
  const n = pool.length;
  const { rot, spinning, spin, seg } = useSpin({ memoKey: "wheelRot", memo, sfx, segCount: n });
  const fontSize = n <= 8 ? 20 : n <= 16 ? 15 : n <= 26 ? 12 : n <= 36 ? 10 : 8;
  const maxChars = n <= 16 ? 16 : 12;

  const go = () => {
    if (spinning) return;
    const target = randomInt(n);
    spin(target, () => onResult(pool[target]));
  };

  const fill = (i) => (i === n - 1 && n > 1 && colorOf(i) === colorOf(0) ? colorOf(i + 4) : colorOf(i));

  return (
    <div className="np-game np-wheel-game">
      <div className="np-wheel-wrap">
        <div className="np-wheel-pointer" aria-hidden="true" />
        <svg className="np-wheel-svg" viewBox="-260 -260 520 520">
          <circle r={R + 14} className="np-wheel-rim" />
          <g transform={`rotate(${rot})`}>
            {n === 1 ? (
              <circle r={R} fill={colorOf(0)} />
            ) : (
              pool.map((p, i) => (
                <path
                  key={p.id}
                  d={`M0 0 L${point(i * seg, R)} A${R} ${R} 0 ${seg > 180 ? 1 : 0} 1 ${point((i + 1) * seg, R)} Z`}
                  fill={fill(i)}
                  stroke="#fff"
                  strokeWidth={n > 30 ? 1 : 2}
                />
              ))
            )}
            {pool.map((p, i) => (
              <text
                key={p.id}
                transform={`rotate(${i * seg + seg / 2 - 90})`}
                x={R - 16}
                y={fontSize * 0.35}
                textAnchor="end"
                fontSize={fontSize}
                className="np-wheel-text"
              >
                {shortName(p.name, maxChars)}
              </text>
            ))}
          </g>
          {Array.from({ length: 24 }, (_, i) => {
            const a = (i * 15 * Math.PI) / 180;
            return (
              <circle
                key={i}
                cx={(R + 7) * Math.sin(a)}
                cy={-(R + 7) * Math.cos(a)}
                r="3.2"
                className="np-wheel-bulb"
                style={{ animationDelay: `${(i % 2) * 0.45}s` }}
              />
            );
          })}
        </svg>
        <button type="button" className="np-wheel-hub" onClick={go} disabled={spinning}>
          {spinning ? "🌀" : "QUAY"}
        </button>
      </div>
      <button type="button" className="np-go" onClick={go} disabled={spinning}>
        {spinning ? "Đang quay..." : "🎡 Quay vòng quay"}
      </button>
    </div>
  );
}

export function ArrowGame({ pool, sfx, onResult, memo }) {
  const n = pool.length;
  const { rot, spinning, spin, seg } = useSpin({ memoKey: "arrowRot", memo, sfx, segCount: n, invert: true });
  const pointed = Math.floor(norm(rot + seg / 2) / seg) % n;
  const chip = n <= 12 ? "lg" : n <= 24 ? "md" : "sm";

  const go = () => {
    if (spinning) return;
    const target = randomInt(n);
    spin(target, () => onResult(pool[target]));
  };

  return (
    <div className="np-game">
      <div className={`np-arrow-ring ${chip}`}>
        {pool.map((p, i) => {
          const a = (i * seg * Math.PI) / 180;
          return (
            <span
              key={p.id}
              className={`np-arrow-chip ${i === pointed ? "on" : ""}`}
              style={{
                left: `${50 + 43 * Math.sin(a)}%`,
                top: `${50 - 43 * Math.cos(a)}%`,
                "--c": colorOf(i),
              }}
            >
              {shortName(p.name, 12)}
            </span>
          );
        })}
        <button
          type="button"
          className="np-arrow"
          onClick={go}
          disabled={spinning}
          style={{ transform: `translate(-50%, -50%) rotate(${rot}deg)` }}
          aria-label="Quay mũi tên"
        >
          <svg viewBox="0 0 60 300" aria-hidden="true">
            <defs>
              <linearGradient id="np-arrow-g" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="#f43f5e" />
                <stop offset="1" stopColor="#7c3aed" />
              </linearGradient>
            </defs>
            <path d="M30 0 L56 52 L38 46 L38 215 L48 238 L12 238 L22 215 L22 46 L4 52 Z" fill="url(#np-arrow-g)" />
            <circle cx="30" cy="150" r="22" fill="#1e293b" />
            <circle cx="30" cy="150" r="9" fill="#facc15" />
          </svg>
        </button>
      </div>
      <button type="button" className="np-go" onClick={go} disabled={spinning}>
        {spinning ? "Mũi tên đang quay..." : "🧭 Quay mũi tên"}
      </button>
    </div>
  );
}
