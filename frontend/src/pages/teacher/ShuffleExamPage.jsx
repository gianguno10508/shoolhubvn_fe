import { useMemo, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import * as XLSX from "xlsx";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
} from "docx";
import JSZip from "jszip";
import { saveAs } from "file-saver";


pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const LETTERS = ["A", "B", "C", "D"];

/* =========================================================
   HELPERS
========================================================= */

function shuffleArray(array) {
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

async function extractPdfText(file) {
  const buffer = await file.arrayBuffer();

  const pdf = await pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
  }).promise;

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

function parseQuestions(lines) {
  const questions = [];

  let currentQuestion = null;
  let currentOption = null;

  const questionRegex = /^Câu\s*(\d+)[\.\):\-]?\s*(.*)$/i;

  const optionRegex = /^_?\s*([ABCD])[\.\):\-]\s*(.*)$/i;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\u00a0/g, " ").trim();

    if (!line) continue;

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
      };

      currentOption = null;

      continue;
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

      currentQuestion.options.push(option);

      if (isCorrect) {
        currentQuestion.correctAnswer = letter;
      }

      currentOption = option;

      continue;
    }

    if (currentQuestion) {
      if (currentOption) {
        currentOption.text += ` ${line}`;
      } else {
        currentQuestion.text += ` ${line}`;
      }
    }
  }

  if (currentQuestion) {
    questions.push(currentQuestion);
  }

  return questions.map((question, index) => ({
    ...question,
    id: index + 1,
    options: question.options.slice(0, 4),
  }));
}

/* =========================================================
   GENERATE EXAM
========================================================= */

function generateExam(sourceQuestions, shuffleQuestions, shuffleOptions) {
  let questions = [...sourceQuestions];

  if (shuffleQuestions) {
    questions = shuffleArray(questions);
  }

  return questions.map((question, questionIndex) => {
    let options = question.options.map((option) => ({
      ...option,
    }));

    if (shuffleOptions) {
      options = shuffleArray(options);
    }

    const newOptions = options.map((option, index) => ({
      ...option,
      letter: LETTERS[index],
    }));

    const correctOptionIndex = newOptions.findIndex(
      (option) => option.originalLetter === question.correctAnswer,
    );

    return {
      ...question,

      displayNumber: questionIndex + 1,

      options: newOptions,

      correctAnswer:
        correctOptionIndex >= 0 ? LETTERS[correctOptionIndex] : null,
    };
  });
}

/* =========================================================
   VALIDATE
========================================================= */

function validateQuestions(questions) {
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

/* =========================================================
   PDF EXPORT
========================================================= */

async function createPdfBlob(exam) {
  const element = document.getElementById(`exam-paper-${exam.code}`);

  if (!element) {
    throw new Error("Không tìm thấy nội dung đề thi.");
  }

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
  });

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = 210;
  const pageHeight = 297;

  const margin = 10;

  const usableWidth = pageWidth - margin * 2;

  const imageWidth = usableWidth;

  const imageHeight = (canvas.height * imageWidth) / canvas.width;

  const pageContentHeight = pageHeight - margin * 2;

  let renderedHeight = 0;

  while (renderedHeight < imageHeight) {
    if (renderedHeight > 0) {
      pdf.addPage();
    }

    const remainingHeight = imageHeight - renderedHeight;

    const currentHeight = Math.min(pageContentHeight, remainingHeight);

    const sourceY = (renderedHeight / imageHeight) * canvas.height;

    const sourceHeight = (currentHeight / imageHeight) * canvas.height;

    const pageCanvas = document.createElement("canvas");

    pageCanvas.width = canvas.width;

    pageCanvas.height = Math.ceil(sourceHeight);

    const ctx = pageCanvas.getContext("2d");

    ctx.fillStyle = "#ffffff";

    ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);

    ctx.drawImage(
      canvas,
      0,
      sourceY,
      canvas.width,
      sourceHeight,
      0,
      0,
      canvas.width,
      sourceHeight,
    );

    const pageImage = pageCanvas.toDataURL("image/jpeg", 0.95);

    const renderedPageHeight =
      (pageCanvas.height * imageWidth) / pageCanvas.width;

    pdf.addImage(
      pageImage,
      "JPEG",
      margin,
      margin,
      imageWidth,
      renderedPageHeight,
      undefined,
      "FAST",
    );

    renderedHeight += currentHeight;
  }

  return pdf.output("blob");
}

