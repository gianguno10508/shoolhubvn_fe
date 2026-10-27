// pages/teacher/aiExam/aiExamDocx.js — xuất đề AI ra Word: ma trận + bản đặc tả (khổ ngang), đề + đáp án (khổ dọc)
import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  PageOrientation,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";
import { saveAs } from "file-saver";
import { buildMatrix, chapterSpans, fmtPoint, LETTERS, LEVEL_KEYS, LEVEL_LABEL, LEVEL_SHORT, levelPercents, TF_LABELS } from "./examMatrix";

const FONT = "Times New Roman";
const SIZE = 26; // 13pt
const SMALL = 22; // 11pt cho bảng ma trận

const border = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
const borders = { top: border, bottom: border, left: border, right: border };
const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

const run = (text, opts = {}) => new TextRun({ text, font: FONT, size: opts.size || SIZE, bold: opts.bold, italics: opts.italics, color: "000000" });

/** Đoạn văn; \n trong text tách thành nhiều đoạn */
function paras(text, opts = {}) {
  return String(text ?? "")
    .split("\n")
    .map(
      (line) =>
        new Paragraph({
          alignment: opts.align,
          spacing: { after: opts.after ?? 60 },
          indent: opts.indent ? { left: opts.indent } : undefined,
          children: [...(opts.prefix ? [run(opts.prefix, { bold: true, size: opts.size })] : []), run(line, opts)],
        }),
    );
}

function cell(text, opts = {}) {
  return new TableCell({
    borders: opts.noBorder ? noBorders : borders,
    columnSpan: opts.colSpan,
    rowSpan: opts.rowSpan,
    verticalAlign: VerticalAlign.CENTER,
    shading: opts.fill ? { fill: opts.fill } : undefined,
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    margins: { top: 40, bottom: 40, left: 70, right: 70 },
    children: paras(text === 0 ? "" : text, { align: opts.align ?? AlignmentType.CENTER, bold: opts.bold, size: opts.size || SMALL, after: 0 }),
  });
}

const title = (text, size = 28) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [run(text, { bold: true, size })] });

/* ---------------- Ma trận ---------------- */

function matrixTable(exam, m) {
  const { parts } = m;
  const hdr = { bold: true, fill: "EDEDED" };
  const head1 = [
    cell("TT", { ...hdr, rowSpan: 3 }),
    cell("Chương / Chủ đề", { ...hdr, rowSpan: 3 }),
    cell("Nội dung / Đơn vị kiến thức", { ...hdr, rowSpan: 3 }),
    cell("Mức độ đánh giá", { ...hdr, colSpan: parts.length * 4 }),
    cell("Tổng", { ...hdr, colSpan: 2, rowSpan: 2 }),
  ];
  const head2 = parts.map((p) => cell(`${p.label} (số ${p.unit})`, { ...hdr, colSpan: 4 }));
  const head3 = [...parts.flatMap(() => LEVEL_KEYS.map((k) => cell(LEVEL_SHORT[k], hdr))), cell("Số câu/ý", hdr), cell("Tỉ lệ % điểm", hdr)];

  const spans = chapterSpans(m.rows);
  const body = m.rows.map((r, i) => {
    const cells = [cell(String(i + 1))];
    if (spans[i]) cells.push(cell(r.chapter || "", { rowSpan: spans[i], align: AlignmentType.LEFT }));
    cells.push(cell(r.lesson, { align: AlignmentType.LEFT }));
    for (const p of parts) for (const k of LEVEL_KEYS) cells.push(cell(r.cells[p.key][k] || ""));
    cells.push(cell(String(r.total)), cell(`${fmtPoint(r.points * 10)}%`));
    return new TableRow({ children: cells });
  });

  const t = m.totals;
  const percents = levelPercents(m.levelPoints);
  const totalRow = new TableRow({
    children: [
      cell("Tổng số câu / ý", { bold: true, colSpan: 3 }),
      ...parts.flatMap((p) => LEVEL_KEYS.map((k) => cell(t.cells[p.key][k] || "", { bold: true }))),
      cell(String(t.total), { bold: true }),
      cell(`${fmtPoint(t.points * 10)}%`, { bold: true }),
    ],
  });
  const partPoints = (key) => {
    const pts = { mc: (exam.config.mcPoints || 0.25) * exam.mcQuestions.length, tf: exam.tfQuestions.length, essay: exam.essayQuestions.reduce((s, q) => s + q.points, 0) };
    return pts[key];
  };
  const pointRow = new TableRow({
    children: [
      cell("Tổng điểm từng phần", { bold: true, colSpan: 3 }),
      ...parts.map((p) => cell(`${fmtPoint(partPoints(p.key))} điểm`, { bold: true, colSpan: 4 })),
      cell("10 điểm", { bold: true, colSpan: 2 }),
    ],
  });
  const levelRow = new TableRow({
    children: [
      cell("Tỉ lệ % điểm theo mức độ", { bold: true, colSpan: 3 }),
      cell(LEVEL_KEYS.map((k) => `${LEVEL_LABEL[k]}: ${fmtPoint(percents[k])}%`).join("   ·   "), { bold: true, colSpan: parts.length * 4 + 2 }),
    ],
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ tableHeader: true, children: head1 }),
      new TableRow({ tableHeader: true, children: head2 }),
      new TableRow({ tableHeader: true, children: head3 }),
      ...body,
      totalRow,
      pointRow,
      levelRow,
    ],
  });
}

