// utils/thiDuaExport.js — ghép điểm sổ đầu bài (HT, từng tiết) với điểm nề nếp (NN, từng ngày) của các lớp
// thành bảng "ĐÁNH GIÁ THI ĐUA HỌC TẬP NỀ NẾP" giống file mẫu THI ĐUA của trường:
//   mỗi lớp 2 cột HT | NN · dòng HT|NN = trung bình từng cột · TB = trung bình (HT, NN) · HẠNG
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { dayNumber } from "./lessonLogPdf";

const average = (list) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : null);
const round2 = (v) => (v === null ? null : Math.round(v * 100) / 100);

/** "Thứ 2 (12/10/2026)" → "2026-10-12" ("" nếu không có ngày) */
export function isoFromDayLabel(day) {
  const m = String(day || "").match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/);
  if (!m) return "";
  return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

/** Ngày "YYYY-MM-DD" → thứ theo cách gọi VN (2 … 7, CN = 8) */
function weekdayOfIso(iso) {
  const d = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return d === 0 ? 8 : d + 1;
}

/** Sắp lớp như mẫu: khối lớn trước (12 → 10), trong khối theo số lớp (A1, A2, …, A10) */
function compareClass(a, b) {
  const ga = parseInt(a, 10) || 0;
  const gb = parseInt(b, 10) || 0;
  if (ga !== gb) return gb - ga;
  return a.localeCompare(b, "vi", { numeric: true });
}

/** Sổ đầu bài chấm thang 10 thì đổi sang thang 100 cho cùng thang với điểm nề nếp */
function htScale(rows) {
  const nums = rows.map((r) => r.score).filter((s) => typeof s === "number");
  return nums.length && nums.every((s) => s <= 10) ? 10 : 1;
}

/**
 * @param {{ files: {className: string, rows: {day, session, period, score}[]}[], summary?: object }} input
 *   summary: kết quả GET /discipline/summary?period=week (cột ngày + điểm từng ngày của mọi lớp)
 */
export function buildThiDua({ files, summary }) {
  const base = summary?.basePoints ?? 100;

  // ----- Các thứ trong tuần -----
  const dayInfo = new Map(); // số thứ → { day, date }
  for (const c of summary?.columns || []) dayInfo.set(weekdayOfIso(c.key), { day: weekdayOfIso(c.key), date: c.key });
  for (const f of files) {
    for (const r of f.rows) {
      const n = dayNumber(r.day);
      if (n >= 2 && n <= 8 && !dayInfo.has(n)) dayInfo.set(n, { day: n, date: isoFromDayLabel(r.day) });
    }
  }
  const days = [...dayInfo.values()].sort((a, b) => a.day - b.day);

  // ----- Số tiết mỗi buổi -----
  const allRows = files.flatMap((f) => f.rows);
  const maxPeriod = (session) =>
    Math.max(0, ...allRows.filter((r) => r.session === session).map((r) => Number(r.period) || 0));
  const morning = Math.max(5, maxPeriod("Sáng"), maxPeriod(""));
  const afternoon = allRows.some((r) => r.session === "Chiều") ? Math.max(3, maxPeriod("Chiều")) : 0;
  const slots = days.flatMap((d) => [
    ...Array.from({ length: morning }, (_, i) => ({ day: d.day, session: "Sáng", period: i + 1 })),
    ...Array.from({ length: afternoon }, (_, i) => ({ day: d.day, session: "Chiều", period: i + 1 })),
  ]);

  // ----- Lớp -----
  const classNames = new Set((summary?.rows || []).map((r) => r.className));
  files.forEach((f) => f.className && classNames.add(f.className));
  const classes = [...classNames].sort(compareClass).map((name) => {
    const ht = {}; // "thứ|buổi|tiết" → điểm
    for (const f of files.filter((x) => x.className === name)) {
      const scale = htScale(f.rows);
      for (const r of f.rows) {
        if (typeof r.score !== "number") continue;
        ht[`${dayNumber(r.day)}|${r.session || "Sáng"}|${Number(r.period)}`] = round2(r.score * scale);
      }
    }
    const nn = {}; // số thứ → điểm nề nếp của ngày (điểm gốc ± điểm cộng / trừ trong ngày)
    const sRow = (summary?.rows || []).find((r) => r.className === name);
    for (const [date, cell] of Object.entries(sRow?.cells || {})) {
      if (cell?.recorded) nn[weekdayOfIso(date)] = base + cell.net;
    }
    const htAvg = round2(average(Object.values(ht)));
    const nnAvg = round2(average(Object.values(nn)));
    const tb = round2(average([htAvg, nnAvg].filter((v) => v !== null)));
    return { name, ht, nn, htAvg, nnAvg, tb, hasLog: files.some((x) => x.className === name) };
  });

  // Hạng theo TB (bằng điểm thì cùng hạng), lớp chưa có điểm không xếp hạng
  const scored = classes.filter((c) => c.tb !== null);
  for (const c of classes) c.rank = c.tb === null ? null : 1 + scored.filter((o) => o.tb > c.tb).length;

  return { days, slots, morning, afternoon, classes, week: summary?.week ?? null, start: summary?.start, end: summary?.end };
}

