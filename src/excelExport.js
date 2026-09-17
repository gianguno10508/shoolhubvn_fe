import ExcelJS from "exceljs";

/* ================= helpers ================= */

const ALL_DAY_LABELS = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ Nhật"];

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
function slugify(text) {
  return (
    String(text || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "thoi-khoa-bieu"
  );
}

/* tên sheet hợp lệ và không trùng nhau */
function makeSheetNamer() {
  const used = new Set();
  return (raw) => {
    const base = String(raw || "Sheet").replace(/[\\/?*[\]:]/g, "-").slice(0, 28).trim() || "Sheet";
    let name = base;
    let i = 2;
    while (used.has(name.toLowerCase())) {
      name = `${base} (${i})`;
      i += 1;
    }
    used.add(name.toLowerCase());
    return name;
  };
}

/* ================= bảng màu ================= */

const COLOR = {
  header: "FFB4C7E7",   // xanh — hàng thứ
  side: "FFF4B183",     // cam — cột buổi / tiết và ô tên
  lesson: "FFFFFFFF",   // trắng — ô có tiết
  empty: "FFFFFFFF",    // trắng — ô trống
  off: "FFE7E6E6",      // xám — lớp nghỉ
  dup: "FFFFC7CE",      // đỏ nhạt — trùng lịch giáo viên
  pinned: "FFE2EFDA",   // xanh lá nhạt — tiết cố định
};

const THIN = { style: "thin", color: { argb: "FF7F7F7F" } };
const BORDER = { top: THIN, left: THIN, bottom: THIN, right: THIN };

function styleCell(cell, { fill, bold, size, wrap } = {}) {
  if (fill) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
  cell.border = BORDER;
  cell.alignment = { vertical: "middle", horizontal: "center", wrapText: wrap !== false };
  cell.font = { name: "Times New Roman", size: size || 11, bold: !!bold };
}

/* ================= dựng một sheet dạng lưới ================= */
/**
 * getCell(day, session, tiet) -> { text, fill } | null
 */
function buildGridSheet(ws, { title, config, getCell }) {
  const days = getDays(config.soNgay);
  const sessions = getSessions(config.soBuoi);
  const tiets = getTiets(config.soTiet);

  ws.columns = [{ width: 11 }, { width: 6 }, ...days.map(() => ({ width: 20 }))];

  /* hàng 1: tên + các thứ */
  const head = ws.getRow(1);
  head.height = 22;
  ws.mergeCells(1, 1, 1, 2);
  head.getCell(1).value = title;
  styleCell(head.getCell(1), { fill: COLOR.side, bold: true });
  styleCell(head.getCell(2), { fill: COLOR.side, bold: true });
  days.forEach((d, i) => {
    head.getCell(3 + i).value = d;
    styleCell(head.getCell(3 + i), { fill: COLOR.header, bold: true });
  });

  /* các hàng tiết */
  let r = 2;
  sessions.forEach((session) => {
    const sessStart = r;
    tiets.forEach((tiet) => {
      const row = ws.getRow(r);
      row.height = 20;

      row.getCell(2).value = tiet;
      styleCell(row.getCell(2), { fill: COLOR.side, bold: true });

      days.forEach((day, i) => {
        const cell = row.getCell(3 + i);
        const info = getCell(day, session, tiet) || {};
        cell.value = info.text || null;
        styleCell(cell, { fill: info.fill || COLOR.empty, size: 10.5 });
      });
      r += 1;
    });

    /* gộp ô buổi, viền cho cả vùng gộp rồi mới ghi chữ */
    ws.mergeCells(sessStart, 1, r - 1, 1);
    for (let x = sessStart; x < r; x += 1) {
      styleCell(ws.getRow(x).getCell(1), { fill: COLOR.side, bold: true });
    }
    ws.getRow(sessStart).getCell(1).value = session;
  });

  ws.views = [{ state: "frozen", xSplit: 2, ySplit: 1 }];
  ws.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  return ws;
}

/* ================= các loại sheet ================= */

function addClassSheets(wb, ctx, sheetName) {
  const { config, classes, lessonById, effectiveSchedule } = ctx;
  classes.forEach((c) => {
    const off = new Set(c.offSlots || []);
    const ws = wb.addWorksheet(sheetName(c.name));
    buildGridSheet(ws, {
      title: c.name,
      config,
      getCell: (day, session, tiet) => {
        const slot = slotKey(day, session, tiet);
        if (off.has(slot)) return { text: "Nghỉ", fill: COLOR.off };
        const lesson = lessonById[effectiveSchedule[cellKey(day, session, tiet, c.id)]];
        if (!lesson) return null;
        return {
          text: lesson.subjectName + (lesson.teacherName ? ` - ${lesson.teacherName}` : ""),
          fill: lesson.pinnedSlot === slot ? COLOR.pinned : COLOR.lesson,
        };
      },
    });
  });
}

function addTeacherSheets(wb, ctx, sheetName) {
  const { config, classes, teachers, lessonById, effectiveSchedule } = ctx;
  const classNameById = {};
  classes.forEach((c) => { classNameById[c.id] = c.name; });

  /* gom lịch theo giáo viên + slot để phát hiện trùng */
  const byTeacherSlot = {};
  Object.entries(effectiveSchedule).forEach(([key, lessonId]) => {
    const lesson = lessonById[lessonId];
    if (!lesson || !lesson.teacherId) return;
    const [day, session, tiet, classId] = key.split("|");
    const slot = slotKey(day, session, tiet);
    const k = `${lesson.teacherId}|${slot}`;
    (byTeacherSlot[k] = byTeacherSlot[k] || []).push({
      text: `${lesson.subjectName} - ${classNameById[classId] || "?"}`,
      pinned: lesson.pinnedSlot === slot,
    });
  });

  teachers.forEach((t) => {
    const ws = wb.addWorksheet(sheetName(t.short || t.fullName));
    buildGridSheet(ws, {
      title: t.short || t.fullName,
      config,
      getCell: (day, session, tiet) => {
        const list = byTeacherSlot[`${t.id}|${slotKey(day, session, tiet)}`] || [];
        if (list.length === 0) return null;
        if (list.length > 1) return { text: list.map((x) => x.text).join(" / "), fill: COLOR.dup };
        return { text: list[0].text, fill: list[0].pinned ? COLOR.pinned : COLOR.lesson };
      },
    });
  });
}

/* Bảng tổng: hàng là tiết, cột là lớp — tiện in một trang treo bảng tin */
function addMasterSheet(wb, ctx, sheetName) {
  const { config, classes, lessonById, effectiveSchedule } = ctx;
  const days = getDays(config.soNgay);
  const sessions = getSessions(config.soBuoi);
  const tiets = getTiets(config.soTiet);
  const ws = wb.addWorksheet(sheetName("TỔNG HỢP"));

  ws.columns = [{ width: 9 }, { width: 8 }, { width: 6 }, ...classes.map(() => ({ width: 18 }))];

  const head = ws.getRow(1);
  head.height = 22;
  ["Thứ", "Buổi", "Tiết"].forEach((v, i) => {
    head.getCell(i + 1).value = v;
    styleCell(head.getCell(i + 1), { fill: COLOR.side, bold: true });
  });
  classes.forEach((c, i) => {
    head.getCell(4 + i).value = c.name;
    styleCell(head.getCell(4 + i), { fill: COLOR.header, bold: true });
  });

  let r = 2;
  days.forEach((day) => {
    const dayStart = r;
    sessions.forEach((session) => {
      const sessStart = r;
      tiets.forEach((tiet) => {
        const row = ws.getRow(r);
        row.height = 20;
        row.getCell(3).value = tiet;
        styleCell(row.getCell(3), { fill: COLOR.side });
        classes.forEach((c, i) => {
          const cell = row.getCell(4 + i);
          const slot = slotKey(day, session, tiet);
          const off = (c.offSlots || []).includes(slot);
          const lesson = lessonById[effectiveSchedule[cellKey(day, session, tiet, c.id)]];
          if (off) {
            cell.value = "Nghỉ";
            styleCell(cell, { fill: COLOR.off, size: 10 });
          } else if (lesson) {
            cell.value = lesson.subjectName + (lesson.teacherName ? ` - ${lesson.teacherName}` : "");
            styleCell(cell, { fill: lesson.pinnedSlot === slot ? COLOR.pinned : COLOR.lesson, size: 10 });
          } else {
            cell.value = null;
            styleCell(cell, { fill: COLOR.empty, size: 10 });
          }
        });
        r += 1;
      });
      ws.mergeCells(sessStart, 2, r - 1, 2);
      for (let x = sessStart; x < r; x += 1) styleCell(ws.getRow(x).getCell(2), { fill: COLOR.side, bold: true });
      ws.getRow(sessStart).getCell(2).value = session;
    });
    ws.mergeCells(dayStart, 1, r - 1, 1);
    for (let x = dayStart; x < r; x += 1) styleCell(ws.getRow(x).getCell(1), { fill: COLOR.side, bold: true });
    ws.getRow(dayStart).getCell(1).value = day;
  });

  ws.views = [{ state: "frozen", xSplit: 3, ySplit: 1 }];
  ws.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
}

/* ================= tải file ================= */

async function downloadWorkbook(wb, fileName) {
  const buffer = await wb.xlsx.writeBuffer();
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
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return fileName;
}

function buildWorkbook(config) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Xếp thời khóa biểu";
  wb.created = new Date();
  wb.title = config.tenTKB || "Thời khóa biểu";
  return wb;
}

