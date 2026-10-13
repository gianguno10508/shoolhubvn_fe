// utils/disciplineExport.js — xuất bảng điểm thi đua nề nếp ra Excel
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { getDisciplineSummary } from "../api/discipline";

/* Điểm ngày = điểm gốc − điểm trừ trong ngày + điểm cộng trong ngày.
 * Điểm TB  = trung bình các ngày đã chấm (ngày chưa chấm để trống, không tính). */

const WEEKDAY = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
const INDIGO = "FF4F46E5";
const HEAD_TEXT = "FFFFFFFF";
const ZEBRA = "FFF5F6FB";
const BORDER = { style: "thin", color: { argb: "FFD5DAE5" } };

const vi = (s) => s.split("-").reverse().join("/");
const ddmm = (s) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
const weekdayOf = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};
const round2 = (n) => Math.round(n * 100) / 100;
const avg = (list) => (list.length ? round2(list.reduce((a, b) => a + b, 0) / list.length) : null);
const byClassName = (a, b) => a.className.localeCompare(b.className, "vi", { numeric: true });

/** Điểm từng ngày của 1 lớp trong 1 tuần: { [date]: score } */
function dailyScores(row, columns, base) {
  const out = {};
  for (const c of columns) {
    const cell = row.cells[c.key];
    if (cell) out[c.key] = base + cell.net;
  }
  return out;
}

function styleSheet(ws, { title, subtitle, headers, widths }) {
  const last = headers.length;
  ws.mergeCells(1, 1, 1, last);
  ws.mergeCells(2, 1, 2, last);
  const t = ws.getCell(1, 1);
  t.value = title;
  t.font = { bold: true, size: 14, color: { argb: "FF1E1B4B" } };
  t.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 26;
  const st = ws.getCell(2, 1);
  st.value = subtitle;
  st.font = { italic: true, size: 10, color: { argb: "FF64748B" } };
  st.alignment = { horizontal: "center" };

  const head = ws.getRow(4);
  headers.forEach((h, i) => {
    const cell = head.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: HEAD_TEXT } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: INDIGO } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER };
  });
  head.height = 34;
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));
  ws.views = [{ state: "frozen", xSplit: 2, ySplit: 4 }];
}

function addBodyRow(ws, rowIndex, values, { avgCol }) {
  const row = ws.getRow(rowIndex);
  values.forEach((v, i) => {
    const cell = row.getCell(i + 1);
    cell.value = v ?? "";
    cell.border = { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER };
    cell.alignment = { horizontal: i === 1 || i === 2 ? "left" : "center", vertical: "middle" };
    if (rowIndex % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ZEBRA } };
    if (typeof v === "number" && !Number.isInteger(v)) cell.numFmt = "0.00";
  });
  const a = row.getCell(avgCol);
  a.font = { bold: true, color: { argb: "FF3730A3" } };
}

/** 1 sheet cho 1 tuần: Lớp | GVCN | Thứ 2 … | Điểm TB. Trả về điểm theo lớp để tổng hợp tháng. */
function addWeekSheet(wb, summary, { schoolName, sheetName }) {
  const { columns, basePoints: base } = summary;
  const ws = wb.addWorksheet(sheetName);
  const dayHeaders = columns.map((c) => `${WEEKDAY[weekdayOf(c.key)]}\n${ddmm(c.key)}`);
  const headers = ["STT", "Lớp", "GVCN", ...dayHeaders, "Điểm TB"];
  styleSheet(ws, {
    title: `BẢNG ĐIỂM THI ĐUA NỀ NẾP — TUẦN ${vi(summary.start)} – ${vi(summary.end)}`,
    subtitle: `${schoolName} · Điểm gốc mỗi ngày: ${base} · Điểm ngày = gốc − trừ + cộng · Ô trống: chưa chấm`,
    headers,
    widths: [6, 12, 24, ...columns.map(() => 11), 12],
  });

  const result = {};
  [...summary.rows].sort(byClassName).forEach((r, i) => {
    const scores = dailyScores(r, columns, base);
    const average = avg(Object.values(scores));
    result[String(r.classId)] = { className: r.className, homeroomTeacher: r.homeroomTeacher, scores };
    addBodyRow(ws, 5 + i, [i + 1, r.className, r.homeroomTeacher || "", ...columns.map((c) => scores[c.key] ?? null), average], {
      avgCol: headers.length,
    });
  });
  return result;
}

function fileSafe(s) {
  return s.replace(/[\\/:*?"<>|]/g, "-");
}

async function download(wb, name) {
  const buffer = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), name);
}

/** Xuất theo kỳ đang xem. period = "week" | "month"; summary = dữ liệu kỳ đang hiển thị */
export async function exportDisciplineExcel({ period, summary, schoolName = "" }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "SchoolHub";
  wb.created = new Date();

  if (period === "week") {
    addWeekSheet(wb, summary, { schoolName, sheetName: `Tuần ${ddmm(summary.start).replace("/", "-")}` });
    return download(wb, fileSafe(`Thi-dua_tuan_${vi(summary.start)}-${vi(summary.end)}.xlsx`));
  }

  // Tháng: mỗi tuần 1 sheet + sheet tổng hợp
  const weeks = await Promise.all(summary.columns.map((c) => getDisciplineSummary("week", c.key)));
  const month = `${summary.date.slice(5, 7)}/${summary.date.slice(0, 4)}`;
  const summarySheet = wb.addWorksheet(`Tổng hợp T${summary.date.slice(5, 7)}`);
  const perWeek = weeks.map((w, i) => addWeekSheet(wb, w, { schoolName, sheetName: `Tuần ${i + 1} (${ddmm(w.start).replace("/", "-")})` }));

  const headers = ["STT", "Lớp", "GVCN", ...weeks.map((w, i) => `Tuần ${i + 1}\n${ddmm(w.start)}–${ddmm(w.end)}`), "Điểm TB tháng"];
  styleSheet(summarySheet, {
    title: `BẢNG ĐIỂM THI ĐUA NỀ NẾP — THÁNG ${month}`,
    subtitle: `${schoolName} · Cột tuần = điểm trung bình các ngày đã chấm trong tuần · Điểm TB tháng = trung bình mọi ngày đã chấm`,
    headers,
    widths: [6, 12, 24, ...weeks.map(() => 14), 14],
  });
  [...summary.rows].sort(byClassName).forEach((r, i) => {
    const key = String(r.classId);
    const weekAvgs = perWeek.map((w) => (w[key] ? avg(Object.values(w[key].scores)) : null));
    const allDays = perWeek.flatMap((w) => (w[key] ? Object.values(w[key].scores) : []));
    addBodyRow(summarySheet, 5 + i, [i + 1, r.className, r.homeroomTeacher || "", ...weekAvgs, avg(allDays)], {
      avgCol: headers.length,
    });
  });
  return download(wb, fileSafe(`Thi-dua_thang_${month.replace("/", "-")}.xlsx`));
}
