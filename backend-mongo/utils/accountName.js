// utils/accountName.js — sinh tên đăng nhập từ họ tên + ngày sinh
/* Quy tắc: chữ cái đầu của họ và tên đệm + tên (bỏ dấu) + ngày sinh (2 số) + 2 số cuối năm sinh.
 *   Nguyễn Văn An, 22/10/2011 → nvan2211
 * Trùng thì thêm số thứ tự: nvan22112, nvan22113… */

const DEFAULT_PASSWORD = "Abc@123";

function removeDiacritics(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

/** "2011-10-22" | "22/10/2011" | Date → Date (UTC 00:00) hoặc null nếu sai */
function parseBirthDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const text = String(value).trim();
  let y, m, d;
  let match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) [, y, m, d] = match;
  else {
    match = text.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
    if (!match) return null;
    [, d, m, y] = match;
  }
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  if (date.getUTCDate() !== Number(d) || date.getUTCMonth() !== Number(m) - 1) return null;
  if (Number(y) < 1900 || date.getTime() > Date.now()) return null;
  return date;
}

/** Phần gốc của tên đăng nhập (chưa kiểm tra trùng) */
function baseUsername(name, birthDate) {
  const words = removeDiacritics(name)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length || !birthDate) return "";
  const last = words[words.length - 1];
  const initials = words
    .slice(0, -1)
    .map((w) => w[0])
    .join("");
  const dd = String(birthDate.getUTCDate()).padStart(2, "0");
  const yy = String(birthDate.getUTCFullYear()).slice(-2);
  return `${initials}${last}${dd}${yy}`;
}

/**
 * Tên đăng nhập chưa ai dùng.
 * @param {import("mongoose").Model} User
 * @param {Set<string>} [reserved] các tên vừa cấp trong cùng lượt tạo hàng loạt
 */
async function uniqueUsername(User, name, birthDate, reserved = new Set()) {
  const base = baseUsername(name, birthDate);
  if (!base) return "";
  const taken = new Set(
    (await User.find({ username: new RegExp(`^${base}\\d*$`) }).select("username")).map((u) => u.username),
  );
  for (let i = 1; ; i++) {
    const candidate = i === 1 ? base : `${base}${i}`;
    if (!taken.has(candidate) && !reserved.has(candidate)) {
      reserved.add(candidate);
      return candidate;
    }
  }
}

module.exports = { DEFAULT_PASSWORD, removeDiacritics, parseBirthDate, baseUsername, uniqueUsername };