/* ================= API dùng trong App ================= */

/** Xuất đủ bộ: bảng tổng hợp + từng lớp + từng giáo viên. Trả về Promise<tên file>. */
export async function exportTimetableToExcel({
  config,
  classes = [],
  teachers = [],
  lessonById = {},
  effectiveSchedule = {},
  fileName,
}) {
  const ctx = { config, classes, teachers, lessonById, effectiveSchedule };
  const wb = buildWorkbook(config);
  const sheetName = makeSheetNamer();

  addMasterSheet(wb, ctx, sheetName);
  addClassSheets(wb, ctx, sheetName);
  addTeacherSheets(wb, ctx, sheetName);

  return downloadWorkbook(wb, fileName || `${slugify(config.tenTKB)}.xlsx`);
}

/** Chỉ thời khóa biểu của các lớp, mỗi lớp một sheet. */
export async function exportPerClassExcel({
  config,
  classes = [],
  lessonById = {},
  effectiveSchedule = {},
  fileName,
}) {
  const wb = buildWorkbook(config);
  addClassSheets(wb, { config, classes, lessonById, effectiveSchedule }, makeSheetNamer());
  return downloadWorkbook(wb, fileName || `${slugify(config.tenTKB)}-tung-lop.xlsx`);
}

/** Chỉ thời khóa biểu của giáo viên, mỗi giáo viên một sheet. */
export async function exportPerTeacherExcel({
  config,
  classes = [],
  teachers = [],
  lessonById = {},
  effectiveSchedule = {},
  fileName,
}) {
  const wb = buildWorkbook(config);
  addTeacherSheets(wb, { config, classes, teachers, lessonById, effectiveSchedule }, makeSheetNamer());
  return downloadWorkbook(wb, fileName || `${slugify(config.tenTKB)}-giao-vien.xlsx`);
}