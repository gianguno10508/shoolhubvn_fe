// Đọc "Bang ma nang luc so thpt.docx" (thư mục gốc backend) thành bảng mã năng lực số để đưa vào prompt giáo án.
// Thay file docx là cập nhật ngay (đọc lại khi file thay đổi), không cần sửa code.
const fs = require("fs/promises");
const path = require("path");
const JSZip = require("jszip");

const FILE = path.join(__dirname, "..", "Bang ma nang luc so thpt.docx");

let cache = null; // { mtimeMs, data }

const decode = (s) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

const textOf = (xml) =>
  (xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || [])
    .map((p) => decode((p.match(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g) || []).map((t) => t.replace(/<[^>]+>/g, "")).join("")).trim())
    .filter(Boolean)
    .join(" ");

/** Bảng 4 cột: Mã | Miền năng lực | Năng lực thành phần | Chỉ báo; ô gộp (trống) lấy theo dòng trên */
function parse(xml) {
  const title = textOf(xml.replace(/<w:tbl>[\s\S]*?<\/w:tbl>/g, "")).slice(0, 200);
  const rows = [];
  let domain = "";
  let component = "";
  for (const tr of xml.match(/<w:tr[ >][\s\S]*?<\/w:tr>/g) || []) {
    const cells = (tr.match(/<w:tc>[\s\S]*?<\/w:tc>/g) || []).map(textOf);
    const [code, d, c, indicator] = cells;
    if (!code || !/^\d+\.\d+/.test(code)) continue; // bỏ dòng tiêu đề
    domain = d || domain;
    component = c || component;
    rows.push({ code, domain, component, indicator: indicator || "" });
  }
  return { title, rows };
}

/** @returns {Promise<{ title: string, rows: { code, domain, component, indicator }[] }>} */
async function loadDigitalCompetence() {
  const stat = await fs.stat(FILE).catch(() => null);
  if (!stat) {
    throw Object.assign(new Error("Máy chủ chưa có file bảng mã năng lực số (Bang ma nang luc so thpt.docx)."), {
      status: 503,
    });
  }
  if (cache && cache.mtimeMs === stat.mtimeMs) return cache.data;
  const zip = await JSZip.loadAsync(await fs.readFile(FILE));
  const xml = await zip.file("word/document.xml").async("string");
  const data = parse(xml);
  if (!data.rows.length) throw Object.assign(new Error("Không đọc được bảng mã năng lực số trong file docx."), { status: 500 });
  cache = { mtimeMs: stat.mtimeMs, data };
  return data;
}

/** Bảng mã dạng văn bản gọn để đưa vào prompt */
function competenceTable({ title, rows }) {
  const lines = [title];
  let component = "";
  for (const r of rows) {
    if (r.component !== component) {
      component = r.component;
      lines.push(`[${r.domain} — ${r.component}]`);
    }
    lines.push(`${r.code}: ${r.indicator}`);
  }
  return lines.join("\n");
}

module.exports = { loadDigitalCompetence, competenceTable };
