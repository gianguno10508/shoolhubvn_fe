// utils/lessonLogPdf.js — đọc Sổ đầu bài từ file PDF (dạng bảng có chữ, không phải ảnh scan)
/* Hỗ trợ 2 kiểu trình bày:
 *  1. Một trang đủ cột: Thứ | Tiết | Môn | HS nghỉ | Nội dung | Điểm
 *  2. Sổ in 2 trang đối diện (mẫu Bộ GD): trang trái Thứ | Tiết | Môn học | Tiết PPCT | HS nghỉ | Đầu bài,
 *     trang phải Nhận xét | Xếp loại tiết học (Cộng | XL) | Ký tên — các dòng thẳng hàng theo chiều dọc.
 * Mỗi trang trái có tiêu đề "TUẦN 3 : BUỔI SÁNG / BUỔI CHIỀU" → lấy được tuần + buổi của từng tiết.
 * Cách đọc: mỗi số trong cột Tiết là 1 dòng; Môn / Điểm lấy theo dải dọc của dòng đó;
 * Thứ là ô gộp nhiều tiết nên gán theo nhóm tiết (số tiết quay về 1 là sang ngày mới). */
import { openPdf } from "./pdfQuestions";

const norm = (s) => s.normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();
const isNumber = (t) => /^\(?\d{1,2}\)?$/.test(t);

// \b của JS không hiểu chữ có dấu nên dùng (?!\p{L}) để kiểm tra hết từ
const IS_PERIOD_HEAD = (t) => /^tiết(?!\p{L})/u.test(t) && !/ppct|phân phối/.test(t);
const IS_SCORE_MAIN = (t) => /^(cộng|tổng|điểm|tổng điểm)(?!\p{L})/u.test(t) && t.length < 20;
const IS_SCORE_GROUP = (t) => /xếp loại|^xl$/.test(t);
const IS_SUBJECT_HEAD = (t) => /^môn/.test(t);

const DAY_WORDS = { hai: 2, ba: 3, tư: 4, tu: 4, năm: 5, nam: 5, sáu: 6, sau: 6, bảy: 7, bay: 7 };
export const SESSIONS = ["Sáng", "Chiều", "Tối"];

/** Toạ độ tâm của 1 đoạn chữ (hỗ trợ chữ xoay dọc trong ô Thứ) */
function toItem(it) {
  const [a, b, , , x, y] = it.transform;
  const rotated = Math.abs(b) > Math.abs(a);
  const w = it.width || 0;
  return {
    text: (it.str || "").replace(/ /g, " ").trim(),
    cx: rotated ? x : x + w / 2,
    cy: rotated ? y + (Math.sign(b) * w) / 2 : y + (it.height || 8) / 3,
    x0: rotated ? x - 4 : x,
    x1: rotated ? x + 4 : x + w,
  };
}

const overlapX = (a, b, pad = 2) => a.x0 <= b.x1 + pad && b.x0 <= a.x1 + pad;

/** Các ô tiêu đề cùng dải dọc với ô mốc (tiêu đề có thể xuống 2–3 dòng), bỏ hàng đánh số cột */
function headerBand(items, anchor, range = 16) {
  return items.filter((i) => Math.abs(i.cy - anchor.cy) <= range && !isNumber(i.text));
}

/** Ô tiêu đề bảng nằm gần đầu trang: phía trên nó chỉ có vài dòng (tên tuần, tên trường…) */
const nearTop = (items, head) => items.filter((i) => i.cy > head.cy + 20).length < 8;

/** Đỉnh vùng dữ liệu: ngay dưới tiêu đề, bỏ qua hàng đánh số cột (1) (2) (3)… nếu có */
function bodyTopBelow(items, band) {
  let top = Math.min(...band.map((i) => i.cy)) - 3;
  const below = items.filter((i) => i.cy < top).sort((a, b) => b.cy - a.cy);
  if (below.length) {
    const y = below[0].cy;
    const row = below.filter((i) => Math.abs(i.cy - y) < 3);
    if (row.length >= 3 && row.every((i) => isNumber(i.text))) top = y - 3;
  }
  return top;
}

