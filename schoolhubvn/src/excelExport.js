import ExcelJS from "exceljs";

/* =====================================================================
 * excelExport.js
 * Xuất thời khóa biểu ra file Excel gồm 3 sheet:
 *   - "TKB Tổng"  : bảng tổng hợp, mỗi cột là 1 lớp (giống bảng trong app)
 *   - "TKB GV"    : mỗi giáo viên 1 khối bảng riêng (Thứ 2..CN / Sáng-Chiều)
 *   - "TKB Lớp"   : mỗi lớp 1 khối bảng riêng (Thứ 2..CN / Sáng-Chiều)
 * ===================================================================== */

/* ---------------- helpers dùng chung (đồng bộ logic với App.jsx) ---------------- */

const ALL_DAY_LABELS = [
  "Thứ 2",
  "Thứ 3",
  "Thứ 4",
  "Thứ 5",
  "Thứ 6",
  "Thứ 7",
  "Chủ Nhật",
];

function getDays(soNgay) {
  const n = Math.min(Math.max(Number(soNgay) || 1, 1), 7);
  return ALL_DAY_LABELS.slice(0, n);
}
function getSessions(soBuoi) {
  return Number(soBuoi) === 2 ? ["Sáng", "Chiều"] : ["Cả ngày"];
}
function getTiets(soTiet) {
  const n = Math.min(Math.max(Number(soTiet) || 1, 1), 10);
  return Array.from({ length: n }, (_, i) => i + 1);
}
function slotKey(day, session, tiet) {
  return `${day}|${session}|${tiet}`;
}
function cellKey(day, session, tiet, classId) {
  return `${day}|${session}|${tiet}|${classId}`;
}

function safeSheetName(name) {
  return String(name)
    .replace(/[\\/?*[\]:]/g, "-")
    .slice(0, 31);
}

/* ---------------- màu sắc / style dùng chung ---------------- */

const FILL_ORANGE = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF4A15C" } };
const FILL_HEADER_DAY = { type: "pattern", pattern: "solid", fgColor: { argb: "FF9DB8E8" } };
const FILL_OFF = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC9CCD9" } };
const FILL_WHITE = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };

const OUTER_BORDER_STYLE = "medium";
const INNER_BORDER_STYLE = "thin";
const BORDER_COLOR = { argb: "FF000000" };

function boxBorder(style = INNER_BORDER_STYLE) {
  return {
    top: { style, color: BORDER_COLOR },
    left: { style, color: BORDER_COLOR },
    bottom: { style, color: BORDER_COLOR },
    right: { style, color: BORDER_COLOR },
  };
}

function styleCell(cell, { fill, bold, center = true, border = true, color, thickBorder = false } = {}) {
  if (fill) cell.fill = fill;
  if (border) cell.border = boxBorder(thickBorder ? OUTER_BORDER_STYLE : INNER_BORDER_STYLE);
  cell.alignment = {
    horizontal: center ? "center" : "left",
    vertical: "middle",
    wrapText: false,
  };
  cell.font = {
    bold: !!bold,
    size: 11,
    color: { argb: color || "FF000000" },
  };
}

/* Vẽ khung viền đậm bao quanh toàn bộ một vùng ô (dùng cho viền ngoài của cả bảng/khối) */
function applyOuterBorder(ws, r1, c1, r2, c2, style = OUTER_BORDER_STYLE) {
  for (let r = r1; r <= r2; r += 1) {
    for (let c = c1; c <= c2; c += 1) {
      const cell = ws.getCell(r, c);
      const b = { ...(cell.border || {}) };
      if (r === r1) b.top = { style, color: BORDER_COLOR };
      if (r === r2) b.bottom = { style, color: BORDER_COLOR };
      if (c === c1) b.left = { style, color: BORDER_COLOR };
      if (c === c2) b.right = { style, color: BORDER_COLOR };
      cell.border = b;
    }
  }
}

