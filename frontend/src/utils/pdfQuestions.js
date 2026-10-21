// utils/pdfQuestions.js
/* Đọc đề trắc nghiệm từ file PDF — dùng chung cho Trộn đề và Giao bài tập.
 * Định dạng: "Câu 1. ...", phương án "A. ... D.", đáp án đúng có gạch dưới phía trước: "_A." */
// Dùng bản "legacy" của pdf.js: có sẵn polyfill (vd. Uint8Array#toHex) cho trình duyệt chưa hỗ trợ ES2025
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfjsWorker from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export const LETTERS = ["A", "B", "C", "D"];

/* =========================================================
   HELPERS
========================================================= */

export function shuffleArray(array) {
  const result = [...array];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

/* =========================================================
   PDF PARSER
========================================================= */

/** Mở file PDF bằng pdf.js (dùng chung cho các trình đọc PDF khác, vd. sổ đầu bài) */
export async function openPdf(file) {
  const buffer = await file.arrayBuffer();
  return pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
}

export async function extractPdfText(file) {
  const pdf = await openPdf(file);

  const pages = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);

    const content = await page.getTextContent();

    const items = content.items || [];

    const lines = [];

    let currentLine = [];
    let currentY = null;

    for (const item of items) {
      const text = item.str || "";

      if (!text.trim()) continue;

      const y = item.transform?.[5] ?? 0;

      if (currentY !== null && Math.abs(y - currentY) > 3) {
        if (currentLine.length) {
          lines.push(currentLine.join("").trim());
        }

        currentLine = [];
      }

      currentLine.push(text);

      currentY = y;
    }

    if (currentLine.length) {
      lines.push(currentLine.join("").trim());
    }

    pages.push(lines);
  }

  return pages.flat();
}

/* =========================================================
   QUESTION PARSER
========================================================= */

/* Thẻ đánh dấu nhóm câu (chỉ dùng khi trộn đề):
 *   <d#1> ... </d#1>: đảo thứ tự các câu trong nhóm và đảo phương án
 *   <d#2> ... </d#2>: giữ nguyên vị trí câu, chỉ đảo phương án */
const MARKER_REGEX = /<\s*(\/?)\s*d\s*#\s*([12])\s*>/gi;

export function parseQuestions(lines) {
  const questions = [];

  let currentQuestion = null;
  let currentOption = null;
  let mark = null; // { kind: 1 | 2, group } — nhóm đang mở
  let groupCount = 0;

  const questionRegex = /^Câu\s*(\d+)[\.\):\-]?\s*(.*)$/i;

  const optionRegex = /^_?\s*([ABCD])[\.\):\-]\s*(.*)$/i;

  function handleLine(rawText) {
    const line = rawText.replace(/\u00a0/g, " ").trim();

    if (!line) return;

    const questionMatch = line.match(questionRegex);

    if (questionMatch) {
      if (currentQuestion) {
        questions.push(currentQuestion);
      }

      currentQuestion = {
        id: questions.length + 1,
        originalNumber: Number(questionMatch[1]),
        text: questionMatch[2].trim(),
        options: [],
        correctAnswer: null,
        correctAnswers: [],
        lowerLetters: false,
        mark,
      };

      currentOption = null;

      return;
    }

    const optionMatch = line.match(optionRegex);

    if (optionMatch && currentQuestion) {
      const letter = optionMatch[1].toUpperCase();

      const text = optionMatch[2].trim();

      const isCorrect = /^_/.test(line);

      const option = {
        id: `${currentQuestion.originalNumber}-${letter}`,
        letter,
        text,
        originalLetter: letter,
        isCorrect,
      };

      if (!currentQuestion.options.length) {
        currentQuestion.lowerLetters = optionMatch[1] !== letter;
      }

      currentQuestion.options.push(option);

      if (isCorrect) {
        currentQuestion.correctAnswer = letter;
        currentQuestion.correctAnswers.push(letter);
      }

      currentOption = option;

      return;
    }

    if (currentQuestion) {
      if (currentOption) {
        currentOption.text += ` ${line}`;
      } else {
        currentQuestion.text += ` ${line}`;
      }
    }
  }

  for (const rawLine of lines) {
    // Tách thẻ <d#1>, </d#2>... ra khỏi dòng, phần chữ còn lại xử lý như bình thường
    let last = 0;

    for (const match of rawLine.matchAll(MARKER_REGEX)) {
      handleLine(rawLine.slice(last, match.index));

      if (match[1]) {
        mark = null;
      } else {
        groupCount += 1;
        mark = { kind: Number(match[2]), group: groupCount };
      }

      last = match.index + match[0].length;
    }

    handleLine(rawLine.slice(last));
  }

  if (currentQuestion) {
    questions.push(currentQuestion);
  }

  return questions.map((question, index) => {
    const options = question.options.slice(0, 4);

    return {
      ...question,
      id: index + 1,
      options,
      correctAnswers: options.filter((option) => option.isCorrect).map((option) => option.letter),
    };
  });
}

/* =========================================================
   VALIDATE
========================================================= */

export function validateQuestions(questions) {
  return questions.map((question) => {
    const errors = [];

    if (question.options.length !== 4) {
      errors.push(`Cần 4 phương án, hiện có ${question.options.length}`);
    }

    if (!question.correctAnswer) {
      errors.push("Chưa xác định đáp án đúng");
    }

    return {
      ...question,
      errors,
    };
  });
}


/** Đọc file PDF và trả về danh sách câu hỏi; ném lỗi nếu file không hợp lệ */
export async function readQuestionsFromPdf(file) {
  if (!file) throw new Error("Chưa chọn file.");
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    throw new Error("Vui lòng chọn file PDF.");
  }
  const parsed = parseQuestions(await extractPdfText(file));
  if (!parsed.length) throw new Error("Không tìm thấy câu hỏi trong file PDF.");
  return parsed;
}