/** Cột "Tiết" (số thứ tự tiết trong buổi) — bỏ qua cột "Tiết theo PPCT" */
function findPeriodColumn(items) {
  const heads = items.filter((i) => IS_PERIOD_HEAD(norm(i.text))).sort((a, b) => a.x0 - b.x0);
  for (const head of heads) {
    const band = headerBand(items, head);
    if (band.length < 3 || !nearTop(items, head)) continue; // chữ "Tiết" lẻ trong nội dung bài
    if (band.some((i) => i !== head && overlapX(i, head) && /ppct|phân phối/.test(norm(i.text)))) continue;

    const half = Math.max(8, (head.x1 - head.x0) / 2 + 4);
    const col = { left: head.cx - half, right: head.cx + half };

    // Cột Môn học: từ mép phải cột Tiết đến giữa ô Môn và ô tiêu đề kế tiếp
    let subject = null;
    const mon = band.find((i) => IS_SUBJECT_HEAD(norm(i.text)) && i.cx > head.cx);
    if (mon) {
      const next = band.filter((i) => i.cx > mon.cx + 10).sort((a, b) => a.cx - b.cx)[0];
      subject = { left: col.right - 2, right: next ? (mon.cx + next.cx) / 2 : mon.x1 + 40 };
    }
    return { head, col, subject, day: { left: -Infinity, right: head.x0 - 1 }, bodyTop: bodyTopBelow(items, band) };
  }
  return null;
}

/** Cột điểm: ưu tiên ô "Cộng" / "Điểm"; nếu chỉ có "Xếp loại" thì lấy cả ô đó */
function findScoreColumn(items) {
  const isHeader = (i) => headerBand(items, i).length >= 3 && nearTop(items, i);
  const group = items.find((i) => IS_SCORE_GROUP(norm(i.text)) && norm(i.text).length < 30 && isHeader(i));
  // "Cộng" nằm ngay dưới "Xếp loại tiết học" thì chắc chắn là cột điểm; ở chỗ khác phải giống ô tiêu đề
  const underGroup = (i) => group && overlapX(i, group, 6) && i.cy < group.cy && group.cy - i.cy < 30;
  const head = items.find((i) => IS_SCORE_MAIN(norm(i.text)) && (underGroup(i) || isHeader(i))) || group;
  if (!head) return null;

  // Ô "Cộng" ở hàng tiêu đề phụ: tiêu đề chỉ kéo lên phía trên, không lấn xuống dòng dữ liệu đầu tiên
  const band = underGroup(head)
    ? items.filter((i) => i.cy >= head.cy - 4 && i.cy <= group.cy + 16 && !isNumber(i.text))
    : headerBand(items, head);
  let left = head.x0 - 10;
  let right = head.x1 + 10;
  for (const n of items) {
    if (n === head || Math.abs(n.cy - head.cy) > 3) continue;
    if (n.x0 >= head.x1) right = Math.min(right, (head.x1 + n.x0) / 2);
    if (n.x1 <= head.x0) left = Math.max(left, (n.x1 + head.x0) / 2);
  }
  return { col: { left, right }, bodyTop: bodyTopBelow(items, band) };
}

const inCol = (item, col) => item.cx > col.left && item.cx <= col.right;

/** "Hai 12/10/2026" → "Thứ 2 (12/10/2026)" ; không nhận ra thì giữ nguyên chữ */
export function normalizeDay(raw) {
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text) return "";
  const t = norm(text);
  const date = text.match(/\d{1,2}\s*[/\-.]\s*\d{1,2}(\s*[/\-.]\s*\d{2,4})?/)?.[0].replace(/\s/g, "");
  let day = null;
  if (/chủ nhật|^cn\b/.test(t)) day = "Chủ nhật";
  else {
    const m = t.match(/(?<!\p{L})(hai|ba|tư|tu|năm|nam|sáu|sau|bảy|bay)(?!\p{L})/u) || t.match(/thứ\s*([2-7])/);
    if (m) day = `Thứ ${DAY_WORDS[m[1]] || m[1]}`;
    else if (/^[2-7]$/.test(t)) day = `Thứ ${t}`;
  }
  if (!day) return text;
  return date ? `${day} (${date})` : day;
}

/** "Thứ 3 (22/09/2026)" → 3 ; "Chủ nhật" → 8 ; không rõ → 99 */
export function dayNumber(day) {
  const t = norm(day || "");
  if (/chủ nhật/.test(t)) return 8;
  const m = t.match(/thứ\s*([2-7])/);
  return m ? Number(m[1]) : 99;
}

/** "Sáng" / "Chiều" / "Tối" từ chữ bất kỳ, không nhận ra → "" */
export function normalizeSession(raw) {
  const t = norm(raw || "");
  if (/sáng|^s$/.test(t)) return "Sáng";
  if (/chiều|^c$/.test(t)) return "Chiều";
  if (/tối|^t$/.test(t)) return "Tối";
  return "";
}

/** "8,5" → 8.5 ; chữ (Tốt / A …) giữ nguyên */
export function normalizeScore(raw) {
  const text = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (/^\d+([.,]\d+)?$/.test(text)) return Number(text.replace(",", "."));
  return text;
}

