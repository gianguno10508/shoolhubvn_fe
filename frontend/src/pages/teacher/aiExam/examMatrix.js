// pages/teacher/aiExam/examMatrix.js — số câu theo cấu hình, ma trận / bản đặc tả tính từ câu hỏi của đề AI

export const LEVEL_KEYS = ["nb", "th", "vd", "vdc"];
export const LEVEL_LABEL = { nb: "Nhận biết", th: "Thông hiểu", vd: "Vận dụng", vdc: "Vận dụng cao" };
export const LEVEL_SHORT = { nb: "NB", th: "TH", vd: "VD", vdc: "VDC" };

export const PROGRAMS = [
  { value: "primary", label: "Tiểu học", grades: [1, 2, 3, 4, 5] },
  { value: "lower_secondary", label: "Trung học cơ sở", grades: [6, 7, 8, 9] },
  { value: "upper_secondary", label: "Trung học phổ thông", grades: [10, 11, 12] },
  { value: "gdtx", label: "Trung tâm GDNN - GDTX", grades: [6, 7, 8, 9, 10, 11, 12], note: "Đề nhẹ nhàng, dễ hơn" },
];

export const TF_STATEMENT_POINTS = 0.25;
export const LETTERS = ["A", "B", "C", "D"];
export const TF_LABELS = ["a", "b", "c", "d"];

/** Số câu từng phần — giữ giống backend-mongo/utils/examCounts.js */
export function examCounts({ objectivePercent, mcPercent, mcPoints, essayCount }) {
  const objective = (10 * objectivePercent) / 100;
  let tf = mcPercent >= 100 ? 0 : Math.round((objective * (100 - mcPercent)) / 100);
  if (mcPercent <= 0) tf = Math.round(objective);
  const mc = mcPercent > 0 ? Math.round((objective - tf) / mcPoints) : 0;
  const essayPoints = Math.max(0, Math.round((10 - mc * mcPoints - tf) * 100) / 100);
  return { mc, tf, essay: essayPoints > 0 ? essayCount : 0, essayPoints };
}

/** 0.25 → "0,25" */
export const fmtPoint = (n) => String(Math.round(n * 100) / 100).replace(".", ",");

const emptyLevels = () => ({ nb: 0, th: 0, vd: 0, vdc: 0 });

/** Danh sách "mục" chấm điểm của đề: mỗi câu nhiều lựa chọn, mỗi ý đúng/sai, mỗi câu tự luận */
function items(exam) {
  const mcPoints = exam.config?.mcPoints || 0.25;
  const list = [];
  exam.mcQuestions.forEach((q, i) => list.push({ type: "mc", lesson: q.lesson, level: q.level, points: mcPoints, ref: `C${i + 1}` }));
  exam.tfQuestions.forEach((q, i) =>
    q.statements.forEach((s, j) =>
      list.push({ type: "tf", lesson: q.lesson, level: s.level, points: TF_STATEMENT_POINTS, ref: `C${i + 1}${TF_LABELS[j]}` }),
    ),
  );
  exam.essayQuestions.forEach((q, i) => list.push({ type: "essay", lesson: q.lesson, level: q.level, points: q.points, ref: `C${i + 1}` }));
  return list;
}

/** Các phần có trong đề (để ma trận chỉ hiện cột cần thiết) */
export function partsOf(exam) {
  return [
    exam.mcQuestions.length && { key: "mc", label: "Nhiều lựa chọn", unit: "câu" },
    exam.tfQuestions.length && { key: "tf", label: "Đúng - Sai", unit: "ý" },
    exam.essayQuestions.length && { key: "essay", label: "Tự luận", unit: "câu" },
  ].filter(Boolean);
}

/**
 * Ma trận: mỗi bài 1 dòng, cột = phần × mức độ (số câu / ý), cộng điểm & tỉ lệ.
 * @returns {{ parts, rows: [{ chapter, lesson, cells: {mc:{nb..}, tf, essay}, total, points }], totals, levelPoints }}
 */
export function buildMatrix(exam) {
  const lessons = exam.config.lessons;
  const parts = partsOf(exam);
  const makeRow = (chapter, lesson) => ({
    chapter,
    lesson,
    cells: { mc: emptyLevels(), tf: emptyLevels(), essay: emptyLevels() },
    refs: { mc: emptyRefs(), tf: emptyRefs(), essay: emptyRefs() },
    total: 0,
    points: 0,
  });
  const rows = lessons.map((l) => makeRow(l.chapter, l.title));
  let other = null;
  const totals = makeRow("", "Tổng");
  const levelPoints = emptyLevels();

  for (const it of items(exam)) {
    let row = rows[it.lesson];
    if (!row) row = other || (other = makeRow("", "Nội dung khác"));
    for (const r of [row, totals]) {
      r.cells[it.type][it.level] += 1;
      r.refs[it.type][it.level].push(it.ref);
      r.total += 1;
      r.points += it.points;
    }
    levelPoints[it.level] += it.points;
  }
  if (other) rows.push(other);
  return { parts, rows, totals, levelPoints };
}

function emptyRefs() {
  return { nb: [], th: [], vd: [], vdc: [] };
}

/** Gộp các dòng liền nhau cùng chương (để vẽ ô gộp cột "Chương / Chủ đề") */
export function chapterSpans(rows) {
  const spans = rows.map(() => 0);
  let start = 0;
  rows.forEach((r, i) => {
    if (i === 0 || r.chapter !== rows[start].chapter) start = i;
    spans[start] += 1;
  });
  return spans;
}

/** % điểm thực tế mỗi mức độ */
export function levelPercents(levelPoints) {
  const out = {};
  for (const k of LEVEL_KEYS) out[k] = Math.round(levelPoints[k] * 10 * 10) / 10;
  return out;
}

/**
 * Chuyển câu trắc nghiệm của đề AI sang định dạng câu hỏi của trình Trộn đề.
 * Nhiều lựa chọn: đảo câu trong nhóm 1; Đúng/Sai: đảo câu trong nhóm 2 (luôn nằm sau phần nhiều lựa chọn).
 */
export function toShuffleQuestions(exam) {
  const out = [];
  const push = (text, options, lowerLetters, group) => {
    const n = out.length + 1;
    const opts = options.map((o, i) => ({
      id: `${n}-${LETTERS[i]}`,
      letter: LETTERS[i],
      originalLetter: LETTERS[i],
      text: o.text,
      isCorrect: o.isCorrect,
    }));
    const correctAnswers = opts.filter((o) => o.isCorrect).map((o) => o.letter);
    out.push({
      id: n,
      originalNumber: n,
      text,
      options: opts,
      correctAnswer: correctAnswers.length === 1 ? correctAnswers[0] : correctAnswers[0] || null,
      correctAnswers,
      lowerLetters,
      mark: { kind: 1, group },
    });
  };
  exam.mcQuestions.forEach((q) =>
    push(
      q.question,
      q.options.map((text, i) => ({ text, isCorrect: LETTERS[i] === q.answer })),
      false,
      1,
    ),
  );
  exam.tfQuestions.forEach((q) =>
    push(
      q.stem,
      q.statements.map((s) => ({ text: s.text, isCorrect: s.correct })),
      true,
      2,
    ),
  );
  return out;
}