/* =====================================================================
 * Khối bảng dùng chung cho sheet "TKB GV" và "TKB Lớp":
 * 1 hàng tiêu đề (tên GV/lớp + Thứ 2..CN) rồi các hàng Sáng/Chiều x Tiết.
 * Trả về hàng tiếp theo còn trống trên sheet.
 * ===================================================================== */
function writeEntityBlock(ws, startRow, {
  title,
  days,
  sessions,
  tiets,
  getCellText, // (day, session, tiet) => string
  getCellOff, // (day, session, tiet) => boolean (tô xám "Nghỉ")
}) {
  const dayColStart = 3; // cột C
  const lastCol = dayColStart + days.length - 1;

  // Hàng tiêu đề: A:B merge = title, C..cuối = tên các thứ
  ws.mergeCells(startRow, 1, startRow, 2);
  const titleCell = ws.getCell(startRow, 1);
  titleCell.value = title;
  styleCell(titleCell, { fill: FILL_ORANGE, bold: true });

  days.forEach((d, i) => {
    const c = ws.getCell(startRow, dayColStart + i);
    c.value = d;
    styleCell(c, { fill: FILL_HEADER_DAY, bold: true });
  });

  let row = startRow + 1;
  sessions.forEach((session) => {
    const sessionFirstRow = row;
    tiets.forEach((tiet, ti) => {
      const r = row + ti;
      const bCell = ws.getCell(r, 2);
      bCell.value = tiet;
      styleCell(bCell, { fill: FILL_ORANGE, bold: true });

      days.forEach((d, di) => {
        const cCell = ws.getCell(r, dayColStart + di);
        const off = getCellOff ? getCellOff(d, session, tiet) : false;
        const text = off ? "Nghỉ" : getCellText(d, session, tiet) || "";
        cCell.value = text;
        styleCell(cCell, {
          fill: off ? FILL_OFF : FILL_WHITE,
          bold: false,
          center: true,
        });
      });
    });
    // merge cột "Buổi" (cột A) theo chiều dọc cho cả khối tiết
    ws.mergeCells(sessionFirstRow, 1, sessionFirstRow + tiets.length - 1, 1);
    const aCell = ws.getCell(sessionFirstRow, 1);
    aCell.value = session;
    styleCell(aCell, { fill: FILL_ORANGE, bold: true });

    row += tiets.length;
  });

  // Viền đậm bao quanh toàn bộ khối (từ hàng tiêu đề đến hàng cuối)
  applyOuterBorder(ws, startRow, 1, row - 1, lastCol);

  // 2 dòng trống giữa các khối (giống layout mẫu)
  return row + 2;
}

/* Tự động co giãn độ rộng cột theo nội dung dài nhất trong cột đó
 * (thay cho việc đặt width cố định) — mô phỏng hành vi "AutoFit Column Width". */
function autoFitColumns(ws, minWidth = 6, maxWidth = 40) {
  ws.columns.forEach((col) => {
    let max = minWidth;
    col.eachCell({ includeEmpty: false }, (cell) => {
      const value = cell.value == null ? "" : String(cell.value);
      value.split("\n").forEach((line) => {
        max = Math.max(max, line.length + 2);
      });
    });
    col.width = Math.min(max, maxWidth);
  });
}

/* ---------------- dựng index tra cứu nhanh từ effectiveSchedule ---------------- */

function buildSlotIndex(effectiveSchedule, lessonById) {
  // key: `${day}|${session}|${tiet}|${classId}` -> lesson
  const byCell = {};
  // key: `${teacherId}|${day}|${session}|${tiet}` -> [ {subjectName, className} ]
  const byTeacherSlot = {};

  Object.entries(effectiveSchedule).forEach(([key, lessonId]) => {
    const lesson = lessonById[lessonId];
    if (!lesson) return;
    const [day, session, tiet] = key.split("|");
    byCell[key] = lesson;

    if (lesson.teacherId) {
      const tKey = `${lesson.teacherId}|${day}|${session}|${tiet}`;
      (byTeacherSlot[tKey] = byTeacherSlot[tKey] || []).push(lesson);
    }
  });

  return { byCell, byTeacherSlot };
}

