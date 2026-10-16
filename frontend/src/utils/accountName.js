// utils/accountName.js — xem trước tên đăng nhập + đọc danh sách dán vào (khớp backend-mongo/utils/accountName.js)
/* Tên đăng nhập = chữ cái đầu của họ và tên đệm + tên (bỏ dấu) + ngày sinh + 2 số cuối năm sinh.
 *   Nguyễn Văn An, 22/10/2011 → nvan2211 (trùng thì máy chủ thêm số: nvan22112…) */

export const DEFAULT_PASSWORD = "Abc@123";

function removeDiacritics(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

/** "22/10/2011" | "22-10-2011" | "2011-10-22" | số ngày kiểu Excel → "2011-10-22", sai → "" */
export function toIsoDate(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  let y, m, d;
  let match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) [, y, m, d] = match;
  else if ((match = text.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2}|\d{4})$/))) {
    [, d, m, y] = match;
    if (y.length === 2) y = (Number(y) > 50 ? "19" : "20") + y;
  } else if (/^\d{5}$/.test(text)) {
    // Ô ngày trong Excel dán ra dạng số
    const date = new Date(Date.UTC(1899, 11, 30) + Number(text) * 86400000);
    return date.toISOString().slice(0, 10);
  } else return "";
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  if (date.getUTCDate() !== Number(d) || date.getUTCMonth() !== Number(m) - 1) return "";
  return date.toISOString().slice(0, 10);
}

/** "2011-10-22" hoặc ISO đầy đủ → "22/10/2011" */
export function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${date.getUTCFullYear()}`;
}

/** Giá trị cho <input type="date"> */
export function dateInputValue(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

export function previewUsername(name, isoDate) {
  const words = removeDiacritics(name)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length || !isoDate) return "";
  const [y, , d] = isoDate.split("-");
  const initials = words
    .slice(0, -1)
    .map((w) => w[0])
    .join("");
  return `${initials}${words[words.length - 1]}${d}${y.slice(-2)}`;
}

/**
 * Đọc danh sách dán từ Excel / Word: mỗi dòng "Họ tên<Tab hoặc , hoặc ;>Ngày sinh[<…>Mã HS]".
 * Dòng có số thứ tự ở đầu (1, 2, 3…) hoặc dòng tiêu đề đều được bỏ qua.
 * @returns {{ name, birthDate, studentCode, error }[]}
 */
export function parseAccountList(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/\t|;|,(?!\d)|\s{2,}|\|/).map((c) => c.trim()).filter(Boolean))
    .filter((cells) => !/^(stt|họ|ho ten|họ và tên|họ tên)/i.test(cells.join(" ")))
    .map((cells) => {
      if (/^\d{1,3}\.?$/.test(cells[0])) cells = cells.slice(1); // bỏ cột STT
      const dateIndex = cells.findIndex((c) => toIsoDate(c));
      const birthDate = dateIndex >= 0 ? toIsoDate(cells[dateIndex]) : "";
      const rest = cells.filter((_, i) => i !== dateIndex);
      const name = rest.find((c) => /\p{L}/u.test(c)) || "";
      const studentCode = rest.find((c) => c !== name) || "";
      let error = "";
      if (!name) error = "Thiếu họ tên";
      else if (!birthDate) error = "Thiếu / sai ngày sinh";
      return { name, birthDate, studentCode, error };
    });
}
