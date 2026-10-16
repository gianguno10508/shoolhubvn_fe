// utils/markdownBlocks.js — đọc Markdown đơn giản (giáo án AI) thành các khối để hiển thị web và xuất Word.
/* Hỗ trợ: tiêu đề #, đoạn văn, gạch đầu dòng, danh sách số, bảng |...|, đường kẻ ---,
 * chữ **đậm**, *nghiêng* và <br> (xuống dòng trong ô bảng). */

/** Tách 1 dòng văn bản thành các đoạn: [{ text, bold, italic }] hoặc { br: true } */
export function parseInline(text) {
  const parts = [];
  const re = /(\*\*([^*]+)\*\*|__([^_]+)__|\*([^*\n]+)\*|<br\s*\/?>)/gi;
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index) });
    if (m[2] !== undefined || m[3] !== undefined) parts.push({ text: m[2] ?? m[3], bold: true });
    else if (m[4] !== undefined) parts.push({ text: m[4], italic: true });
    else parts.push({ br: true });
    last = re.lastIndex;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}

/** Bỏ ký hiệu Markdown, chỉ giữ chữ */
export function plainText(text) {
  return parseInline(text)
    .map((p) => (p.br ? "\n" : p.text))
    .join("");
}

const splitRow = (line) =>
  line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());

const isTableSep = (line) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line);
const LIST_RE = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;

/**
 * @returns {Array<
 *   {type:"heading",level:number,text:string} | {type:"para",text:string} | {type:"hr"} |
 *   {type:"list",items:{text:string,level:number,marker:string|null}[]} |
 *   {type:"table",header:string[],rows:string[][]}
 * >}
 */
export function parseMarkdown(source) {
  const lines = String(source || "")
    .replace(/\r\n?/g, "\n")
    .split("\n");
  const blocks = [];
  let para = [];

  const flush = () => {
    if (para.length) blocks.push({ type: "para", text: para.join(" ") });
    para = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      flush();
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flush();
      blocks.push({ type: "heading", level: heading[1].length, text: heading[2].replace(/\s*#+$/, "") });
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flush();
      blocks.push({ type: "hr" });
      continue;
    }

    if (trimmed.startsWith("|") && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      flush();
      const header = splitRow(trimmed);
      const rows = [];
      i += 2;
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        const cells = splitRow(lines[i]);
        rows.push(header.map((_, c) => cells[c] ?? ""));
        i++;
      }
      i--;
      blocks.push({ type: "table", header, rows });
      continue;
    }

    const item = line.match(LIST_RE);
    if (item) {
      flush();
      const entry = {
        text: item[3],
        level: Math.min(3, Math.floor(item[1].replace(/\t/g, "  ").length / 2)),
        marker: /\d/.test(item[2]) ? item[2].replace(")", ".") : null,
      };
      const prev = blocks[blocks.length - 1];
      if (prev?.type === "list") prev.items.push(entry);
      else blocks.push({ type: "list", items: [entry] });
      continue;
    }

    // Dòng tiếp theo của 1 mục danh sách (thụt lề)
    const prev = blocks[blocks.length - 1];
    if (!para.length && prev?.type === "list" && /^\s{2,}/.test(line)) {
      prev.items[prev.items.length - 1].text += " " + trimmed;
      continue;
    }

    para.push(trimmed);
  }
  flush();
  return blocks;
}