async function downloadExamPdf(exam) {
  const blob = await createPdfBlob(exam);

  saveAs(blob, `Ma-de-${exam.code}.pdf`);
}

/* =========================================================
   WORD EXPORT
========================================================= */

async function createWordBlob(exam) {
  const children = [];

  /* HEADER */

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,

      children: [
        new TextRun({
          text: "TRUNG TÂM GDNN - GDTX SƠN ĐỘNG",
          bold: true,
          size: 28,
        }),
      ],
    }),
  );

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,

      children: [
        new TextRun({
          text: "ĐỀ KIỂM TRA",
          bold: true,
          size: 32,
        }),
      ],
    }),
  );

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,

      children: [
        new TextRun({
          text: "MÔN: TIN HỌC",
          bold: true,
          size: 25,
        }),
      ],
    }),
  );

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,

      children: [
        new TextRun({
          text: "Thời gian làm bài: ........ phút",
          size: 22,
        }),
      ],
    }),
  );

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,

      spacing: {
        before: 100,
        after: 300,
      },

      children: [
        new TextRun({
          text: `MÃ ĐỀ: ${exam.code}`,
          bold: true,
          size: 26,
        }),
      ],
    }),
  );

  /* STUDENT INFO */

  children.push(
    new Paragraph({
      spacing: {
        after: 200,
      },

      children: [
        new TextRun({
          text: "Họ và tên: .................................................................    Lớp: ....................",
          size: 23,
        }),
      ],
    }),
  );

  /* QUESTIONS */

  exam.questions.forEach((question) => {
    children.push(
      new Paragraph({
        spacing: {
          before: 180,
          after: 100,
        },

        children: [
          new TextRun({
            text: `Câu ${question.displayNumber}. `,
            bold: true,
            size: 23,
          }),

          new TextRun({
            text: question.text,
            size: 23,
          }),
        ],
      }),
    );

    question.options.forEach((option) => {
      children.push(
        new Paragraph({
          indent: {
            left: 400,
          },

          spacing: {
            after: 70,
          },

          children: [
            new TextRun({
              text: `${option.letter}. `,
              bold: true,
              size: 22,
            }),

            new TextRun({
              text: option.text,
              size: 22,
            }),
          ],
        }),
      );
    });
  });

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 720,
              right: 720,
              bottom: 720,
              left: 900,
            },
          },
        },

        children,
      },
    ],
  });

  return await Packer.toBlob(doc);
}

async function downloadExamWord(exam) {
  const blob = await createWordBlob(exam);

  saveAs(blob, `Ma-de-${exam.code}.docx`);
}

/* =========================================================
   EXCEL ANSWER
========================================================= */

function downloadAnswerExcel(exams) {
  if (!exams.length) return;

  const maxQuestions = Math.max(...exams.map((exam) => exam.questions.length));

  const data = [];

  /* TITLE */

  data.push(["BẢNG ĐÁP ÁN CÁC MÃ ĐỀ"]);

  data.push([]);

  data.push(["Câu", ...exams.map((exam) => `Mã ${exam.code}`)]);

  for (let i = 0; i < maxQuestions; i++) {
    const row = [i + 1];

    exams.forEach((exam) => {
      const question = exam.questions[i];

      row.push(question?.correctAnswer || "");
    });

    data.push(row);
  }

  const worksheet = XLSX.utils.aoa_to_sheet(data);

  worksheet["!cols"] = [
    {
      wch: 12,
    },

    ...exams.map(() => ({
      wch: 16,
    })),
  ];

  worksheet["!merges"] = [
    {
      s: {
        r: 0,
        c: 0,
      },

      e: {
        r: 0,
        c: exams.length,
      },
    },
  ];

  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet, "Đáp án");

  XLSX.writeFile(workbook, `Dap-an-${exams.length}-ma-de.xlsx`);
}