function median(list) {
  if (!list.length) return 0;
  const s = [...list].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

const SESSION_ORDER = { Sáng: 0, Chiều: 1, Tối: 2, "": 3 };

/** Sắp xếp: tuần → thứ → buổi (sáng trước chiều) → tiết */
export function sortLessonRows(rows) {
  return rows
    .map((r, i) => ({ r, i }))
    .sort(
      (a, b) =>
        (a.r.week || 0) - (b.r.week || 0) ||
        dayNumber(a.r.day) - dayNumber(b.r.day) ||
        (SESSION_ORDER[a.r.session] ?? 3) - (SESSION_ORDER[b.r.session] ?? 3) ||
        (Number(a.r.period) || 0) - (Number(b.r.period) || 0) ||
        a.i - b.i,
    )
    .map((x) => x.r);
}

/**
 * Phân tích sổ đầu bài từ danh sách chữ của từng trang (đã qua toItem).
 * Tách riêng để kiểm thử được mà không cần pdf.js.
 * @param {{text,cx,cy,x0,x1}[][]} pages
 */
export function parseLessonLogPages(pages) {
  const groups = []; // { week, session, day, rows: [{ period, top, bottom, subject, score }] }
  let pending = []; // nhóm của trang trái đang chờ trang điểm bên phải
  let lastDay = "";
  let lastPeriod = Infinity;
  let anyTable = false;
  let anyScoreCol = false;

  const textInBand = (items, col, row) =>
    items
      .filter((i) => inCol(i, col) && i.cy <= row.top && i.cy > row.bottom)
      .sort((x, y) => y.cy - x.cy || x.x0 - y.x0)
      .map((i) => i.text)
      .join(" ")
      .trim();

  for (const items of pages) {
    const pageText = norm(items.map((i) => i.text).join(" "));
    const periodCol = findPeriodColumn(items);
    const scoreCol = findScoreColumn(items);

    // Trang chỉ có cột điểm: gán điểm cho các dòng của trang trái liền trước (cùng toạ độ dọc)
    if (!periodCol) {
      if (scoreCol && pending.length) {
        anyScoreCol = true;
        const body = items.filter((i) => i.cy < scoreCol.bodyTop);
        pending.forEach((g) => g.rows.forEach((r) => (r.score = textInBand(body, scoreCol.col, r))));
        pending = [];
      }
      continue;
    }

    anyTable = true;
    const week = Number(pageText.match(/tuần\s*(\d{1,2})(?!\d)/)?.[1]) || null;
    const session = normalizeSession(pageText.match(/buổi\s*(sáng|chiều|tối)/)?.[1] || "");
    const body = items.filter((i) => i.cy < periodCol.bodyTop);

    const anchors = body
      .filter((i) => inCol(i, periodCol.col) && /^\d{1,2}$/.test(i.text))
      .map((i) => ({ period: Number(i.text), y: i.cy }))
      .sort((a, b) => b.y - a.y);
    if (!anchors.length) continue;

    // Dải dọc của từng dòng: giữa 2 số tiết liền kề
    const gap = median(anchors.slice(1).map((a, i) => anchors[i].y - a.y)) || 30;
    anchors.forEach((a, i) => {
      a.top = i === 0 ? Math.min(periodCol.bodyTop, a.y + gap / 2) : (anchors[i - 1].y + a.y) / 2;
      a.bottom = i === anchors.length - 1 ? a.y - gap / 2 : (a.y + anchors[i + 1].y) / 2;
    });

    // Nhóm các tiết thành từng ngày: số tiết không tăng nữa → sang nhóm mới.
    // Trang có tiêu đề buổi riêng thì luôn bắt đầu nhóm mới.
    const pageGroups = [];
    anchors.forEach((a, i) => {
      const prev = i === 0 ? (session ? Infinity : lastPeriod) : anchors[i - 1].period;
      if (!pageGroups.length || a.period <= prev) pageGroups.push([]);
      pageGroups[pageGroups.length - 1].push(a);
    });
    const prevPagePeriod = session ? Infinity : lastPeriod;
    lastPeriod = anchors[anchors.length - 1].period;

    // Chữ trong cột Thứ, gom theo khoảng cách dọc thành từng ô
    const dayItems = body.filter((i) => inCol(i, periodCol.day)).sort((a, b) => b.cy - a.cy);
    const dayCells = [];
    for (const i of dayItems) {
      const last = dayCells[dayCells.length - 1];
      if (last && last.minY - i.cy < gap * 0.9) {
        last.parts.push(i.text);
        last.minY = i.cy;
      } else {
        dayCells.push({ parts: [i.text], maxY: i.cy, minY: i.cy });
      }
    }
    dayCells.forEach((c) => (c.y = (c.maxY + c.minY) / 2));

    const created = pageGroups.map((group, gi) => {
      const top = group[0].top;
      const bottom = group[group.length - 1].bottom;
      const mid = (top + bottom) / 2;
      let cell = dayCells.find((c) => c.y <= top && c.y >= bottom);
      // Nhóm đầu trang nối tiếp ngày của trang trước → giữ thứ cũ.
      // Ô Thứ gộp cả buổi sáng + chiều (tiết đánh số lại từ 1) → lấy ô gần nhất trên cùng trang.
      const continues = gi === 0 && group[0].period > prevPagePeriod;
      if (!cell && dayCells.length && !continues) {
        cell = dayCells.reduce((best, c) => (Math.abs(c.y - mid) < Math.abs(best.y - mid) ? c : best));
      }
      const day = cell ? normalizeDay(cell.parts.join(" ")) : lastDay;
      lastDay = day;

      return {
        week,
        session,
        day,
        rows: group.map((a) => ({
          period: a.period,
          top: a.top,
          bottom: a.bottom,
          subject: periodCol.subject ? textInBand(body, periodCol.subject, a) : "",
          score: scoreCol ? textInBand(items.filter((i) => i.cy < scoreCol.bodyTop), scoreCol.col, a) : "",
        })),
      };
    });
    groups.push(...created);
    if (scoreCol) anyScoreCol = true;
    pending = scoreCol ? [] : created;
  }

  // Không có tiêu đề buổi: ngày xuất hiện 2 lần liên tiếp (tiết đánh số lại) → lần 1 sáng, lần 2 chiều
  groups.forEach((g, i) => {
    const prev = groups[i - 1];
    if (!g.session && prev && prev.day && prev.day === g.day) {
      prev.session = prev.session || "Sáng";
      g.session = "Chiều";
    }
  });

  const hasSubjects = groups.some((g) => g.rows.some((r) => r.subject));
  const rows = [];
  for (const g of groups) {
    for (const r of g.rows) {
      // Bỏ tiết trống (không có môn, không có điểm)
      if (hasSubjects && !r.subject && r.score === "") continue;
      rows.push({
        week: g.week,
        session: g.session,
        day: g.day,
        period: r.period,
        subject: r.subject,
        score: normalizeScore(r.score),
      });
    }
  }
  return { rows: sortLessonRows(rows), anyTable, anyScoreCol };
}

/** Tên lớp trong chữ: "Lớp: 12A1", "lop 10a10", "SĐB_11A2.pdf" → "12A1" … ("" nếu không thấy) */
export function detectClassName(text) {
  const t = String(text || "");
  const m =
    t.match(/l[ớo]p\s*:?\s*(1[0-2]|[1-9])\s*([a-zđ])\s*(\d{0,2})(?![\d\p{L}])/iu) ||
    t.match(/(?<![\d\p{L}])(1[0-2]|[6-9])\s*([a-z])\s*(\d{1,2})(?![\d\p{L}])/iu);
  return m ? `${m[1]}${m[2].toUpperCase()}${m[3]}` : "";
}

/**
 * Đọc file PDF sổ đầu bài.
 * @returns {Promise<{ rows: {week, session, day, period, subject, score}[], warnings: string[], className: string }>}
 */
export async function readLessonLog(file) {
  if (!file) throw new Error("Chưa chọn file.");
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    throw new Error("Vui lòng chọn file PDF.");
  }

  const pdf = await openPdf(file);
  const pages = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    pages.push(content.items.map(toItem).filter((i) => i.text));
  }

  if (!pages.some((p) => p.length)) {
    throw new Error("File PDF không có lớp chữ (có thể là ảnh scan) nên không đọc được.");
  }
  const { rows, anyTable, anyScoreCol } = parseLessonLogPages(pages);
  if (!anyTable) throw new Error("Không tìm thấy bảng có cột “Tiết” trong file PDF.");
  if (!rows.length) throw new Error("Không tìm thấy tiết học nào trong bảng.");

  const warnings = [];
  if (!anyScoreCol) warnings.push("không tìm thấy cột Điểm / Xếp loại");
  const missingDay = rows.filter((r) => !r.day).length;
  const missingScore = rows.filter((r) => r.score === "").length;
  if (missingDay) warnings.push(`${missingDay} tiết chưa xác định được thứ`);
  if (missingScore && anyScoreCol) warnings.push(`${missingScore} tiết chưa có điểm`);

  const pageText = pages.map((p) => p.map((i) => i.text).join(" ")).join(" ");
  // Ưu tiên "Lớp: 12A1" trong nội dung, không có thì lấy từ tên file
  const className =
    (pageText.match(/l[ớo]p\s*:?\s*(1[0-2]|[1-9])\s*[a-zđ]\s*\d{0,2}(?![\d\p{L}])/iu) && detectClassName(pageText)) ||
    detectClassName(file.name.replace(/\.pdf$/i, ""));
  return { rows, warnings, className };
}

export { toItem as _toItem };