/* ================= Excel ================= */

const FONT = "Times New Roman";
const THIN = { style: "thin", color: { argb: "FF000000" } };
const BOX = { top: THIN, left: THIN, bottom: THIN, right: THIN };
const HEAD_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDDEBF7" } };
const SUB_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF2CC" } };
const TOTAL_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2EFDA" } };
const DAY_NAME = { 2: "2", 3: "3", 4: "4", 5: "5", 6: "6", 7: "7", 8: "CN" };

const pad2 = (n) => String(n).padStart(2, "0");
function viRange(start, end) {
  if (!start || !end) return "";
  const [y1, m1, d1] = start.split("-");
  const [y2, m2, d2] = end.split("-");
  return `(Thực hiện từ ngày ${d1} tháng ${m1} năm ${y1} đến ngày ${d2} tháng ${m2} năm ${y2})`;
}

function style(cell, { bold = false, size = 11, color, fill, align = "center", wrap = false, italic = false } = {}) {
  cell.font = { name: FONT, size, bold, italic, ...(color ? { color: { argb: color } } : {}) };
  cell.alignment = { horizontal: align, vertical: "middle", wrapText: wrap };
  if (fill) cell.fill = fill;
}

/** Ngày kết thúc hiển thị: thứ cuối cùng có trong bảng (mẫu ghi "từ thứ 2 đến thứ 7") */
function lastDayIso(data) {
  const withDate = data.days.filter((d) => d.date);
  return withDate.length ? withDate[withDate.length - 1].date : data.end;
}

