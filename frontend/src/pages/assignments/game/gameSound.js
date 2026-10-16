// pages/assignments/game/gameSound.js — hiệu ứng âm thanh đơn giản bằng WebAudio (không cần file âm thanh)

let ctx = null;

function audio() {
  if (typeof window === "undefined") return null;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!ctx) ctx = new Ctx();
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

/* Mỗi âm: [tần số Hz, thời lượng giây, kiểu sóng?] phát nối tiếp nhau */
const SOUNDS = {
  correct: [
    [660, 0.08],
    [880, 0.14],
  ],
  combo: [
    [784, 0.07],
    [988, 0.07],
    [1319, 0.16],
  ],
  wrong: [
    [220, 0.14, "sawtooth"],
    [150, 0.26, "sawtooth"],
  ],
  tick: [[1100, 0.035, "square"]],
  count: [[520, 0.12]],
  go: [[880, 0.24]],
  skip: [
    [600, 0.06],
    [500, 0.08],
  ],
  power: [
    [440, 0.06],
    [660, 0.06],
    [880, 0.1],
  ],
  win: [
    [523, 0.12],
    [659, 0.12],
    [784, 0.12],
    [1046, 0.32],
  ],
  lose: [
    [392, 0.16, "triangle"],
    [330, 0.16, "triangle"],
    [262, 0.34, "triangle"],
  ],
};

export function playSound(name) {
  const notes = SOUNDS[name];
  const ac = notes && audio();
  if (!ac) return;
  let t = ac.currentTime + 0.01;
  for (const [freq, dur, type = "sine"] of notes) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(type === "sine" ? 0.22 : 0.09, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(ac.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
    t += dur * 0.9;
  }
}

const MUTE_KEY = "og_muted";

export function readMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeMuted(muted) {
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    /* bỏ qua */
  }
}