/* =========================================================
   DOWNLOAD ALL
========================================================= */

async function downloadAllFiles(exams, setExporting, setExportProgress) {
  if (!exams.length) return;

  try {
    setExporting(true);

    const zip = new JSZip();

    for (let i = 0; i < exams.length; i++) {
      const exam = exams[i];

      setExportProgress(Math.round(((i + 1) / exams.length) * 100));

      const pdfBlob = await createPdfBlob(exam);

      const wordBlob = await createWordBlob(exam);

      zip.file(`PDF/Ma-de-${exam.code}.pdf`, pdfBlob);

      zip.file(`Word/Ma-de-${exam.code}.docx`, wordBlob);
    }

    const excelData = [];

    excelData.push(["BẢNG ĐÁP ÁN CÁC MÃ ĐỀ"]);

    excelData.push([]);

    excelData.push(["Câu", ...exams.map((exam) => `Mã ${exam.code}`)]);

    const maxQuestions = Math.max(
      ...exams.map((exam) => exam.questions.length),
    );

    for (let i = 0; i < maxQuestions; i++) {
      const row = [i + 1];

      exams.forEach((exam) => {
        row.push(exam.questions[i]?.correctAnswer || "");
      });

      excelData.push(row);
    }

    const worksheet = XLSX.utils.aoa_to_sheet(excelData);

    worksheet["!cols"] = [
      {
        wch: 12,
      },

      ...exams.map(() => ({
        wch: 16,
      })),
    ];

    worksheet["!merges"] = [
      {
        s: {
          r: 0,
          c: 0,
        },

        e: {
          r: 0,
          c: exams.length,
        },
      },
    ];

    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Đáp án");

    const excelArray = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });

    zip.file("Dap-an.xlsx", excelArray);

    const zipBlob = await zip.generateAsync({
      type: "blob",
    });

    saveAs(zipBlob, `Bo-de-${exams.length}-ma-de.zip`);
  } catch (error) {
    console.error(error);

    alert("Không thể tạo bộ file. Vui lòng thử lại.");
  } finally {
    setExporting(false);

    setExportProgress(0);
  }
}

/* =========================================================
   COMPONENT
========================================================= */

