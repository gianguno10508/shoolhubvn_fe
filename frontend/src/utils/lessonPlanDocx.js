// utils/lessonPlanDocx.js — xuất giáo án (Markdown) ra file Word, font Times New Roman 13, khổ A4
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { saveAs } from "file-saver";
import { parseInline, parseMarkdown } from "./markdownBlocks";

const FONT = "Times New Roman";
const SIZE = 26; // nửa point → 13pt
const HEADINGS = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4];

/** Các đoạn chữ của 1 dòng; <br> tách thành nhiều dòng */
function runsOf(text, extra = {}) {
  const lines = [[]];
  for (const part of parseInline(text)) {
    if (part.br) lines.push([]);
    else lines[lines.length - 1].push(new TextRun({ text: part.text, bold: part.bold || extra.bold, italics: part.italic, color: "000000", font: FONT, size: extra.size || SIZE }));
  }
  return lines;
}

function paragraphs(text, options = {}, extra) {
  return runsOf(text, extra).map((children) => new Paragraph({ ...options, children }));
}

const border = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
const borders = { top: border, bottom: border, left: border, right: border };

function tableOf(block) {
  const cols = block.header.length || 1;
  const cell = (text, header) =>
    new TableCell({
      borders,
      width: { size: Math.floor(100 / cols), type: WidthType.PERCENTAGE },
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      shading: header ? { fill: "EDEDED" } : undefined,
      children: paragraphs(text || " ", header ? { alignment: AlignmentType.CENTER } : {}, header ? { bold: true } : {}),
    });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ tableHeader: true, children: block.header.map((h) => cell(h, true)) }),
      ...block.rows.map((r) => new TableRow({ children: r.map((c) => cell(c, false)) })),
    ],
  });
}

function toDocxChildren(markdown) {
  const out = [];
  for (const block of parseMarkdown(markdown)) {
    if (block.type === "heading") {
      const level = Math.min(block.level, 4);
      out.push(
        ...paragraphs(
          block.text,
          {
            heading: HEADINGS[level - 1],
            alignment: level === 1 ? AlignmentType.CENTER : AlignmentType.LEFT,
            spacing: { before: level === 1 ? 0 : 200, after: 100 },
          },
          { bold: true, size: [32, 28, 26, 26][level - 1] },
        ),
      );
    } else if (block.type === "para") {
      out.push(...paragraphs(block.text, { spacing: { after: 80 }, alignment: AlignmentType.JUSTIFIED }));
    } else if (block.type === "list") {
      for (const item of block.items) {
        const text = item.marker ? `${item.marker} ${item.text}` : item.text;
        out.push(
          ...paragraphs(text, {
            ...(item.marker ? { indent: { left: 360 + item.level * 360 } } : { bullet: { level: item.level } }),
            spacing: { after: 40 },
          }),
        );
      }
    } else if (block.type === "table") {
      out.push(tableOf(block), new Paragraph({ children: [] }));
    } else if (block.type === "hr") {
      out.push(new Paragraph({ border: { bottom: border }, children: [] }));
    }
  }
  return out;
}

const safeName = (s) =>
  (s || "Giao-an")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "Giao-an";

export async function exportLessonPlanDocx(plan) {
  const doc = new Document({
    styles: { default: { document: { run: { font: FONT, size: SIZE } } } },
    sections: [
      {
        properties: {
          page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1701, right: 1134 } },
        },
        children: toDocxChildren(plan.content),
      },
    ],
  });
  saveAs(await Packer.toBlob(doc), `Giao-an-${safeName(plan.title)}.docx`);
}
