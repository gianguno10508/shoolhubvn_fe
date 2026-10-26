// games/RaceGame.jsx — Đường đua: xe, ngựa, vịt, ốc sên, tên lửa... ai về đích đầu tiên được gọi
import { useState } from "react";
import { randomBetween, randomInt, shortName, useTimers } from "../pickerUtils";

export const RACE_THEMES = [
  { id: "car", icon: "🏎️", label: "Đua xe", track: "asphalt", flip: true },
  { id: "horse", icon: "🐎", label: "Đua ngựa", track: "grass", flip: true },
  { id: "duck", icon: "🦆", label: "Đua vịt", track: "water", flip: true },
  { id: "snail", icon: "🐌", label: "Ốc sên", track: "grass", flip: true },
  { id: "turtle", icon: "🐢", label: "Rùa", track: "sand", flip: true },
  { id: "rocket", icon: "🚀", label: "Tên lửa", track: "space", rotate: 45 },
];

const DURATION = 7500;
const CHECKPOINTS = 12;

/** Lộ trình 0→1 với tốc độ thay đổi thất thường (có lúc bứt tốc, có lúc chững lại) */
function makePlan(finishAt) {
  const steps = Array.from({ length: CHECKPOINTS }, () => {
    const r = Math.random();
    return r < 0.12 ? randomBetween(2, 3.2) : r < 0.25 ? randomBetween(0.1, 0.4) : randomBetween(0.6, 1.4);
  });
  const total = steps.reduce((a, b) => a + b, 0);
  let acc = 0;
  const marks = [0, ...steps.map((s) => (acc += s / total))];
  return { finishAt, marks };
}

function progressAt(plan, ms) {
  const t = Math.min(1, ms / plan.finishAt) * CHECKPOINTS;
  const i = Math.min(CHECKPOINTS - 1, Math.floor(t));
  return plan.marks[i] + (plan.marks[i + 1] - plan.marks[i]) * (t - i);
}

export function RaceGame({ pool, sfx, onResult, memo }) {
  const { later, animate } = useTimers();
  const [themeId, setThemeId] = useState(memo.raceTheme || "car");
  const [pos, setPos] = useState(() => pool.map(() => 0));
  const [phase, setPhase] = useState("ready"); // ready | count | run | done
  const [count, setCount] = useState(3);
  const [winner, setWinner] = useState(-1);
  const theme = RACE_THEMES.find((t) => t.id === themeId) || RACE_THEMES[0];
  const n = pool.length;
  const lane = n <= 8 ? "xl" : n <= 14 ? "lg" : n <= 24 ? "md" : "sm";
  const leader = pos.reduce((best, p, i) => (p > pos[best] ? i : best), 0);

  const chooseTheme = (id) => {
    memo.raceTheme = id;
    setThemeId(id);
  };

  const start = () => {
    if (phase !== "ready") return;
    const w = randomInt(n);
    const plans = pool.map((_, i) => makePlan(i === w ? DURATION : DURATION * randomBetween(1.03, 1.45)));
    setWinner(-1);
    setPhase("count");
    [3, 2, 1].forEach((c, k) =>
      later(() => {
        setCount(c);
        sfx("count");
      }, k * 700),
    );
    later(() => {
      sfx("go");
      setPhase("run");
      let nextTick = 0;
      animate(
        DURATION,
        (_, ms) => {
          setPos(plans.map((p) => Math.min(1, progressAt(p, ms))));
          if (ms > nextTick) {
            sfx("tick");
            nextTick = ms + 380;
          }
        },
        () => {
          setWinner(w);
          setPhase("done");
          later(() => onResult(pool[w]), 900);
        },
      );
    }, 2100);
  };

  return (
    <div className="np-game">
      <div className="np-race-themes">
        {RACE_THEMES.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`np-chip ${t.id === themeId ? "active" : ""}`}
            onClick={() => chooseTheme(t.id)}
            disabled={phase !== "ready"}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div className={`np-race ${theme.track} ${lane}`}>
        {phase === "count" && <div className="np-race-count" key={count}>{count}</div>}
        {phase === "run" && <div className="np-race-leader">🔥 Dẫn đầu: <b>{pool[leader]?.name}</b></div>}
        {pool.map((p, i) => (
          <div key={p.id} className={`np-race-lane ${winner === i ? "win" : ""}`}>
            <span className="np-race-no">{p.no}</span>
            <span className="np-race-name" title={p.name}>{shortName(p.name, 18)}</span>
            <div className="np-race-track">
              <span className={`np-racer ${phase === "run" ? "moving" : ""}`} style={{ "--p": pos[i] || 0 }}>
                <span style={{ transform: theme.flip ? "scaleX(-1)" : theme.rotate ? `rotate(${theme.rotate}deg)` : undefined }}>
                  {theme.icon}
                </span>
              </span>
            </div>
            {winner === i && <span className="np-race-medal">🥇</span>}
          </div>
        ))}
      </div>

      <button type="button" className="np-go" onClick={start} disabled={phase !== "ready"}>
        {phase === "ready" ? `🏁 Xuất phát!` : phase === "done" ? "🏆 Về đích!" : "Đang đua..."}
      </button>
    </div>
  );
}
