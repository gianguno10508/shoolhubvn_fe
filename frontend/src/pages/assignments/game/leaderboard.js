// pages/assignments/game/leaderboard.js — bảng xếp hạng lưu trên trình duyệt, riêng cho từng file đề

const PREFIX = "og_lb:";
const NAME_KEY = "og_player";
export const BOARD_SIZE = 10;

export function boardKey(fileName, questionCount) {
  return `${PREFIX}${fileName}|${questionCount}`;
}

export function loadBoard(key) {
  try {
    const list = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/** Điểm có lọt vào top không */
export function qualifies(list, score) {
  return score > 0 && (list.length < BOARD_SIZE || score > list[list.length - 1].score);
}

/** Thêm 1 lượt chơi, trả về bảng mới (đã sắp xếp, tối đa BOARD_SIZE) */
export function saveScore(key, entry) {
  const list = [...loadBoard(key), entry]
    .sort((a, b) => b.score - a.score || a.date - b.date)
    .slice(0, BOARD_SIZE);
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    /* bỏ qua */
  }
  return list;
}

export function clearBoard(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* bỏ qua */
  }
}

export function readPlayerName() {
  try {
    return localStorage.getItem(NAME_KEY) || "";
  } catch {
    return "";
  }
}

export function writePlayerName(name) {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    /* bỏ qua */
  }
}