/* ---------------- Bản đặc tả ---------------- */

function specTable(exam, m) {
  const hdr = { bold: true, fill: "EDEDED" };
  const { parts } = m;
  const rows = [
    new TableRow({
      tableHeader: true,
      children: [
        cell("TT", { ...hdr, rowSpan: 2 }),
        cell("Chương / Chủ đề", { ...hdr, rowSpan: 2 }),
        cell("Nội dung", { ...hdr, rowSpan: 2 }),
        cell("Mức độ", { ...hdr, rowSpan: 2 }),
        cell("Yêu cầu cần đạt", { ...hdr, rowSpan: 2, width: 36 }),
        cell("Câu hỏi theo dạng", { ...hdr, colSpan: parts.length }),
      ],
    }),
    new TableRow({ tableHeader: true, children: parts.map((p) => cell(p.label, hdr)) }),
  ];

  m.rows.forEach((r, i) => {
    const spec = exam.specification.find((s) => s.lesson === i);
    const levels = LEVEL_KEYS.filter((k) => spec?.requirements?.[k] || parts.some((p) => r.refs[p.key][k].length));
    if (!levels.length) return;
    levels.forEach((k, j) => {
      const cells = [];
      if (j === 0) {
        cells.push(
          cell(String(i + 1), { rowSpan: levels.length }),
          cell(r.chapter || "", { rowSpan: levels.length, align: AlignmentType.LEFT }),
          cell(r.lesson, { rowSpan: levels.length, align: AlignmentType.LEFT }),
        );
      }
      cells.push(
        cell(LEVEL_LABEL[k], { bold: true }),
        cell(spec?.requirements?.[k] || "", { align: AlignmentType.LEFT }),
        ...parts.map((p) => cell(r.refs[p.key][k].join(", "))),
      );
      rows.push(new TableRow({ children: cells }));
    });
  });

  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows });
}

/* ---------------- Đề + đáp án ---------------- */

