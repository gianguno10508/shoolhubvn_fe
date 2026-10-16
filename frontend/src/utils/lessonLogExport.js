// utils/lessonLogExport.js — xuất Thứ | Buổi | Tiết | Môn | Điểm của sổ đầu bài ra Excel (mỗi file PDF 1 sheet)
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

const INDIGO = "FF4F46E5";
const ZEBRA = "FFF5F6FB";
const BORDER = { style: "thin", color: { argb: "FFD5DAE5" } };
const BOX = { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER };

const average = (list) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : null);
const numbersOf = (rows) => rows.map((r) => r.score).filter((s) => typeof s === "number");

/** Điểm TB theo từng ngày (sáng / chiều / cả ngày) và cả tuần — dùng chung cho bảng trên web và file Excel */
export function summarizeLessonLog(rows) {
  const days = [];
  const byDay = new Map();
  for (const r of rows) {
    const key = r.day || "(chưa rõ thứ)";
    if (!byDay.has(key)) {
      byDay.set(key, []);
      days.push(key);
    }
    byDay.get(key).push(r);
  }
  const bySession = (list, s) => average(numbersOf(list.filter((r) => r.session === s)));
  return {
    days: days.map((day) => {
      const list = byDay.get(day);
      return {
        day,
        morning: bySession(list, "Sáng"),
        afternoon: bySession(list, "Chiều"),
        all: average(numbersOf(list)),
        count: list.length,
      };
    }),
    morning: bySession(rows, "Sáng"),
    afternoon: bySession(rows, "Chiều"),
    all: average(numbersOf(rows)),
    scored: numbersOf(rows).length,
  };
}

/** Tên sheet: tối đa 31 ký tự, không chứa : \ / ? * [ ] và không trùng */
function sheetName(raw, used) {
  const base = (raw.replace(/\.pdf$/i, "").replace(/[:\\/?*[\]]/g, " ").trim() || "Sổ đầu bài").slice(0, 28);
  let name = base;
  for (let i = 2; used.has(name.toLowerCase()); i++) name = `${base.slice(0, 25)} (${i})`;
  used.add(name.toLowerCase());
  return name;
}

function headCell(cell, value) {
  cell.value = value;
  cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: INDIGO } };
  cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  cell.border = BOX;
}

function addSheet(wb, { name, rows }, used, schoolName) {
  const ws = wb.addWorksheet(sheetName(name, used));
  ws.columns = [
    { width: 22 }, // A Thứ
    { width: 9 }, // B Buổi
    { width: 7 }, // C Tiết
    { width: 18 }, // D Môn
    { width: 9 }, // E Điểm
    { width: 3 }, // F khoảng trống
    { width: 22 }, // G Thứ (tổng hợp)
    { width: 11 }, // H TB sáng
    { width: 11 }, // I TB chiều
    { width: 11 }, // J TB ngày
  ];

  ws.mergeCells(1, 1, 1, 10);
  const title = ws.getCell(1, 1);
  const weeks = [...new Set(rows.map((r) => r.week).filter(Boolean))];
  title.value = `SỔ ĐẦU BÀI — ĐIỂM THEO TIẾT${weeks.length ? ` · TUẦN ${weeks.join(", ")}` : ""}`;
  title.font = { bold: true, size: 14, color: { argb: "FF1E1B4B" } };
  title.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 26;

  ws.mergeCells(2, 1, 2, 10);
  const sub = ws.getCell(2, 1);
  sub.value = [schoolName, name].filter(Boolean).join(" · ");
  sub.font = { italic: true, size: 10, color: { argb: "FF64748B" } };
  sub.alignment = { horizontal: "center" };

  const head = ws.getRow(4);
  ["Thứ", "Buổi", "Tiết", "Môn học", "Điểm"].forEach((h, i) => headCell(head.getCell(i + 1), h));
  ["Thứ", "TB sáng", "TB chiều", "TB cả ngày"].forEach((h, i) => headCell(head.getCell(i + 7), h));
  head.height = 24;
  ws.views = [{ state: "frozen", ySplit: 4 }];

  // ----- Bảng chi tiết từng tiết -----
  let r = 5;
  let dayStart = 5;
  let sessionStart = 5;
  let group = 0; // tô nền xen kẽ theo từng ngày
  rows.forEach((row, i) => {
    const values = [row.day, row.session || "", row.period, row.subject || "", row.score === "" ? null : row.score];
    values.forEach((v, c) => {
      const cell = ws.getCell(r, c + 1);
      cell.value = v;
      cell.border = BOX;
      cell.alignment = { horizontal: c === 0 || c === 3 ? "left" : "center", vertical: "middle" };
      if (group % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ZEBRA } };
    });
    const next = rows[i + 1];
    const dayEnds = !next || next.day !== row.day;
    // Gộp ô Buổi cho các tiết liên tiếp cùng buổi, ô Thứ cho các tiết cùng ngày
    if (dayEnds || next.session !== row.session) {
      if (r > sessionStart) ws.mergeCells(sessionStart, 2, r, 2);
      ws.getCell(sessionStart, 2).font = { bold: true, color: { argb: row.session === "Chiều" ? "FFB45309" : "FF3730A3" } };
      sessionStart = r + 1;
    }
    if (dayEnds) {
      if (r > dayStart) ws.mergeCells(dayStart, 1, r, 1);
      ws.getCell(dayStart, 1).font = { bold: true };
      dayStart = r + 1;
      group++;
    }
    r++;
  });

  // Điểm trung bình (chỉ tính các tiết có điểm dạng số)
  const summary = summarizeLessonLog(rows);
  const totals = [
    ["TB buổi sáng", summary.morning],
    ["TB buổi chiều", summary.afternoon],
    [`TB cả tuần (${summary.scored} tiết)`, summary.all],
  ].filter(([, v]) => v !== null);
  totals.forEach(([text, value]) => {
    ws.mergeCells(r, 1, r, 4);
    const label = ws.getCell(r, 1);
    label.value = text;
    label.font = { bold: true };
    label.alignment = { horizontal: "right" };
    const cell = ws.getCell(r, 5);
    cell.value = value;
    cell.numFmt = "0.00";
    cell.font = { bold: true, color: { argb: "FF3730A3" } };
    cell.alignment = { horizontal: "center" };
    for (let c = 1; c <= 5; c++) ws.getCell(r, c).border = BOX;
    r++;
  });

  // ----- Bảng tổng hợp theo ngày (bên phải) -----
  summary.days.forEach((d, i) => {
    const rowIndex = 5 + i;
    [d.day, d.morning, d.afternoon, d.all].forEach((v, c) => {
      const cell = ws.getCell(rowIndex, c + 7);
      cell.value = v;
      cell.border = BOX;
      cell.alignment = { horizontal: c === 0 ? "left" : "center" };
      if (c > 0) cell.numFmt = "0.00";
      if (c === 0) cell.font = { bold: true };
      if (c === 3) cell.font = { bold: true, color: { argb: "FF3730A3" } };
    });
  });
}

/** @param {{ files: {name: string, rows: {week, session, day, period, subject, score}[]}[], schoolName?: string }} */
export async function exportLessonLogExcel({ files, schoolName = "" }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "SchoolHub";
  const used = new Set();
  files.forEach((f) => addSheet(wb, f, used, schoolName));
  const buffer = await wb.xlsx.writeBuffer();
  const fileName = files.length === 1 ? `So-dau-bai_${files[0].name.replace(/\.pdf$/i, "")}.xlsx` : "So-dau-bai.xlsx";
  saveAs(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), fileName);
}
