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

/* Mỗi âm: [tần số Hz, thời lượng giây, kiểu sóng?, tần số cuối?] phát nối tiếp nhau.
 * Kiểu "noise" = tiếng ồn trắng qua bộ lọc (tần số = tần số lọc) — dùng cho tiếng súng, tiếng chém. */
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
  // Bắn zombie
  shot: [
    [1800, 0.05, "noise"],
    [160, 0.16, "square", 50],
  ],
  slash: [
    [3200, 0.18, "noise"],
    [180, 0.3, "sawtooth", 70],
  ],
  groan: [[140, 0.6, "sawtooth", 90]],
  zombieDie: [
    [220, 0.3, "sawtooth", 120],
    [120, 0.6, "sawtooth", 40],
  ],
  // Ai là triệu phú
  intro: [
    [392, 0.1],
    [523, 0.1],
    [659, 0.22],
  ],
  suspense: [
    [196, 0.5, "triangle"],
    [207, 0.5, "triangle"],
    [220, 0.6, "triangle"],
  ],
};

let noiseBuffer = null;

function noise(ac) {
  if (!noiseBuffer) {
    noiseBuffer = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

export function playSound(name) {
  const notes = SOUNDS[name];
  const ac = notes && audio();
  if (!ac) return;
  let t = ac.currentTime + 0.01;
  for (const [freq, dur, type = "sine", endFreq] of notes) {
    const gain = ac.createGain();
    let osc;
    if (type === "noise") {
      osc = ac.createBufferSource();
      osc.buffer = noise(ac);
      const filter = ac.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(freq, t);
      osc.connect(filter).connect(gain);
    } else {
      osc = ac.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
      osc.connect(gain);
    }
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(type === "sine" ? 0.22 : type === "noise" ? 0.35 : 0.09, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    gain.connect(ac.destination);
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
