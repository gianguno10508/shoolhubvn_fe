// utils/slideThemes.js — chủ đề (phong cảnh) cho slide trình chiếu giáo án
/* Mỗi chủ đề: bảng màu + 3 ảnh nền vẽ bằng SVG (bìa, mở đầu phần, nội dung) khung 1600×900 (16:9).
 * Trình duyệt chuyển SVG thành ảnh JPG rồi nhúng vào file PowerPoint, nên không cần tải ảnh từ ngoài.
 * dark = nền tối (chữ trắng); nền sáng thì chữ dùng màu `text`. */

/* ---------- công cụ vẽ ---------- */

function rng(seed) {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const svg = (defs, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900"><defs>${defs}</defs>${body}</svg>`;

const grad = (id, stops, x2 = 0, y2 = 1) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops
    .map(([o, c, op = 1]) => `<stop offset="${o}" stop-color="#${c}" stop-opacity="${op}"/>`)
    .join("")}</linearGradient>`;

const bg = (fill) => `<rect width="1600" height="900" fill="${fill}"/>`;

const cloud = (x, y, s, op = 1, color = "FFFFFF") =>
  `<g transform="translate(${x} ${y}) scale(${s})" fill="#${color}" opacity="${op}"><ellipse cx="0" cy="0" rx="62" ry="40"/><circle cx="-48" cy="12" r="36"/><circle cx="50" cy="10" r="40"/><circle cx="8" cy="-28" r="44"/><rect x="-84" y="8" width="176" height="42" rx="21"/></g>`;

function sun(x, y, r, color = "FDE047", rays = "FACC15") {
  let out = "";
  for (let i = 0; i < 12; i++) {
    out += `<rect x="${-6}" y="${-r - 46}" width="12" height="30" rx="6" fill="#${rays}" transform="translate(${x} ${y}) rotate(${i * 30})"/>`;
  }
  return out + `<circle cx="${x}" cy="${y}" r="${r}" fill="#${color}"/>`;
}

/** Dải đồi / sóng uốn lượn từ y xuống đáy khung */
function wave(y, amp, len, color, op = 1, phase = 0) {
  let d = `M${-len + phase} ${y}`;
  for (let x = -len + phase; x < 1600 + len; x += len) d += ` q ${len / 4} ${-amp} ${len / 2} 0 t ${len / 2} 0`;
  return `<path d="${d} V900 H${-len + phase} Z" fill="#${color}" opacity="${op}"/>`;
}

function bubbles(seed, n, x0, x1, y0, y1, color = "FFFFFF", op = 0.5) {
  const r = rng(seed);
  let out = "";
  for (let i = 0; i < n; i++) {
    const rad = 6 + r() * 22;
    out += `<circle cx="${x0 + r() * (x1 - x0)}" cy="${y0 + r() * (y1 - y0)}" r="${rad}" fill="#${color}" fill-opacity="${op * 0.35}" stroke="#${color}" stroke-opacity="${op}" stroke-width="3"/>`;
  }
  return out;
}

const fish = (x, y, s, color, flip = false) =>
  `<g transform="translate(${x} ${y}) scale(${flip ? -s : s} ${s})"><path d="M30 0 L70 -26 L62 0 L70 26 Z" fill="#${color}"/><ellipse rx="44" ry="26" fill="#${color}"/><path d="M-6 -24 Q 10 -44 24 -20" fill="#${color}"/><circle cx="-22" cy="-6" r="7" fill="#fff"/><circle cx="-24" cy="-6" r="3.5" fill="#0F172A"/></g>`;

const seaweed = (x, h, color, w = 16) =>
  `<path d="M${x} 905 C ${x - 40} ${900 - h * 0.35}, ${x + 40} ${900 - h * 0.65}, ${x - 6} ${900 - h}" stroke="#${color}" stroke-width="${w}" fill="none" stroke-linecap="round"/>`;

const pine = (x, y, s, color, trunk = "7C4A1E") =>
  `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-9" y="-4" width="18" height="34" fill="#${trunk}"/><path d="M0 -170 L-52 -92 L-28 -92 L-72 -24 L-40 -24 L-86 0 L86 0 L40 -24 L72 -24 L28 -92 L52 -92 Z" fill="#${color}"/></g>`;

const leaf = (x, y, s, rot, color, op = 1) =>
  `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})" opacity="${op}"><path d="M0 0 C 24 -34, 70 -34, 96 0 C 70 34, 24 34, 0 0 Z" fill="#${color}"/><path d="M4 0 L 88 0" stroke="#fff" stroke-opacity="0.45" stroke-width="3"/></g>`;

function stars(seed, n, x0, x1, y0, y1, op = 0.9) {
  const r = rng(seed);
  let out = "";
  for (let i = 0; i < n; i++) {
    const x = x0 + r() * (x1 - x0);
    const y = y0 + r() * (y1 - y0);
    if (r() < 0.12) {
      const k = 8 + r() * 10;
      out += `<path d="M${x} ${y - k} Q ${x} ${y} ${x + k} ${y} Q ${x} ${y} ${x} ${y + k} Q ${x} ${y} ${x - k} ${y} Q ${x} ${y} ${x} ${y - k} Z" fill="#FEF9C3" opacity="${op}"/>`;
    } else out += `<circle cx="${x}" cy="${y}" r="${1 + r() * 2.6}" fill="#fff" opacity="${op * (0.4 + r() * 0.6)}"/>`;
  }
  return out;
}

const planet = (x, y, r, color, ring) =>
  `<g transform="translate(${x} ${y})"><circle r="${r}" fill="#${color}"/><circle cx="${-r * 0.3}" cy="${-r * 0.3}" r="${r * 0.55}" fill="#fff" opacity="0.12"/>${
    ring
      ? `<ellipse rx="${r * 1.75}" ry="${r * 0.42}" fill="none" stroke="#${ring}" stroke-width="${r * 0.12}" transform="rotate(-18)" opacity="0.9"/>`
      : ""
  }</g>`;

function flower(x, y, r, color, center = "FDE047", op = 1) {
  let petals = "";
  for (let i = 0; i < 5; i++) {
    const a = (i * 72 * Math.PI) / 180;
    petals += `<circle cx="${x + Math.cos(a) * r * 0.62}" cy="${y + Math.sin(a) * r * 0.62}" r="${r * 0.5}" fill="#${color}"/>`;
  }
  return `<g opacity="${op}">${petals}<circle cx="${x}" cy="${y}" r="${r * 0.32}" fill="#${center}"/></g>`;
}

function petals(seed, n, x0, x1, y0, y1, color, op = 0.7) {
  const r = rng(seed);
  let out = "";
  for (let i = 0; i < n; i++) {
    out += `<ellipse cx="${x0 + r() * (x1 - x0)}" cy="${y0 + r() * (y1 - y0)}" rx="${10 + r() * 8}" ry="${5 + r() * 4}" fill="#${color}" opacity="${op}" transform="rotate(${r() * 180} ${x0 + r() * (x1 - x0)} ${y0 + r() * (y1 - y0)})"/>`;
  }
  return out;
}

const circle = (x, y, r, color, op = 1) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#${color}" opacity="${op}"/>`;

/* ---------- các chủ đề ---------- */

export const SLIDE_THEMES = [
  {
    id: "cartoon",
    name: "Hoạt hình",
    hint: "Trời xanh, mây, đồi cỏ — vui tươi cho học sinh nhỏ",
    font: "Segoe UI",
    dark: { cover: false, section: false, content: false },
    color: { title: "E4572E", text: "2D3047", muted: "6B7280", accent: "17BEBB", soft: "FFF1C1", line: "FFC914", card: "FFFFFF" },
    cover: () =>
      svg(
        grad("sky", [[0, "7DD3FC"], [1, "E0F2FE"]]),
        bg("url(#sky)") +
          sun(1390, 170, 92) +
          cloud(330, 140, 1.1) +
          cloud(980, 110, 0.8, 0.95) +
          cloud(1180, 330, 0.7, 0.9) +
          wave(700, 70, 900, "86EFAC") +
          wave(760, 60, 700, "4ADE80", 1, 240) +
          wave(830, 40, 520, "22C55E", 1, 120) +
          flower(160, 820, 26, "F472B6") +
          flower(260, 850, 20, "FB923C") +
          flower(1450, 830, 24, "A78BFA") +
          flower(1530, 860, 18, "F472B6"),
      ),
    section: () =>
      svg(
        grad("sky", [[0, "FDE68A"], [1, "FED7AA"]]),
        bg("url(#sky)") +
          sun(1320, 260, 130, "FDE047", "FB923C") +
          cloud(260, 150, 1, 0.95) +
          cloud(760, 110, 0.7, 0.9) +
          wave(740, 70, 900, "BEF264") +
          wave(810, 50, 640, "84CC16", 1, 200),
      ),
    content: () =>
      svg(
        "",
        bg("#FFFBEB") +
          cloud(1470, 80, 0.62, 1, "BAE6FD") +
          cloud(1310, 46, 0.42, 1, "E0F2FE") +
          wave(845, 26, 560, "BBF7D0") +
          wave(865, 18, 420, "86EFAC", 1, 140) +
          flower(70, 860, 16, "F472B6") +
          flower(1540, 862, 14, "FB923C"),
      ),
  },
  {
    id: "ocean",
    name: "Đại dương",
    hint: "Biển xanh, sóng, cá và bong bóng",
    font: "Arial",
    dark: { cover: true, section: true, content: false },
    color: { title: "0369A1", text: "0F172A", muted: "475569", accent: "06B6D4", soft: "CFFAFE", line: "67E8F9", card: "FFFFFF" },
    cover: () =>
      svg(
        grad("sea", [[0, "38BDF8"], [0.45, "0284C7"], [1, "1E3A8A"]]) + grad("ray", [[0, "FFFFFF", 0.35], [1, "FFFFFF", 0]]),
        bg("url(#sea)") +
          `<path d="M200 0 L320 0 L520 900 L260 900 Z M640 0 L720 0 L900 900 L700 900 Z M1100 0 L1220 0 L1380 900 L1120 900 Z" fill="url(#ray)" opacity="0.5"/>` +
          bubbles(3, 26, 900, 1580, 60, 760) +
          fish(1180, 420, 1.5, "FB923C") +
          fish(1390, 560, 1.1, "FACC15", true) +
          fish(1000, 640, 0.9, "F472B6") +
          seaweed(1260, 260, "22C55E") +
          seaweed(1300, 200, "16A34A") +
          seaweed(1520, 300, "22C55E") +
          seaweed(90, 220, "16A34A") +
          wave(840, 26, 600, "FDE68A") +
          wave(865, 14, 400, "FCD34D", 1, 120),
      ),
    section: () =>
      svg(
        grad("sea", [[0, "0EA5E9"], [1, "0C4A6E"]]),
        bg("url(#sea)") +
          wave(110, 26, 500, "38BDF8", 0.35) +
          bubbles(9, 30, 40, 1580, 120, 860) +
          fish(1250, 560, 1.4, "FB923C") +
          fish(1430, 700, 0.9, "FDE047", true) +
          seaweed(1120, 230, "22C55E") +
          seaweed(1160, 170, "15803D") +
          seaweed(1560, 260, "16A34A"),
      ),
    content: () =>
      svg(
        grad("sea", [[0, "F0F9FF"], [1, "E0F2FE"]]),
        bg("url(#sea)") +
          bubbles(5, 9, 1380, 1580, 40, 260, "38BDF8", 0.6) +
          wave(820, 22, 520, "7DD3FC", 0.8) +
          wave(845, 18, 400, "38BDF8", 0.85, 160) +
          wave(870, 12, 300, "0284C7", 0.9, 60) +
          fish(1490, 800, 0.5, "FB923C", true),
      ),
  },
  {
    id: "forest",
    name: "Rừng xanh",
    hint: "Núi đồi, rừng thông, lá cây — gần gũi thiên nhiên",
    font: "Arial",
    dark: { cover: false, section: true, content: false },
    color: { title: "15803D", text: "1C1917", muted: "57534E", accent: "F59E0B", soft: "ECFCCB", line: "A3E635", card: "FFFFFF" },
    cover: () =>
      svg(
        grad("sky", [[0, "BBF7D0"], [1, "F0FDF4"]]),
        bg("url(#sky)") +
          sun(1350, 180, 70, "FEF08A", "FDE047") +
          `<path d="M0 760 L260 480 L470 700 L700 420 L980 720 L1220 470 L1600 760 V900 H0 Z" fill="#86EFAC"/>` +
          `<path d="M0 820 L340 600 L620 800 L900 610 L1240 820 L1460 650 L1600 760 V900 H0 Z" fill="#4ADE80"/>` +
          [80, 190, 300, 1240, 1360, 1480].map((x, i) => pine(x, 880, 1 + (i % 3) * 0.18, i % 2 ? "166534" : "15803D")).join("") +
          wave(880, 10, 300, "15803D"),
      ),
    section: () =>
      svg(
        grad("g", [[0, "166534"], [1, "14532D"]]),
        bg("url(#g)") +
          leaf(1180, 140, 1.4, 30, "4ADE80", 0.5) +
          leaf(1400, 300, 1.1, -40, "86EFAC", 0.45) +
          leaf(1260, 520, 1.6, 10, "22C55E", 0.5) +
          leaf(90, 120, 1, 60, "4ADE80", 0.35) +
          [1100, 1220, 1340, 1460, 1580].map((x, i) => pine(x, 905, 1.1 + (i % 2) * 0.3, "052E16")).join(""),
      ),
    content: () =>
      svg(
        "",
        bg("#F7FEE7") +
          leaf(1430, 40, 0.9, 30, "86EFAC", 0.8) +
          leaf(1500, 120, 0.7, 70, "4ADE80", 0.8) +
          wave(860, 16, 380, "BEF264") +
          pine(60, 888, 0.55, "15803D") +
          pine(130, 888, 0.42, "166534") +
          pine(1540, 888, 0.55, "15803D"),
      ),
  },
  {
    id: "space",
    name: "Vũ trụ",
    hint: "Bầu trời sao, hành tinh — nền tối nổi bật",
    font: "Arial",
    dark: { cover: true, section: true, content: true },
    color: { title: "FDE68A", text: "E2E8F0", muted: "A5B4FC", accent: "A78BFA", soft: "312E81", line: "818CF8", card: "1E293B" },
    cover: () =>
      svg(
        grad("sky", [[0, "0B1026"], [1, "312E81"]], 1, 1),
        bg("url(#sky)") +
          stars(1, 160, 0, 1600, 0, 900) +
          planet(1300, 330, 150, "F97316", "FDE68A") +
          planet(1480, 720, 60, "38BDF8") +
          circle(1180, 790, 46, "E2E8F0", 0.9) +
          circle(1165, 780, 10, "94A3B8", 0.7),
      ),
    section: () =>
      svg(
        grad("sky", [[0, "1E1B4B"], [1, "0B1026"]], 1, 1),
        bg("url(#sky)") + stars(2, 140, 0, 1600, 0, 900) + planet(1330, 600, 190, "8B5CF6", "C4B5FD") + planet(1500, 170, 50, "F472B6"),
      ),
    content: () =>
      svg(
        grad("sky", [[0, "0F172A"], [1, "1E1B4B"]], 1, 1),
        bg("url(#sky)") + stars(4, 70, 0, 1600, 0, 900, 0.6) + planet(1555, 868, 48, "6366F1", "A5B4FC"),
      ),
  },
  {
    id: "spring",
    name: "Hoa xuân",
    hint: "Hoa và cánh hoa bay — mềm mại, nhẹ nhàng",
    font: "Arial",
    dark: { cover: false, section: true, content: false },
    color: { title: "BE185D", text: "3F3F46", muted: "71717A", accent: "EC4899", soft: "FCE7F3", line: "F9A8D4", card: "FFFFFF" },
    cover: () =>
      svg(
        grad("p", [[0, "FFE4E6"], [1, "FDF2F8"]], 1, 1),
        bg("url(#p)") +
          `<path d="M1600 120 C 1400 160, 1260 260, 1100 420" stroke="#7C2D12" stroke-width="16" fill="none" stroke-linecap="round"/>` +
          `<path d="M1320 210 C 1300 300, 1250 340, 1200 360" stroke="#7C2D12" stroke-width="9" fill="none" stroke-linecap="round"/>` +
          flower(1450, 150, 62, "F9A8D4") +
          flower(1250, 260, 50, "F472B6") +
          flower(1120, 420, 44, "FBCFE8") +
          flower(1520, 330, 40, "F472B6") +
          flower(1200, 380, 30, "F9A8D4") +
          flower(100, 820, 56, "F9A8D4") +
          flower(220, 870, 40, "F472B6") +
          petals(7, 26, 700, 1600, 380, 880, "F472B6"),
      ),
    section: () =>
      svg(
        grad("p", [[0, "EC4899"], [1, "BE185D"]], 1, 1),
        bg("url(#p)") +
          flower(1350, 260, 120, "FFFFFF", "FDE68A", 0.28) +
          flower(1180, 640, 80, "FFFFFF", "FDE68A", 0.22) +
          flower(1500, 760, 60, "FFFFFF", "FDE68A", 0.25) +
          petals(11, 30, 0, 1600, 0, 900, "FFFFFF", 0.35),
      ),
    content: () =>
      svg(
        "",
        bg("#FFF7FB") +
          flower(1545, 860, 46, "F9A8D4") +
          flower(1465, 885, 30, "F472B6") +
          flower(50, 860, 40, "F9A8D4") +
          flower(130, 888, 24, "F472B6") +
          petals(13, 8, 1150, 1450, 820, 890, "F472B6", 0.5),
      ),
  },
  {
    id: "classic",
    name: "Trang nhã",
    hint: "Xanh navy tối giản — phù hợp mọi môn",
    font: "Arial",
    dark: { cover: true, section: true, content: false },
    color: { title: "1E3A8A", text: "1F2937", muted: "64748B", accent: "F59E0B", soft: "FEF3C7", line: "F59E0B", card: "FFFFFF" },
    cover: () =>
      svg(
        "",
        bg("#1E3A8A") + `<rect width="40" height="900" fill="#F59E0B"/>` + circle(1420, 120, 330, "2563EB", 0.45) + circle(1520, 760, 180, "3B82F6", 0.3),
      ),
    section: () => svg("", bg("#2563EB") + circle(1450, 200, 300, "1E3A8A", 0.35) + `<rect y="840" width="1600" height="60" fill="#1E3A8A"/>`),
    content: () => svg("", bg("#FFFFFF") + circle(1600, 0, 170, "DBEAFE", 0.8) + `<rect y="872" width="1600" height="28" fill="#1E3A8A"/>`),
  },
];

export const themeById = (id) => SLIDE_THEMES.find((t) => t.id === id) || SLIDE_THEMES[0];

/** Ảnh SVG dạng data URL (dùng làm ảnh xem trước trên web) */
export const svgDataUrl = (markup) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;

/* Hình minh hoạ mặc định theo môn học (khi AI không chọn emoji) */
const SUBJECT_EMOJI = [
  [/toán/i, "📐"],
  [/văn|tiếng việt/i, "📖"],
  [/anh|ngoại ngữ/i, "🔤"],
  [/lí|lý/i, "⚡"],
  [/hóa|hoá/i, "⚗️"],
  [/sinh|tự nhiên/i, "🌱"],
  [/sử/i, "🏛️"],
  [/địa/i, "🌍"],
  [/tin/i, "💻"],
  [/công dân|kinh tế|pháp luật|gdktpl|gdcd/i, "⚖️"],
  [/nhạc/i, "🎵"],
  [/mĩ thuật|mỹ thuật/i, "🎨"],
  [/thể chất|thể dục/i, "⚽"],
  [/công nghệ/i, "🔧"],
];

export function subjectEmoji(subject) {
  const hit = SUBJECT_EMOJI.find(([re]) => re.test(subject || ""));
  return hit ? hit[1] : "📘";
}