/* =====================================================================
 * Sheet "TKB Tổng": bảng tổng hợp, mỗi cột là 1 lớp (giống bảng trong app)
 * ===================================================================== */
function buildTongSheet(workbook, { config, classes, lessonById, effectiveSchedule }) {
  const ws = workbook.addWorksheet(safeSheetName("TKB Tổng"));
  const days = getDays(config.soNgay);
  const sessions = getSessions(config.soBuoi);
  const tiets = getTiets(config.soTiet);
  const rowsPerDay = sessions.length * tiets.length;

  // Header
  ["Thứ", "Buổi", "Tiết"].forEach((label, i) => {
    const c = ws.getCell(1, i + 1);
    c.value = label;
    styleCell(c, { fill: FILL_HEADER_DAY, bold: true });
  });
  classes.forEach((cl, i) => {
    const c = ws.getCell(1, 4 + i);
    c.value = cl.name;
    styleCell(c, { fill: FILL_HEADER_DAY, bold: true });
  });

  let row = 2;
  days.forEach((day, di) => {
    const dayFirstRow = row;
    sessions.forEach((session) => {
      const sessionFirstRow = row;
      tiets.forEach((tiet, ti) => {
        const r = row + ti;
        const tietCell = ws.getCell(r, 3);
        tietCell.value = tiet;
        styleCell(tietCell, { fill: FILL_ORANGE, bold: true });

        classes.forEach((cl, ci) => {
          const off = (cl.offSlots || []).includes(slotKey(day, session, tiet));
          const key = cellKey(day, session, tiet, cl.id);
          const lesson = lessonById[effectiveSchedule[key]];
          const text = off
            ? "Nghỉ"
            : lesson
              ? `${lesson.subjectName}${lesson.teacherName ? " - " + lesson.teacherName : ""}`
              : "";
          const cCell = ws.getCell(r, 4 + ci);
          cCell.value = text;
          styleCell(cCell, { fill: off ? FILL_OFF : FILL_WHITE });
        });
      });
      ws.mergeCells(sessionFirstRow, 2, sessionFirstRow + tiets.length - 1, 2);
      const sCell = ws.getCell(sessionFirstRow, 2);
      sCell.value = session;
      styleCell(sCell, { fill: FILL_ORANGE, bold: true });

      row += tiets.length;
    });
    ws.mergeCells(dayFirstRow, 1, dayFirstRow + rowsPerDay - 1, 1);
    const dCell = ws.getCell(dayFirstRow, 1);
    dCell.value = di === 6 ? "CN" : String(di + 2);
    styleCell(dCell, { fill: FILL_ORANGE, bold: true });
  });

  ws.views = [{ state: "frozen", xSplit: 3, ySplit: 1 }];

  applyOuterBorder(ws, 1, 1, row - 1, 3 + classes.length);
  autoFitColumns(ws);

  return ws;
}

/* =====================================================================
 * Sheet "TKB GV": mỗi giáo viên 1 khối bảng
 * ===================================================================== */
function buildGvSheet(workbook, { config, teachers, effectiveSchedule, lessonById, classes }) {
  const ws = workbook.addWorksheet(safeSheetName("TKB GV"));
  const days = getDays(config.soNgay);
  const sessions = getSessions(config.soBuoi);
  const tiets = getTiets(config.soTiet);
  const { byTeacherSlot } = buildSlotIndex(effectiveSchedule, lessonById);

  let row = 1;
  teachers.forEach((t) => {
    row = writeEntityBlock(ws, row, {
      title: t.short || t.fullName,
      days,
      sessions,
      tiets,
      getCellText: (day, session, tiet) => {
        const key = `${t.id}|${day}|${session}|${tiet}`;
        const list = byTeacherSlot[key];
        if (!list || list.length === 0) return "";
        return list
          .map((lesson) => {
            const cl = classes.find((c) => c.id === lesson.classId);
            return `${lesson.subjectName} - ${cl ? cl.name : "?"}`;
          })
          .join("; ");
      },
    });
  });

  autoFitColumns(ws);

  return ws;
}

