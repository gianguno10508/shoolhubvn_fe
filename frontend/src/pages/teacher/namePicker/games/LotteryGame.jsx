// games/LotteryGame.jsx — Lồng cầu xổ số: các quả cầu mang số thứ tự nảy trong lồng, 1 quả rơi ra
import { useEffect, useRef, useState } from "react";
import { colorOf, randomBetween, randomInt, useTimers } from "../pickerUtils";

const DRUM = 150;
const MIX_MS = 4200;

export function LotteryGame({ pool, sfx, onResult }) {
  const { later, loop } = useTimers();
  const n = pool.length;
  const r = n <= 20 ? 17 : n <= 35 ? 14 : 12;
  const nodes = useRef([]);
  const state = useRef({ mixing: false, hidden: -1 });
  const [phase, setPhase] = useState("idle"); // idle | mix | out
  const [winner, setWinner] = useState(null);

  useEffect(() => {
    const balls = pool.map(() => ({
      x: randomBetween(-DRUM / 2, DRUM / 2),
      y: randomBetween(0, DRUM / 2),
      vx: randomBetween(-0.1, 0.1),
      vy: 0,
    }));
    const lim = DRUM - r - 6;
    const stop = loop((dt) => {
      const mix = state.current.mixing;
      for (const b of balls) {
        if (mix) {
          // xoáy theo chiều kim đồng hồ + rung lắc ngẫu nhiên
          b.vx += (-b.y / DRUM) * 0.004 * dt + randomBetween(-0.02, 0.02) * dt;
          b.vy += (b.x / DRUM) * 0.004 * dt + randomBetween(-0.02, 0.02) * dt;
        }
        b.vy += 0.0012 * dt;
        const sp = Math.hypot(b.vx, b.vy);
        const max = mix ? 0.9 : 0.6;
        if (sp > max) {
          b.vx *= max / sp;
          b.vy *= max / sp;
        }
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        const d = Math.hypot(b.x, b.y);
        if (d > lim) {
          const nx = b.x / d;
          const ny = b.y / d;
          b.x = nx * lim;
          b.y = ny * lim;
          const dot = b.vx * nx + b.vy * ny;
          if (dot > 0) {
            b.vx -= 1.55 * dot * nx;
            b.vy -= 1.55 * dot * ny;
          }
          b.vx *= 0.985;
        }
      }
      // va chạm giữa các quả cầu
      for (let i = 0; i < balls.length; i++) {
        for (let j = i + 1; j < balls.length; j++) {
          const a = balls[i];
          const b = balls[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d = Math.hypot(dx, dy) || 0.01;
          if (d < r * 2) {
            const push = (r * 2 - d) / 2;
            const nx = dx / d;
            const ny = dy / d;
            a.x -= nx * push;
            a.y -= ny * push;
            b.x += nx * push;
            b.y += ny * push;
            const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
            if (rel < 0) {
              a.vx += rel * nx * 0.9;
              a.vy += rel * ny * 0.9;
              b.vx -= rel * nx * 0.9;
              b.vy -= rel * ny * 0.9;
            }
          }
        }
      }
      balls.forEach((b, i) => {
        const el = nodes.current[i];
        if (el) el.setAttribute("transform", `translate(${b.x.toFixed(1)} ${b.y.toFixed(1)})`);
      });
    });
    return stop;
  }, [pool, r, loop]);

  const draw = () => {
    if (phase !== "idle") return;
    const w = randomInt(n);
    state.current.mixing = true;
    setPhase("mix");
    sfx("suspense");
    for (let k = 1; k < 12; k++) later(() => sfx("tick"), k * 330);
    later(() => {
      state.current.mixing = false;
      setWinner(w);
      setPhase("out");
      sfx("power");
      later(() => onResult(pool[w]), 1800);
    }, MIX_MS);
  };

  return (
    <div className="np-game">
      <div className="np-lottery">
        <svg viewBox="-190 -180 380 360" className={`np-drum ${phase === "mix" ? "mixing" : ""}`}>
          <defs>
            <radialGradient id="np-drum-glass" cx="0.35" cy="0.3" r="0.8">
              <stop offset="0" stopColor="rgba(255,255,255,0.55)" />
              <stop offset="1" stopColor="rgba(191,219,254,0.18)" />
            </radialGradient>
            <radialGradient id="np-ball-shine" cx="0.35" cy="0.3" r="0.7">
              <stop offset="0" stopColor="rgba(255,255,255,0.85)" />
              <stop offset="0.4" stopColor="rgba(255,255,255,0)" />
            </radialGradient>
          </defs>
          <rect x="-26" y={DRUM - 4} width="52" height="34" rx="6" className="np-drum-base" />
          <circle r={DRUM} className="np-drum-glass" fill="url(#np-drum-glass)" />
          <g className="np-drum-spokes">
            {[0, 60, 120].map((a) => (
              <line key={a} x1="0" y1={-DRUM} x2="0" y2={DRUM} transform={`rotate(${a})`} />
            ))}
          </g>
          {pool.map((p, i) => (
            <g key={p.id} ref={(el) => (nodes.current[i] = el)} style={{ opacity: winner === i ? 0 : 1 }}>
              <circle r={r} fill={colorOf(i)} />
              <circle r={r} fill="url(#np-ball-shine)" />
              <circle r={r * 0.62} fill="#fff" opacity="0.92" />
              <text y={r * 0.3} textAnchor="middle" fontSize={r * 0.82} className="np-ball-no">{p.no}</text>
            </g>
          ))}
          <circle r={DRUM} className="np-drum-ring" />
        </svg>
        {phase === "out" && winner !== null && (
          <div className="np-lottery-out">
            <div className="np-big-ball" style={{ "--c": colorOf(winner) }}>
              <span>{pool[winner].no}</span>
            </div>
            <strong>{pool[winner].name}</strong>
          </div>
        )}
      </div>
      <button type="button" className="np-go" onClick={draw} disabled={phase !== "idle"}>
        {phase === "idle" ? "🎱 Quay lồng cầu" : phase === "mix" ? "Đang trộn cầu..." : "Cầu đã ra!"}
      </button>
    </div>
  );
}