function headerTable(exam, schoolName) {
  const c = exam.config;
  const left = [run((schoolName || "TRƯỜNG ......................").toUpperCase(), { bold: true, size: 24 })];
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: noBorders,
            width: { size: 40, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({ alignment: AlignmentType.CENTER, children: left }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [run("(Đề có ... trang)", { italics: true, size: 22 })] }),
            ],
          }),
          new TableCell({
            borders: noBorders,
            width: { size: 60, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({ alignment: AlignmentType.CENTER, children: [run((c.examName || "ĐỀ KIỂM TRA").toUpperCase(), { bold: true })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [run(`Môn: ${c.subject} – Lớp ${c.grade}`, { bold: true })] }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [run(`Thời gian làm bài: ${c.duration} phút, không kể thời gian phát đề`, { italics: true, size: 22 })],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

/** Phương án A–D: ngắn → 4 cột / 2 cột, dài → mỗi phương án 1 dòng (căn bằng tab) */
function optionParas(options) {
  const longest = Math.max(...options.map((o) => o.length));
  const perRow = longest <= 22 ? 4 : longest <= 48 ? 2 : 1;
  const out = [];
  for (let i = 0; i < options.length; i += perRow) {
    const children = [];
    options.slice(i, i + perRow).forEach((o, j) => {
      if (j) children.push(new TextRun({ text: "\t", font: FONT, size: SIZE }));
      children.push(run(`${LETTERS[i + j]}. `, { bold: true }), run(o));
    });
    out.push(
      new Paragraph({
        spacing: { after: 40 },
        indent: { left: 280 },
        tabStops: Array.from({ length: perRow - 1 }, (_, k) => ({ type: "left", position: 280 + Math.round(((k + 1) * 9600) / perRow) })),
        children,
      }),
    );
  }
  return out;
}

function examBody(exam) {
  const out = [];
  const c = exam.config;
  let partNo = 0;
  const roman = ["I", "II", "III", "IV"];
  const partTitle = (text) =>
    new Paragraph({ spacing: { before: 160, after: 80 }, children: [run(`PHẦN ${roman[partNo++]}. ${text}`, { bold: true })] });

  if (exam.mcQuestions.length) {
    out.push(
      partTitle(
        `TRẮC NGHIỆM NHIỀU LỰA CHỌN (${fmtPoint(exam.mcQuestions.length * c.mcPoints)} điểm). Thí sinh trả lời từ câu 1 đến câu ${exam.mcQuestions.length}. Mỗi câu chỉ chọn một phương án.`,
      ),
    );
    exam.mcQuestions.forEach((q, i) => {
      out.push(...paras(q.question, { prefix: `Câu ${i + 1}. `, after: 40 }));
      out.push(...optionParas(q.options));
    });
  }
  if (exam.tfQuestions.length) {
    out.push(
      partTitle(
        `TRẮC NGHIỆM ĐÚNG SAI (${exam.tfQuestions.length} điểm). Thí sinh trả lời từ câu 1 đến câu ${exam.tfQuestions.length}. Trong mỗi ý a), b), c), d) ở mỗi câu, chọn Đúng hoặc Sai.`,
      ),
    );
    exam.tfQuestions.forEach((q, i) => {
      out.push(...paras(q.stem, { prefix: `Câu ${i + 1}. `, after: 40 }));
      q.statements.forEach((s, j) => out.push(...paras(s.text, { prefix: `${TF_LABELS[j]}) `, indent: 280, after: 30 })));
    });
  }
  if (exam.essayQuestions.length) {
    const total = exam.essayQuestions.reduce((s, q) => s + q.points, 0);
    out.push(partTitle(`TỰ LUẬN (${fmtPoint(total)} điểm)`));
    exam.essayQuestions.forEach((q, i) => out.push(...paras(q.question, { prefix: `Câu ${i + 1} (${fmtPoint(q.points)} điểm). `, after: 60 })));
  }
  out.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200 }, children: [run("----- HẾT -----", { bold: true })] }));
  return out;
}

function answerKey(exam) {
  const out = [title("ĐÁP ÁN VÀ HƯỚNG DẪN CHẤM", 28)];
  const c = exam.config;
  let partNo = 0;
  const roman = ["I", "II", "III", "IV"];
  const heading = (text) => new Paragraph({ spacing: { before: 160, after: 80 }, children: [run(`PHẦN ${roman[partNo++]}. ${text}`, { bold: true })] });

  if (exam.mcQuestions.length) {
    out.push(heading(`Trắc nghiệm nhiều lựa chọn — mỗi câu đúng ${fmtPoint(c.mcPoints)} điểm`));
    const perRow = 10;
    const rows = [];
    for (let i = 0; i < exam.mcQuestions.length; i += perRow) {
      const chunk = exam.mcQuestions.slice(i, i + perRow);
      const pad = (arr) => [...arr, ...Array(perRow - arr.length).fill("")];
      rows.push(new TableRow({ children: [cell("Câu", { bold: true, fill: "EDEDED" }), ...pad(chunk.map((_, j) => String(i + j + 1))).map((t) => cell(t, { bold: true, fill: "EDEDED" }))] }));
      rows.push(new TableRow({ children: [cell("Đáp án", { bold: true }), ...pad(chunk.map((q) => q.answer)).map((t) => cell(t))] }));
    }
    out.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }));
  }
  if (exam.tfQuestions.length) {
    out.push(heading("Trắc nghiệm đúng sai — điểm tối đa mỗi câu 1 điểm"));
    out.push(
      ...paras("Chọn đúng 1 ý: 0,1 điểm; đúng 2 ý: 0,25 điểm; đúng 3 ý: 0,5 điểm; đúng cả 4 ý: 1 điểm.", { italics: true, size: 24 }),
    );
    const rows = [
      new TableRow({ children: ["Câu", ...TF_LABELS.map((l) => `Ý ${l})`)].map((t) => cell(t, { bold: true, fill: "EDEDED" })) }),
      ...exam.tfQuestions.map(
        (q, i) => new TableRow({ children: [cell(String(i + 1), { bold: true }), ...q.statements.map((s) => cell(s.correct ? "Đúng" : "Sai"))] }),
      ),
    ];
    out.push(new Table({ width: { size: 70, type: WidthType.PERCENTAGE }, rows }));
  }
  if (exam.essayQuestions.length) {
    out.push(heading("Tự luận"));
    const rows = [
      new TableRow({ children: [cell("Câu", { bold: true, fill: "EDEDED", width: 10 }), cell("Nội dung / Hướng dẫn chấm", { bold: true, fill: "EDEDED", width: 75 }), cell("Điểm", { bold: true, fill: "EDEDED", width: 15 })] }),
      ...exam.essayQuestions.map(
        (q, i) =>
          new TableRow({
            children: [cell(`Câu ${i + 1}`, { bold: true }), cell(q.answerGuide || "", { align: AlignmentType.LEFT }), cell(fmtPoint(q.points), { bold: true })],
          }),
      ),
    ];
    out.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }));
  }
  return out;
}

