// games/BoardGames.jsx — Máy quay số · Đèn nhảy · Loại trừ sinh tồn
import { useMemo, useState } from "react";
import { colorOf, easeOutQuart, pickOne, randomInt, shuffle, useTimers } from "../pickerUtils";

const tileSize = (n) => (n <= 12 ? "lg" : n <= 30 ? "md" : "sm");

/* =========================================================
   MÁY QUAY SỐ — cuộn tên như máy đánh bạc
========================================================= */

const ROW = 92;
const STRIP = 46;

export function SlotGame({ pool, sfx, onResult }) {
  const { animate } = useTimers();
  const [strip, setStrip] = useState(() => shuffle(pool).concat(shuffle(pool)).slice(0, Math.max(3, pool.length)));
  const [offset, setOffset] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [lever, setLever] = useState(false);

  const spin = () => {
    if (spinning) return;
    const w = pool[randomInt(pool.length)];
    const items = [strip[Math.round(offset / ROW)] || pool[0], strip[Math.round(offset / ROW) + 1] || pool[0]];
    while (items.length < STRIP) {
      const prev = items[items.length - 1];
      const next = pool.length > 1 ? pickOne(pool.filter((p) => p.id !== prev.id)) : pool[0];
      items.push(next);
    }
    items[STRIP - 2] = w;
    items.push(pickOne(pool));
    setStrip(items);
    setOffset(0);
    setSpinning(true);
    setLever(true);
    sfx("power");
    let lastRow = 0;
    const end = (STRIP - 3) * ROW;
    animate(
      5000,
      (t) => {
        const y = end * easeOutQuart(t);
        setOffset(y);
        const row = Math.floor(y / ROW);
        if (row !== lastRow) sfx("tick");
        lastRow = row;
        if (t > 0.1) setLever(false);
      },
      () => {
        setSpinning(false);
        onResult(w);
      },
    );
  };

  return (
    <div className="np-game">
      <div className="np-slot">
        <div className="np-slot-lights" aria-hidden="true">
          {Array.from({ length: 14 }, (_, i) => <i key={i} style={{ animationDelay: `${(i % 3) * 0.2}s` }} />)}
        </div>
        <div className="np-slot-title">🎰 MÁY QUAY SỐ 🎰</div>
        <div className="np-slot-window">
          <div className="np-slot-strip" style={{ transform: `translateY(${-offset}px)` }}>
            {strip.map((p, i) => (
              <div key={i} className="np-slot-row" style={{ height: ROW }}>
                <span className="np-slot-no" style={{ background: colorOf(p.id) }}>{p.no}</span>
                {p.name}
              </div>
            ))}
          </div>
          <div className="np-slot-mark" aria-hidden="true" />
        </div>
        <button type="button" className={`np-slot-lever ${lever ? "pulled" : ""}`} onClick={spin} disabled={spinning} aria-label="Kéo cần">
          <span />
        </button>
      </div>
      <button type="button" className="np-go" onClick={spin} disabled={spinning}>
        {spinning ? "Đang quay..." : "🎰 Kéo cần quay số"}
      </button>
    </div>
  );
}

/* =========================================================
   ĐÈN NHẢY — ánh đèn chạy khắp lớp rồi dừng ở 1 bạn
========================================================= */

export function SpotlightGame({ pool, sfx, onResult }) {
  const { later } = useTimers();
  const [lit, setLit] = useState(-1);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const n = pool.length;

  const start = () => {
    if (running) return;
    const w = randomInt(n);
    const steps = 34;
    const seq = [];
    let prev = lit;
    for (let k = 0; k < steps - 1; k++) {
      let next = randomInt(n);
      if (n > 1) while (next === prev) next = randomInt(n);
      seq.push(next);
      prev = next;
    }
    if (n > 1 && seq[seq.length - 1] === w) seq[seq.length - 1] = (w + 1) % n;
    seq.push(w);
    setRunning(true);
    setDone(false);
    let at = 0;
    seq.forEach((idx, k) => {
      at += 45 + 520 * (k / steps) ** 3;
      later(() => {
        setLit(idx);
        sfx("tick");
      }, at);
    });
    later(() => {
      setDone(true);
      setRunning(false);
      later(() => onResult(pool[w]), 700);
    }, at + 400);
  };

  return (
    <div className="np-game">
      <div className={`np-tiles ${tileSize(n)} ${running ? "dim" : ""}`}>
        {pool.map((p, i) => (
          <div key={p.id} className={`np-tile ${lit === i ? (done ? "win" : "lit") : ""}`} style={{ "--c": colorOf(i) }}>
            <small>{p.no}</small>
            {p.name}
          </div>
        ))}
      </div>
      <button type="button" className="np-go" onClick={start} disabled={running || done}>
        {running ? "Đèn đang nhảy..." : "💡 Bật đèn"}
      </button>
    </div>
  );
}

/* =========================================================
   LOẠI TRỪ — lần lượt loại các bạn, người cuối cùng còn lại được gọi
========================================================= */

export function EliminationGame({ pool, sfx, onResult }) {
  const { later } = useTimers();
  const [out, setOut] = useState(() => new Set());
  const [running, setRunning] = useState(false);
  const [winner, setWinner] = useState(-1);
  const n = pool.length;
  const left = n - out.size;
  const order = useMemo(() => shuffle(pool.map((_, i) => i)), [pool]);

  const start = () => {
    if (running) return;
    setRunning(true);
    const w = order[order.length - 1]; // thứ tự loại đã xáo ngẫu nhiên; người cuối cùng là người được gọi
    const victims = order.slice(0, -1);
    const removed = new Set();
    let at = 300;
    let k = 0;
    while (k < victims.length) {
      const remain = n - k;
      const batch = remain > 14 ? Math.ceil((remain - 1) / 6) : 1;
      const group = victims.slice(k, k + batch);
      k += batch;
      later(() => {
        group.forEach((v) => removed.add(v));
        setOut(new Set(removed));
        sfx(remain <= 3 ? "slash" : "shot");
      }, at);
      at += remain > 14 ? 420 : remain > 5 ? 520 : 1000;
    }
    later(() => {
      setWinner(w);
      sfx("power");
      later(() => onResult(pool[w]), 900);
    }, at);
  };

  return (
    <div className="np-game">
      <div className="np-elim-status">
        {winner >= 0 ? "🏆 Người sống sót cuối cùng!" : running ? `Còn lại ${left} / ${n} bạn` : `${n} bạn tham gia — ai sẽ trụ lại cuối cùng?`}
      </div>
      <div className={`np-tiles ${tileSize(n)}`}>
        {pool.map((p, i) => (
          <div
            key={p.id}
            className={`np-tile ${out.has(i) ? "out" : ""} ${winner === i ? "win" : ""}`}
            style={{ "--c": colorOf(i) }}
          >
            <small>{p.no}</small>
            {p.name}
            {out.has(i) && <span className="np-boom" aria-hidden="true">💥</span>}
          </div>
        ))}
      </div>
      <button type="button" className="np-go" onClick={start} disabled={running}>
        {running ? "Đang loại trừ..." : "⚔️ Bắt đầu loại trừ"}
      </button>
    </div>
  );
}