/* =====================================================================
 * Sheet "TKB Lớp": mỗi lớp 1 khối bảng
 * ===================================================================== */
function buildLopSheet(workbook, { config, classes, effectiveSchedule, lessonById }) {
  const ws = workbook.addWorksheet(safeSheetName("TKB Lớp"));
  const days = getDays(config.soNgay);
  const sessions = getSessions(config.soBuoi);
  const tiets = getTiets(config.soTiet);

  let row = 1;
  classes.forEach((cl) => {
    const offSlots = new Set(cl.offSlots || []);
    row = writeEntityBlock(ws, row, {
      title: cl.name,
      days,
      sessions,
      tiets,
      getCellOff: (day, session, tiet) => offSlots.has(slotKey(day, session, tiet)),
      getCellText: (day, session, tiet) => {
        const key = cellKey(day, session, tiet, cl.id);
        const lesson = lessonById[effectiveSchedule[key]];
        if (!lesson) return "";
        return `${lesson.subjectName}${lesson.teacherName ? " - " + lesson.teacherName : ""}`;
      },
    });
  });

  autoFitColumns(ws);

  return ws;
}

/* ---------------- tải file xuống máy ---------------- */

async function downloadWorkbook(workbook, fileName) {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return fileName;
}

/* Chỉ loại bỏ các ký tự Windows/macOS không cho phép trong tên file,
 * giữ nguyên dấu tiếng Việt, khoảng trắng, hoa/thường như người dùng đã nhập. */
function sanitizeFileName(text) {
  return String(text || "")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function buildFileName(config, suffix) {
  const base = sanitizeFileName(config.tenTKB) || "Thời khóa biểu";
  return `${base}${suffix ? " - " + suffix : ""}.xlsx`;
}

/* =====================================================================
 * API xuất ra ngoài (giữ nguyên tên hàm để không phải sửa App.jsx)
 * ===================================================================== */

/** Xuất 1 file duy nhất gồm 3 sheet: TKB Tổng, TKB GV, TKB Lớp */
export async function exportTimetableToExcel({
  config,
  classes,
  teachers,
  lessonById,
  effectiveSchedule,
}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "TKB";
  workbook.created = new Date();

  buildTongSheet(workbook, { config, classes, lessonById, effectiveSchedule });
  buildGvSheet(workbook, { config, teachers, effectiveSchedule, lessonById, classes });
  buildLopSheet(workbook, { config, classes, effectiveSchedule, lessonById });

  return downloadWorkbook(workbook, buildFileName(config));
}

/** Xuất riêng file chỉ có sheet "TKB Lớp" (mỗi lớp 1 khối bảng) */
export async function exportPerClassExcel({
  config,
  classes,
  lessonById,
  effectiveSchedule,
}) {
  const workbook = new ExcelJS.Workbook();
  buildLopSheet(workbook, { config, classes, effectiveSchedule, lessonById });
  return downloadWorkbook(workbook, buildFileName(config, "theo-lop"));
}

/** Xuất riêng file chỉ có sheet "TKB GV" (mỗi giáo viên 1 khối bảng) */
export async function exportPerTeacherExcel({
  config,
  classes,
  teachers,
  lessonById,
  effectiveSchedule,
}) {
  const workbook = new ExcelJS.Workbook();
  buildGvSheet(workbook, { config, teachers, effectiveSchedule, lessonById, classes });
  return downloadWorkbook(workbook, buildFileName(config, "theo-gv"));
}