const PORTRAIT = { size: { orientation: PageOrientation.PORTRAIT }, margin: { top: 1000, bottom: 1000, left: 1250, right: 900 } };
const LANDSCAPE = { size: { orientation: PageOrientation.LANDSCAPE }, margin: { top: 900, bottom: 900, left: 800, right: 800 } };

function fileName(exam, suffix) {
  const base = `${exam.title || "De kiem tra"}${suffix ? ` - ${suffix}` : ""}`.replace(/[\\/:*?"<>|]+/g, " ").trim();
  return `${base}.docx`;
}

function matrixSection(exam, m) {
  return {
    properties: { page: LANDSCAPE },
    children: [
      title(`MA TRẬN ĐỀ ${(exam.config.examName || "KIỂM TRA").toUpperCase()}`),
      title(`MÔN: ${exam.config.subject.toUpperCase()} – LỚP ${exam.config.grade}`, 26),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [run(`Thời gian làm bài: ${exam.config.duration} phút`, { italics: true, size: 24 })] }),
      matrixTable(exam, m),
    ],
  };
}

function specSection(exam, m) {
  return {
    properties: { page: LANDSCAPE },
    children: [
      title(`BẢN ĐẶC TẢ ĐỀ ${(exam.config.examName || "KIỂM TRA").toUpperCase()}`),
      title(`MÔN: ${exam.config.subject.toUpperCase()} – LỚP ${exam.config.grade}`, 26),
      new Paragraph({ spacing: { after: 80 }, children: [] }),
      specTable(exam, m),
    ],
  };
}

function examSections(exam, schoolName) {
  return [
    { properties: { page: PORTRAIT }, children: [headerTable(exam, schoolName), new Paragraph({ spacing: { after: 120 }, children: [] }), ...examBody(exam)] },
    { properties: { page: PORTRAIT }, children: answerKey(exam) },
  ];
}

/** kind: "all" | "matrix" | "spec" | "exam" */
export async function downloadAiExamWord(exam, kind = "all", schoolName = "") {
  const m = buildMatrix(exam);
  const sections = {
    all: () => [matrixSection(exam, m), specSection(exam, m), ...examSections(exam, schoolName)],
    matrix: () => [matrixSection(exam, m)],
    spec: () => [specSection(exam, m)],
    exam: () => examSections(exam, schoolName),
  }[kind]();
  const suffix = { all: "", matrix: "Ma tran", spec: "Ban dac ta", exam: "De va dap an" }[kind];
  const doc = new Document({
    styles: { default: { document: { run: { font: FONT, size: SIZE } } } },
    sections,
  });
  saveAs(await Packer.toBlob(doc), fileName(exam, suffix));
}