export default function ShuffleExamPage() {
  const fileInputRef = useRef(null);

  const [file, setFile] = useState(null);

  const [questions, setQuestions] = useState([]);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  const [shuffleQuestions, setShuffleQuestions] = useState(true);

  const [shuffleOptions, setShuffleOptions] = useState(true);

  const [examCount, setExamCount] = useState(4);

  const [startCode, setStartCode] = useState(101);

  const [exams, setExams] = useState([]);

  const [activeExamIndex, setActiveExamIndex] = useState(0);

  const [dragActive, setDragActive] = useState(false);

  const [exporting, setExporting] = useState(false);

  const [exportProgress, setExportProgress] = useState(0);

  const parsedQuestions = useMemo(
    () => validateQuestions(questions),
    [questions],
  );

  const invalidQuestions = parsedQuestions.filter(
    (question) => question.errors.length > 0,
  );

  const correctCount = parsedQuestions.filter(
    (question) => question.correctAnswer,
  ).length;

  const activeExam = exams[activeExamIndex];

  /* =====================================================
     FILE PROCESS
  ===================================================== */

  async function processFile(selectedFile) {
    if (!selectedFile) return;

    setError("");

    if (
      selectedFile.type !== "application/pdf" &&
      !selectedFile.name.toLowerCase().endsWith(".pdf")
    ) {
      setError("Vui lòng chọn file PDF.");

      return;
    }

    try {
      setLoading(true);

      setFile(selectedFile);

      setExams([]);

      setActiveExamIndex(0);

      const lines = await extractPdfText(selectedFile);

      const parsed = parseQuestions(lines);

      if (!parsed.length) {
        throw new Error("Không tìm thấy câu hỏi trong file PDF.");
      }

      setQuestions(parsed);
    } catch (err) {
      console.error(err);

      setQuestions([]);

      setError(err?.message || "Không thể đọc file PDF.");
    } finally {
      setLoading(false);
    }
  }

  function handleFileChange(event) {
    const selectedFile = event.target.files?.[0];

    processFile(selectedFile);
  }

  function handleDrop(event) {
    event.preventDefault();

    setDragActive(false);

    const droppedFile = event.dataTransfer.files?.[0];

    processFile(droppedFile);
  }

  function removeFile() {
    setFile(null);

    setQuestions([]);

    setExams([]);

    setError("");

    setActiveExamIndex(0);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  /* =====================================================
     MANUAL CORRECT ANSWER
  ===================================================== */

  function updateCorrectAnswer(questionId, letter) {
    setQuestions((prev) =>
      prev.map((question) => {
        if (question.id !== questionId) {
          return question;
        }

        return {
          ...question,

          correctAnswer: letter,

          options: question.options.map((option) => ({
            ...option,

            isCorrect: option.letter === letter,
          })),
        };
      }),
    );
  }

  /* =====================================================
     CREATE EXAMS
  ===================================================== */

  function createExams() {
    setError("");

    if (!questions.length) {
      setError("Vui lòng tải đề PDF trước.");

      return;
    }

    if (invalidQuestions.length) {
      setError(
        `Còn ${invalidQuestions.length} câu chưa hoàn chỉnh. Vui lòng kiểm tra lại.`,
      );

      return;
    }

    const count = Math.max(1, Math.min(50, Number(examCount) || 1));

    const firstCode = Number(startCode) || 101;

    const generated = [];

    for (let i = 0; i < count; i++) {
      generated.push({
        code: String(firstCode + i),

        questions: generateExam(questions, shuffleQuestions, shuffleOptions),
      });
    }

    setExams(generated);

    setActiveExamIndex(0);

    setTimeout(() => {
      document.getElementById("result-section")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 100);
  }

  /* =====================================================
     RENDER
  ===================================================== */

  return (
    <div className="shuffle-page">
      {/* =================================================
          HEADER
      ================================================= */}

      <header className="shuffle-header">
        <div className="breadcrumb">
          <span>Giáo viên</span>
          <span className="breadcrumb-arrow">/</span>
          <strong>Kiểm tra & Đánh giá</strong>
          <span className="breadcrumb-arrow">/</span>
          <strong>Trộn đề</strong>
        </div>

        <div className="header-main">
          <div>
            <div className="header-eyebrow">KIỂM TRA & ĐÁNH GIÁ</div>

            <h1>Trộn đề kiểm tra</h1>

            <p>
              Tải đề PDF, tự động đảo câu hỏi và phương án để tạo nhiều mã đề
              khác nhau.
            </p>
          </div>

          <div className="header-badge">
            <span className="status-dot" />
            Công cụ giáo viên
          </div>
        </div>
      </header>

      {/* =================================================
          ERROR
      ================================================= */}

      {error && (
        <div className="shuffle-alert">
          <div className="alert-icon">!</div>

          <div>
            <strong>Không thể thực hiện</strong>

            <span>{error}</span>
          </div>

          <button type="button" onClick={() => setError("")}>
            ×
          </button>
        </div>
      )}

      {/* =================================================
          LAYOUT
      ================================================= */}

      <div className="shuffle-layout">
        {/* SIDEBAR */}

        <aside className="shuffle-sidebar">
          <div className="sidebar-heading">
            <div className="sidebar-logo">✓</div>

            <div>
              <strong>Kiểm tra</strong>

              <span>& Đánh giá</span>
            </div>
          </div>

          <div className="sidebar-label">CHỨC NĂNG</div>

          <div className="assessment-menu">
            <div className="assessment-menu-item active">
              <span className="menu-icon">🔀</span>

              <div>
                <strong>Trộn đề</strong>

                <small>Tạo nhiều mã đề</small>
              </div>
            </div>

            <div className="assessment-menu-item disabled">
              <span className="menu-icon">✨</span>

              <div>
                <strong>Tạo đề với AI</strong>

                <small>Sắp ra mắt</small>
              </div>

              <span className="coming-soon">AI</span>
            </div>
          </div>

          <div className="menu-divider" />

          <div className="sidebar-help">
            <div className="help-icon">?</div>

            <strong>Cách sử dụng</strong>

            <p>
              Tải đề PDF → Kiểm tra đáp án → Chọn cấu hình → Tạo mã đề → Tải
              file.
            </p>
          </div>
        </aside>

        {/* MAIN */}

        <main className="shuffle-content">
          {/* =================================================
              STEP 1
          ================================================= */}

          <section className="shuffle-card">
            <div className="card-heading">
              <div className="step-number">01</div>

              <div>
                <h2>Tải đề gốc</h2>

                <p>File PDF gồm các câu hỏi và phương án A, B, C, D.</p>
              </div>
            </div>

            {!file ? (
              <div
                className={`pdf-dropzone ${dragActive ? "drag-active" : ""}`}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  hidden
                  onChange={handleFileChange}
                />

                <div className="upload-icon">↑</div>

                <h3>Kéo thả file PDF vào đây</h3>

                <p>
                  hoặc
                  <span> chọn file từ máy tính</span>
                </p>

                <small>Hỗ trợ PDF · Tối đa 20MB</small>
              </div>
            ) : (
              <div className="uploaded-file">
                <div className="file-icon">PDF</div>

                <div className="file-info">
                  <strong>{file.name}</strong>

                  <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                </div>

                <div className="file-result">
                  <span className="file-check">✓</span>

                  <span>
                    {loading
                      ? "Đang phân tích..."
                      : `Đã đọc ${questions.length} câu`}
                  </span>
                </div>

                <button
                  type="button"
                  className="remove-file"
                  onClick={removeFile}
                >
                  Xóa
                </button>
              </div>
            )}
          </section>

          {/* =================================================
              SUMMARY
          ================================================= */}

          {questions.length > 0 && (
            <div className="summary-grid">
              <div className="summary-card">
                <div className="summary-icon purple">#</div>

                <div>
                  <span>Tổng số câu</span>

                  <strong>{questions.length}</strong>
                </div>
              </div>

              <div className="summary-card">
                <div className="summary-icon green">✓</div>

                <div>
                  <span>Đã nhận diện đáp án</span>

                  <strong>
                    {correctCount}/{questions.length}
                  </strong>
                </div>
              </div>

              <div className="summary-card">
                <div className="summary-icon orange">!</div>

                <div>
                  <span>Cần kiểm tra</span>

                  <strong
                    className={invalidQuestions.length ? "has-error" : ""}
                  >
                    {invalidQuestions.length}
                  </strong>
                </div>
              </div>
            </div>
          )}

          {/* =================================================
              STEP 2
          ================================================= */}

          {questions.length > 0 && (
            <section className="shuffle-card">
              <div className="card-heading">
                <div className="step-number">02</div>

                <div>
                  <h2>Cấu hình trộn đề</h2>

                  <p>
                    Thiết lập cách đảo câu, đảo phương án và số lượng mã đề.
                  </p>
                </div>
              </div>

              <div className="config-grid">
                <label className="switch-option">
                  <span className="switch-text">
                    <strong>Đảo thứ tự câu hỏi</strong>

                    <small>Mỗi mã đề có thứ tự câu khác nhau</small>
                  </span>

                  <input
                    type="checkbox"
                    checked={shuffleQuestions}
                    onChange={(event) =>
                      setShuffleQuestions(event.target.checked)
                    }
                  />

                  <span className="custom-switch" />
                </label>

                <label className="switch-option">
                  <span className="switch-text">
                    <strong>Đảo phương án</strong>

                    <small>Đảo vị trí A, B, C, D</small>
                  </span>

                  <input
                    type="checkbox"
                    checked={shuffleOptions}
                    onChange={(event) =>
                      setShuffleOptions(event.target.checked)
                    }
                  />

                  <span className="custom-switch" />
                </label>
              </div>

              <div className="form-grid">
                <label className="form-field">
                  <span>Số lượng mã đề</span>

                  <div className="number-input">
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={examCount}
                      onChange={(event) => setExamCount(event.target.value)}
                    />

                    <span>mã đề</span>
                  </div>

                  <small>Có thể tạo tối đa 50 mã đề</small>
                </label>

                <label className="form-field">
                  <span>Mã đề bắt đầu</span>

                  <div className="number-input">
                    <input
                      type="number"
                      min="1"
                      value={startCode}
                      onChange={(event) => setStartCode(event.target.value)}
                    />

                    <span>→</span>
                  </div>

                  <small>Ví dụ: 101, 102, 103...</small>
                </label>
              </div>

              <div className="config-actions">
                <div>
                  <span className="config-note-icon">i</span>

                  <span>Đề sẽ được tạo ngẫu nhiên mỗi lần thực hiện.</span>
                </div>

                <button
                  type="button"
                  className="btn-primary"
                  onClick={createExams}
                  disabled={invalidQuestions.length > 0}
                >
                  <span>🔀</span>
                  Trộn và tạo mã đề
                </button>
              </div>
            </section>
          )}

          {/* =================================================
              INVALID QUESTIONS
          ================================================= */}

          {invalidQuestions.length > 0 && (
            <section className="shuffle-card warning-card">
              <div className="warning-heading">
                <div className="warning-icon">!</div>

                <div>
                  <h3>Cần kiểm tra lại {invalidQuestions.length} câu</h3>

                  <p>
                    Một số câu chưa nhận diện đủ 4 phương án hoặc chưa xác định
                    được đáp án đúng.
                  </p>
                </div>
              </div>

              <div className="question-check-list">
                {invalidQuestions.map((question) => (
                  <div className="question-check-item" key={question.id}>
                    <div className="question-check-title">
                      <strong>Câu {question.originalNumber}</strong>

                      <span>{question.text}</span>
                    </div>

                    <div className="question-error">
                      {question.errors.join(" · ")}
                    </div>

                    <div className="answer-selector">
                      <span>Đáp án đúng:</span>

                      {LETTERS.map((letter) => (
                        <button
                          key={letter}
                          type="button"
                          className={
                            question.correctAnswer === letter ? "selected" : ""
                          }
                          onClick={() =>
                            updateCorrectAnswer(question.id, letter)
                          }
                        >
                          {letter}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* =================================================
              RESULTS
          ================================================= */}

          {exams.length > 0 && (
            <section
              id="result-section"
              className="shuffle-card result-section"
            >
              <div className="result-heading">
                <div>
                  <div className="result-title-row">
                    <h2>Các mã đề đã tạo</h2>

                    <span className="generated-badge">
                      ✓ {exams.length} mã đề
                    </span>
                  </div>

                  <p>
                    Kiểm tra nội dung trước khi tải xuống. Mỗi mã đề có thể xuất
                    thành PDF hoặc Word.
                  </p>
                </div>
              </div>

              {/* DOWNLOAD TOOLBAR */}

              <div className="download-toolbar">
                <div className="download-info">
                  <div className="download-main-icon">↓</div>

                  <div>
                    <strong>Xuất bộ đề</strong>

                    <span>PDF · Word · Excel</span>
                  </div>
                </div>

                <div className="download-buttons">
                  <button
                    type="button"
                    className="btn-pdf"
                    onClick={() => downloadExamPdf(activeExam)}
                  >
                    📄 PDF mã {activeExam.code}
                  </button>

                  <button
                    type="button"
                    className="btn-word"
                    onClick={() => downloadExamWord(activeExam)}
                  >
                    📝 Word mã {activeExam.code}
                  </button>

                  <button
                    type="button"
                    className="btn-excel"
                    onClick={() => downloadAnswerExcel(exams)}
                  >
                    📊 Đáp án Excel
                  </button>

                  <button
                    type="button"
                    className="btn-download-all"
                    disabled={exporting}
                    onClick={() =>
                      downloadAllFiles(exams, setExporting, setExportProgress)
                    }
                  >
                    {exporting
                      ? `Đang đóng gói ${exportProgress}%`
                      : "📦 Tải toàn bộ"}
                  </button>
                </div>
              </div>

              {/* TABS */}

              <div className="exam-tabs">
                {exams.map((exam, index) => (
                  <button
                    key={exam.code}
                    type="button"
                    className={index === activeExamIndex ? "active" : ""}
                    onClick={() => setActiveExamIndex(index)}
                  >
                    <span>Mã {exam.code}</span>

                    {index === activeExamIndex && <small>Đang xem</small>}
                  </button>
                ))}
              </div>

              {/* ACTIVE EXAM PREVIEW */}

              {activeExam && (
                <div className="exam-preview">
                  <div className="exam-preview-header">
                    <div>
                      <span>BẢN XEM TRƯỚC</span>

                      <h3>Mã đề {activeExam.code}</h3>
                    </div>

                    <div className="preview-meta">
                      <span>{activeExam.questions.length} câu hỏi</span>

                      <span>4 phương án / câu</span>
                    </div>
                  </div>

                  <div className="exam-questions">
                    {activeExam.questions.map((question) => (
                      <div
                        className="exam-question"
                        key={`${activeExam.code}-${question.id}`}
                      >
                        <div className="question-number">
                          {question.displayNumber}
                        </div>

                        <div className="question-body">
                          <div className="question-text">{question.text}</div>

                          <div className="question-options">
                            {question.options.map((option) => (
                              <div className="preview-option" key={option.id}>
                                <span className="option-letter">
                                  {option.letter}
                                </span>

                                <span>{option.text}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* ANSWER KEY */}

                  <div className="answer-key">
                    <div className="answer-key-heading">
                      <div>
                        <strong>Đáp án mã {activeExam.code}</strong>

                        <span>Dùng để đối chiếu nhanh</span>
                      </div>
                    </div>

                    <div className="answer-grid">
                      {activeExam.questions.map((question) => (
                        <div className="answer-cell" key={question.id}>
                          <span>{question.displayNumber}</span>

                          <strong>{question.correctAnswer}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* =================================================
              EMPTY
          ================================================= */}

          {!questions.length && !loading && (
            <div className="empty-state">
              <div className="empty-icon">🔀</div>

              <h3>Sẵn sàng tạo mã đề</h3>

              <p>Hãy tải lên một file PDF chứa đề kiểm tra để bắt đầu.</p>
            </div>
          )}
        </main>
      </div>

      {/* =================================================
          HIDDEN PDF EXPORT
      ================================================= */}

      {exams.length > 0 && (
        <div className="pdf-export-container">
          {exams.map((exam) => (
            <div
              key={exam.code}
              id={`exam-paper-${exam.code}`}
              className="pdf-export-paper"
            >
              <div className="pdf-school-header">
                <div className="pdf-school-name">
                  TRUNG TÂM GDNN - GDTX SƠN ĐỘNG
                </div>

                <div className="pdf-title">ĐỀ KIỂM TRA</div>

                <div className="pdf-subject">MÔN: TIN HỌC</div>

                <div className="pdf-time">Thời gian làm bài: ........ phút</div>

                <div className="pdf-exam-code">MÃ ĐỀ: {exam.code}</div>
              </div>

              <div className="pdf-student-info">
                Họ và tên:
                ........................................................... Lớp:
                ....................
              </div>

              <div className="pdf-question-list">
                {exam.questions.map((question) => (
                  <div
                    className="pdf-question"
                    key={`${exam.code}-${question.id}`}
                  >
                    <div className="pdf-question-title">
                      <strong>Câu {question.displayNumber}.</strong>{" "}
                      {question.text}
                    </div>

                    <div className="pdf-options">
                      {question.options.map((option) => (
                        <div className="pdf-option" key={option.id}>
                          <strong>{option.letter}.</strong>

                          <span>{option.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