export async function exportThiDuaExcel(data, { schoolName = "", fileName } = {}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "SchoolHub";
  const sheetTitle = data.week ? `TUẦN ${pad2(data.week)}` : "THI ĐUA";
  const ws = wb.addWorksheet(sheetTitle, {
    pageSetup: { paperSize: 8, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 1, horizontalCentered: true },
  });
  const nCls = data.classes.length;
  const firstCol = 4; // D
  const lastCol = firstCol + nCls * 2 - 1;
  const L = (c) => ws.getColumn(c).letter;

  ws.getColumn(1).width = 5;
  ws.getColumn(2).width = 6.5;
  ws.getColumn(3).width = 4.5;
  for (let c = firstCol; c <= lastCol; c++) ws.getColumn(c).width = 4.6;

  // ----- Tiêu đề -----
  ws.mergeCells(1, 1, 1, Math.max(lastCol, 10));
  style(ws.getCell(1, 1), { italic: true, size: 10, color: "FF475569", align: "left" });
  ws.getCell(1, 1).value = schoolName ? schoolName.toUpperCase() : "";

  ws.mergeCells(2, 1, 2, Math.max(lastCol, 10));
  ws.getCell(2, 1).value = "BẢNG ĐÁNH GIÁ THI ĐUA HỌC TẬP NỀ NẾP";
  style(ws.getCell(2, 1), { bold: true, size: 16 });
  ws.getRow(2).height = 26;

  // Dòng 3: "LỚP VĂN HÓA" | (Thực hiện từ ngày … đến ngày …) | TUẦN HỌC xx — chia 3 khoảng không chồng nhau
  const w3 = Math.max(1, Math.floor(lastCol / 4));
  const parts3 = [
    [1, w3, "LỚP VĂN HÓA", { bold: true, size: 12, align: "left" }],
    [w3 + 1, lastCol - w3, viRange(data.start, lastDayIso(data)), { italic: true, size: 11 }],
    [lastCol - w3 + 1, lastCol, data.week ? `TUẦN HỌC ${pad2(data.week)}` : "", { bold: true, size: 12, color: "FFC00000" }],
  ];
  for (const [from, to, text, opts] of parts3) {
    if (from > to) continue;
    if (to > from) ws.mergeCells(3, from, 3, to);
    ws.getCell(3, from).value = text;
    style(ws.getCell(3, from), opts);
  }

  // ----- Đầu bảng -----
  const H1 = 5;
  const H2 = 6;
  [["Thứ", 1], ["Buổi", 2], ["Tiết", 3]].forEach(([text, c]) => {
    ws.mergeCells(H1, c, H2, c);
    ws.getCell(H1, c).value = text;
  });
  data.classes.forEach((cls, i) => {
    const c = firstCol + i * 2;
    ws.mergeCells(H1, c, H1, c + 1);
    ws.getCell(H1, c).value = cls.name;
    ws.getCell(H2, c).value = "HT";
    ws.getCell(H2, c + 1).value = "NN";
  });
  for (let c = 1; c <= lastCol; c++) {
    for (const r of [H1, H2]) {
      const cell = ws.getCell(r, c);
      style(cell, { bold: true, size: r === H1 ? 11 : 10, fill: r === H1 ? HEAD_FILL : SUB_FILL, wrap: true });
      cell.border = BOX;
    }
  }
  ws.getRow(H1).height = 22;

  // ----- Thân bảng: mỗi thứ × buổi × tiết một dòng -----
  const bodyStart = H2 + 1;
  let r = bodyStart;
  for (const d of data.days) {
    const daySlots = data.slots.filter((s) => s.day === d.day);
    const dayStart = r;
    let sessionStart = r;
    daySlots.forEach((s, i) => {
      ws.getCell(r, 3).value = s.period;
      data.classes.forEach((cls, ci) => {
        const v = cls.ht[`${s.day}|${s.session}|${s.period}`];
        if (v !== undefined) ws.getCell(r, firstCol + ci * 2).value = v;
      });
      const next = daySlots[i + 1];
      if (!next || next.session !== s.session) {
        if (r > sessionStart) ws.mergeCells(sessionStart, 2, r, 2);
        ws.getCell(sessionStart, 2).value = s.session;
        sessionStart = r + 1;
      }
      r++;
    });
    const dayEnd = r - 1;
    if (dayEnd > dayStart) ws.mergeCells(dayStart, 1, dayEnd, 1);
    ws.getCell(dayStart, 1).value = DAY_NAME[d.day] === "CN" ? "CN" : Number(DAY_NAME[d.day]);
    // NN: 1 điểm cho cả ngày — gộp dọc như mẫu
    data.classes.forEach((cls, ci) => {
      const c = firstCol + ci * 2 + 1;
      if (dayEnd > dayStart) ws.mergeCells(dayStart, c, dayEnd, c);
      if (cls.nn[d.day] !== undefined) ws.getCell(dayStart, c).value = cls.nn[d.day];
    });
    // Kẻ khung + đường đậm phân cách ngày
    for (let rr = dayStart; rr <= dayEnd; rr++) {
      for (let c = 1; c <= lastCol; c++) {
        const cell = ws.getCell(rr, c);
        const isNN = c >= firstCol && (c - firstCol) % 2 === 1;
        style(cell, { bold: c <= 2 || isNN, size: c <= 3 ? 10 : 11, color: isNN ? "FF1F4E79" : undefined });
        cell.border = { ...BOX, ...(rr === dayEnd ? { bottom: { style: "medium" } } : {}) };
      }
    }
  }
  const bodyEnd = r - 1;

  // ----- HT|NN · TB · HẠNG -----
  const AVG = r;
  const TB = r + 1;
  const RANK = r + 2;
  [["HT|NN", AVG], ["TB", TB], ["HẠNG", RANK]].forEach(([text, row]) => {
    ws.mergeCells(row, 1, row, 3);
    ws.getCell(row, 1).value = text;
  });
  const tbRange = `$${L(firstCol)}$${TB}:$${L(lastCol)}$${TB}`;
  data.classes.forEach((cls, ci) => {
    const c = firstCol + ci * 2;
    const [ht, nn] = [L(c), L(c + 1)];
    ws.getCell(AVG, c).value = { formula: `IFERROR(AVERAGE(${ht}${bodyStart}:${ht}${bodyEnd}),"")`, result: cls.htAvg ?? "" };
    ws.getCell(AVG, c + 1).value = { formula: `IFERROR(AVERAGE(${nn}${bodyStart}:${nn}${bodyEnd}),"")`, result: cls.nnAvg ?? "" };
    ws.mergeCells(TB, c, TB, c + 1);
    ws.getCell(TB, c).value = { formula: `IFERROR(AVERAGE(${ht}${AVG}:${nn}${AVG}),"")`, result: cls.tb ?? "" };
    ws.mergeCells(RANK, c, RANK, c + 1);
    ws.getCell(RANK, c).value = { formula: `IF(${ht}${TB}="","",RANK(${ht}${TB},${tbRange},0))`, result: cls.rank ?? "" };
  });
  for (const row of [AVG, TB, RANK]) {
    ws.getRow(row).height = row === AVG ? 20 : 22;
    for (let c = 1; c <= lastCol; c++) {
      const cell = ws.getCell(row, c);
      style(cell, { bold: true, size: row === AVG ? 9 : 11, fill: TOTAL_FILL, color: row === RANK && c >= firstCol ? "FFC00000" : undefined });
      cell.border = BOX;
      if (row !== RANK && c >= firstCol) cell.numFmt = "0.0";
    }
  }

  // ----- Ký tên -----
  const sign = RANK + 2;
  // Chia đều 3 khối theo chiều ngang (không chồng nhau dù trường ít lớp)
  const titles = ["TÊN CỜ ĐỎ TỔNG HỢP", "TRƯỞNG BAN\nTHI ĐUA - NỀ NẾP", "T.M BCH ĐOÀN\nBí thư"];
  const span = Math.max(1, Math.floor(lastCol / 3));
  titles.forEach((text, i) => {
    const from = 1 + i * span;
    const to = i === 2 ? Math.max(from, lastCol) : from + span - 1;
    ws.mergeCells(sign, from, sign + 1, to);
    ws.getCell(sign, from).value = text;
    style(ws.getCell(sign, from), { bold: true, size: 12, wrap: true });
  });
  ws.getRow(sign).height = 20;

  ws.views = [{ state: "frozen", xSplit: 3, ySplit: H2 }];
  const buffer = await wb.xlsx.writeBuffer();
  saveAs(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    fileName || `THI-DUA_${sheetTitle.replace(/\s+/g, "-")}.xlsx`,
  );
}
