// pages/teacher/namePicker/pickerUtils.js — tiện ích chung cho trang Gọi tên ngẫu nhiên
import { useCallback, useEffect, useRef } from "react";

/** Số ngẫu nhiên đều trong [0, n) — dùng crypto để công bằng hơn Math.random */
export function randomInt(n) {
  if (n <= 1) return 0;
  try {
    const buf = new Uint32Array(1);
    const limit = Math.floor(0x100000000 / n) * n;
    do crypto.getRandomValues(buf);
    while (buf[0] >= limit);
    return buf[0] % n;
  } catch {
    return Math.floor(Math.random() * n);
  }
}

export const randomBetween = (min, max) => min + Math.random() * (max - min);

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const pickOne = (arr) => arr[randomInt(arr.length)];

export const PALETTE = [
  "#ef4444", "#f97316", "#f59e0b", "#84cc16", "#22c55e", "#14b8a6",
  "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6", "#d946ef", "#ec4899",
];

export const colorOf = (i) => PALETTE[i % PALETTE.length];

/** Tên ngắn để vẽ trong ô nhỏ: "Nguyễn Thị Minh Anh" → "Minh Anh" */
export function shortName(name, max = 14) {
  if (name.length <= max) return name;
  const words = name.split(/\s+/);
  const two = words.slice(-2).join(" ");
  return two.length <= max ? two : words[words.length - 1];
}

/* ---------- Nhập danh sách ---------- */

const STT_PREFIX = /^\s*\d+\s*[.)\-:]?\s+/;

function cleanCell(cell) {
  return String(cell ?? "").replace(/\s+/g, " ").trim();
}

/** Mỗi dòng 1 học sinh. Bỏ số thứ tự đầu dòng; dòng dán từ Excel (có tab) thì lấy ô chữ dài nhất. */
export function parseNames(text) {
  return text
    .split(/\r?\n/)
    .map((line) => {
      if (line.includes("\t")) {
        const cells = line.split("\t").map(cleanCell).filter((c) => c && !/^\d+$/.test(c));
        return cells.sort((a, b) => b.length - a.length)[0] || "";
      }
      return cleanCell(line.replace(STT_PREFIX, ""));
    })
    .filter(Boolean);
}

/** Đọc cột họ tên từ file Excel / CSV (dòng đầu là tiêu đề nếu có chữ "tên") */
export async function readNamesFromSheet(file) {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const rows = XLSX.utils
    .sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" })
    .map((r) => r.map(cleanCell));
  if (!rows.length) return [];

  const headerIdx = rows.findIndex((r) => r.some((c) => /tên/i.test(c)));
  if (headerIdx >= 0) {
    const header = rows[headerIdx].map((c) => c.toLowerCase());
    const fullCol = header.findIndex((c) => /họ.*tên|họ và tên|tên học sinh|họ tên/.test(c));
    const lastCol = header.findIndex((c) => c === "tên");
    const firstCol = header.findIndex((c) => /^họ( và)?( tên)? đệm$|^họ đệm$|^họ$/.test(c));
    const body = rows.slice(headerIdx + 1);
    if (fullCol >= 0 && lastCol < 0) return body.map((r) => r[fullCol]).filter(Boolean);
    if (lastCol >= 0) {
      return body
        .map((r) => cleanCell(`${firstCol >= 0 ? r[firstCol] : ""} ${r[lastCol]}`))
        .filter(Boolean);
    }
  }

  // Không có tiêu đề rõ ràng: lấy cột có nhiều ô chữ (không phải số) nhất
  const width = Math.max(...rows.map((r) => r.length));
  let best = 0;
  let bestCount = -1;
  for (let c = 0; c < width; c++) {
    const count = rows.filter((r) => r[c] && !/^[\d./-]+$/.test(r[c])).length;
    if (count > bestCount) [best, bestCount] = [c, count];
  }
  return rows.map((r) => r[best]).filter((c) => c && !/^[\d./-]+$/.test(c) && !/tên/i.test(c));
}

/* ---------- Lưu danh sách trên trình duyệt ---------- */

const STORE_KEY = "np_lists_v1";

export function loadStore() {
  try {
    const data = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
    if (data && Array.isArray(data.lists)) return data;
  } catch {
    /* bỏ qua */
  }
  return { lists: [], activeId: null };
}

export function saveStore(store) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    /* bỏ qua */
  }
}

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/* ---------- Hook hẹn giờ / khung hình, tự dọn khi trò chơi bị đóng ---------- */

export function useTimers() {
  const timers = useRef(new Set());
  const frames = useRef(new Set());

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      frames.current.forEach(cancelAnimationFrame);
    },
    [],
  );

  const later = useCallback((fn, ms) => {
    const id = setTimeout(() => {
      timers.current.delete(id);
      fn();
    }, ms);
    timers.current.add(id);
    return id;
  }, []);

  /** Chạy step(tiến độ 0..1, ms đã trôi) mỗi khung hình trong `duration` ms, xong gọi done() */
  const animate = useCallback((duration, step, done) => {
    const start = performance.now();
    const tick = (now) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      step(t, elapsed);
      if (t < 1) {
        const id = requestAnimationFrame((n) => {
          frames.current.delete(id);
          tick(n);
        });
        frames.current.add(id);
      } else if (done) done();
    };
    tick(start);
  }, []);

  /** Vòng lặp khung hình không giới hạn; trả hàm dừng */
  const loop = useCallback((step) => {
    let id;
    let last = performance.now();
    let stopped = false;
    const tick = (now) => {
      if (stopped) return;
      step(Math.min(50, now - last));
      last = now;
      id = requestAnimationFrame(tick);
      frames.current.add(id);
    };
    id = requestAnimationFrame(tick);
    frames.current.add(id);
    return () => {
      stopped = true;
      cancelAnimationFrame(id);
    };
  }, []);

  return { later, animate, loop };
}

export const easeOutCubic = (t) => 1 - (1 - t) ** 3;
export const easeOutQuart = (t) => 1 - (1 - t) ** 4;
export const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
