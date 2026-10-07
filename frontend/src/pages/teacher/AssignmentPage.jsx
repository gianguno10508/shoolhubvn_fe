import { useMemo, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

// import "./AssignmentPage.css";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const LETTERS = ["A", "B", "C", "D"];

/* =========================================================
   PDF
========================================================= */

async function extractPdfText(file) {
  const buffer = await file.arrayBuffer();

  const pdf = await pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
  }).promise;

  const lines = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();

    let currentLine = [];
    let currentY = null;

    for (const item of content.items || []) {
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
  }

  return lines;
}

/* =========================================================
   PARSE QUESTIONS
========================================================= */

function parseQuestions(lines) {
  const questions = [];

  let currentQuestion = null;
  let currentOption = null;

  const questionRegex = /^Câu\s*(\d+)[\.\):\-]?\s*(.*)$/i;

  const optionRegex = /^_?\s*([ABCD])[\.\):\-]\s*(.*)$/i;

  for (const raw of lines) {
    const line = raw.replace(/\u00a0/g, " ").trim();

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

      currentQuestion.options.push({
        id: `${currentQuestion.id}-${letter}`,
        letter,
        originalLetter: letter,
        text,
        isCorrect,
      });

      if (isCorrect) {
        currentQuestion.correctAnswer = letter;
      }

      currentOption =
        currentQuestion.options[currentQuestion.options.length - 1];

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
  }));
}

/* =========================================================
   HELPERS
========================================================= */

function formatDateTime(value) {
  if (!value) return "--";

  return new Date(value).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatTime(seconds) {
  const safeSeconds = Math.max(0, Number(seconds) || 0);

  const hours = Math.floor(safeSeconds / 3600);

  const minutes = Math.floor((safeSeconds % 3600) / 60);

  const secs = safeSeconds % 60;

  return [
    hours > 0 ? String(hours).padStart(2, "0") : null,
    String(minutes).padStart(2, "0"),
    String(secs).padStart(2, "0"),
  ]
    .filter(Boolean)
    .join(":");
}

function getNow() {
  return new Date();
}

/* =========================================================
   COMPONENT
========================================================= */

export default function AssignmentPage() {
  const fileInputRef = useRef(null);

  const [file, setFile] = useState(null);

  const [questions, setQuestions] = useState([]);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  /* -----------------------------------------
     CONFIG
  ----------------------------------------- */

  const [assignmentTitle, setAssignmentTitle] = useState(
    "Bài kiểm tra trắc nghiệm",
  );

  const [duration, setDuration] = useState(30);

  const [deadline, setDeadline] = useState("");

  /* -----------------------------------------
     STUDENT MODE
  ----------------------------------------- */

  const [mode, setMode] = useState("teacher");

  const [examStarted, setExamStarted] = useState(false);

  const [examSubmitted, setExamSubmitted] = useState(false);

  const [remainingSeconds, setRemainingSeconds] = useState(0);

  const [answers, setAnswers] = useState({});

  const [score, setScore] = useState(null);

  const [startTime, setStartTime] = useState(null);

  /* -----------------------------------------
     CURRENT TIME
  ----------------------------------------- */

  const [now, setNow] = useState(() => getNow());

  /* =====================================================
     DERIVED
  ===================================================== */

  const deadlineDate = useMemo(() => {
    if (!deadline) return null;

    const date = new Date(deadline);

    return Number.isNaN(date.getTime()) ? null : date;
  }, [deadline]);

  const deadlinePassed =
    deadlineDate && now.getTime() >= deadlineDate.getTime();

  const validQuestionCount = questions.filter(
    (question) => question.options.length === 4 && question.correctAnswer,
  ).length;

  const answeredCount = Object.keys(answers).length;

  const progress = questions.length
    ? Math.round((answeredCount / questions.length) * 100)
    : 0;

  /* =====================================================
     CLOCK
  ===================================================== */

  useMemo(() => {
    if (!examStarted || examSubmitted) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setRemainingSeconds((current) => {
        if (current <= 1) {
          window.clearInterval(timer);

          setExamSubmitted(true);

          return 0;
        }

        return current - 1;
      });

      setNow(new Date());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [examStarted, examSubmitted]);

  /* =====================================================
     IMPORT PDF
  ===================================================== */

  async function handleFile(file) {
    if (!file) return;

    if (
      file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      setError("Vui lòng chọn file PDF.");

      return;
    }

    setError("");
    setLoading(true);

    try {
      const lines = await extractPdfText(file);

      const parsed = parseQuestions(lines);

      if (!parsed.length) {
        throw new Error("Không tìm thấy câu hỏi trong file PDF.");
      }

      setFile(file);
      setQuestions(parsed);
    } catch (err) {
      console.error(err);

      setError(err?.message || "Không thể đọc file PDF.");

      setFile(null);
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  }

  function handleFileInput(event) {
    const selected = event.target.files?.[0];

    handleFile(selected);

    event.target.value = "";
  }

  /* =====================================================
     ANSWER
  ===================================================== */

  function chooseAnswer(questionId, letter) {
    if (examSubmitted || !examStarted || remainingSeconds <= 0) {
      return;
    }

    setAnswers((current) => ({
      ...current,
      [questionId]: letter,
    }));
  }

  /* =====================================================
     START EXAM
  ===================================================== */

  function startExam() {
    setError("");

    if (!questions.length) {
      setError("Chưa có đề kiểm tra.");

      return;
    }

    if (!duration || duration < 1) {
      setError("Thời gian làm bài phải lớn hơn 0 phút.");

      return;
    }

    if (!deadlineDate) {
      setError("Vui lòng cấu hình ngày hết hạn.");

      return;
    }

    const current = getNow();

    if (current.getTime() >= deadlineDate.getTime()) {
      setError("Bài kiểm tra đã hết hạn. Không thể bắt đầu làm bài.");

      return;
    }

    setStartTime(current);

    setRemainingSeconds(Number(duration) * 60);

    setAnswers({});

    setScore(null);

    setExamSubmitted(false);

    setExamStarted(true);

    setMode("student");
  }

  /* =====================================================
     SUBMIT
  ===================================================== */

  function submitExam() {
    if (examSubmitted) {
      return;
    }

    let correct = 0;

    questions.forEach((question) => {
      if (answers[question.id] === question.correctAnswer) {
        correct++;
      }
    });

    const result = questions.length
      ? ((correct / questions.length) * 10).toFixed(2)
      : "0";

    setScore({
      correct,
      total: questions.length,
      score: Number(result),
    });

    setExamSubmitted(true);
  }

  /* =====================================================
     RESET
  ===================================================== */

  function resetAll() {
    setFile(null);
    setQuestions([]);
    setError("");
    setExamStarted(false);
    setExamSubmitted(false);
    setAnswers({});
    setScore(null);
    setRemainingSeconds(0);
    setStartTime(null);
    setMode("teacher");
  }

  /* =====================================================
     RENDER
  ===================================================== */

  if (mode === "student") {
    return (
      <StudentExamView
        title={assignmentTitle}
        questions={questions}
        answers={answers}
        remainingSeconds={remainingSeconds}
        progress={progress}
        examSubmitted={examSubmitted}
        score={score}
        startTime={startTime}
        deadline={deadlineDate}
        onChooseAnswer={chooseAnswer}
        onSubmit={submitExam}
        onBack={() => setMode("teacher")}
      />
    );
  }

  return (
    <div className="assignment-page">
      {/* HEADER */}
      <header className="assignment-header">
        <div>
          <div className="assignment-breadcrumb">
            Bài tập & Tự chấm
            <span>/</span>
            Tạo bài kiểm tra
          </div>

          <h1>Tạo bài tập & tự chấm</h1>

          <p>
            Import đề PDF, cấu hình thời gian và tạo bài trắc nghiệm trực tuyến.
          </p>
        </div>

        <div className="assignment-header-badge">
          <span />
          Chưa kết nối API
        </div>
      </header>

      {/* ERROR */}
      {error && (
        <div className="assignment-alert">
          <div className="assignment-alert-icon">!</div>

          <div>
            <strong>Không thể tiếp tục</strong>

            <p>{error}</p>
          </div>

          <button type="button" onClick={() => setError("")}>
            ×
          </button>
        </div>
      )}

      <div className="assignment-layout">
        {/* SIDEBAR */}
        <aside className="assignment-sidebar">
          <div className="assignment-brand">
            <div className="assignment-brand-icon">✓</div>

            <div>
              <strong>Bài tập & Tự chấm</strong>

              <small>Teacher Assignment</small>
            </div>
          </div>

          <nav>
            <button className="assignment-nav-item active">
              <span>📝</span>

              <div>
                <strong>Tạo bài tập</strong>

                <small>Import đề PDF</small>
              </div>
            </button>

            <button className="assignment-nav-item disabled">
              <span>📚</span>

              <div>
                <strong>Bài tập đã tạo</strong>

                <small>Quản lý bài tập</small>
              </div>
            </button>

            <button className="assignment-nav-item disabled">
              <span>📊</span>

              <div>
                <strong>Kết quả</strong>

                <small>Điểm học sinh</small>
              </div>
            </button>
          </nav>
        </aside>

        {/* CONTENT */}
        <main className="assignment-content">
          {/* BASIC INFO */}
          <section className="assignment-card">
            <div className="assignment-card-title">
              <div className="assignment-step">01</div>

              <div>
                <h2>Thông tin bài tập</h2>

                <p>Đặt tên và cấu hình thời gian cho bài kiểm tra.</p>
              </div>
            </div>

            <div className="assignment-form-grid">
              <label className="assignment-field full">
                <span>Tên bài kiểm tra</span>

                <input
                  type="text"
                  value={assignmentTitle}
                  onChange={(event) => setAssignmentTitle(event.target.value)}
                  placeholder="Ví dụ: Kiểm tra giữa kỳ I"
                />
              </label>

              <label className="assignment-field">
                <span>Thời gian làm bài</span>

                <div className="input-with-unit">
                  <input
                    type="number"
                    min="1"
                    max="300"
                    value={duration}
                    onChange={(event) => setDuration(event.target.value)}
                  />

                  <span>phút</span>
                </div>

                <small>
                  Đồng hồ sẽ đếm ngược trong thời gian học sinh làm bài.
                </small>
              </label>

              <label className="assignment-field">
                <span>Ngày hết hạn làm bài</span>

                <input
                  type="datetime-local"
                  value={deadline}
                  onChange={(event) => setDeadline(event.target.value)}
                />

                <small>Sau thời điểm này học sinh không thể bắt đầu bài.</small>
              </label>
            </div>

            {deadlineDate && (
              <div
                className={`deadline-preview ${
                  deadlinePassed ? "expired" : ""
                }`}
              >
                <span>{deadlinePassed ? "🔴" : "🟢"}</span>

                <div>
                  <strong>
                    {deadlinePassed
                      ? "Bài đã hết hạn"
                      : "Bài đang trong thời gian nhận bài"}
                  </strong>

                  <small>Hạn: {formatDateTime(deadlineDate)}</small>
                </div>
              </div>
            )}
          </section>

          {/* IMPORT PDF */}
          <section className="assignment-card">
            <div className="assignment-card-title">
              <div className="assignment-step">02</div>

              <div>
                <h2>Import đề kiểm tra</h2>

                <p>Tải file PDF đề gốc để chuyển thành bài trắc nghiệm.</p>
              </div>
            </div>

            {!file ? (
              <div
                className="assignment-upload"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  hidden
                  accept=".pdf,application/pdf"
                  onChange={handleFileInput}
                />

                <div className="assignment-upload-icon">📄</div>

                <h3>
                  {loading
                    ? "Đang phân tích PDF..."
                    : "Chọn file PDF đề kiểm tra"}
                </h3>

                <p>Hệ thống sẽ tự nhận diện Câu hỏi + A/B/C/D + đáp án.</p>

                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();

                    fileInputRef.current?.click();
                  }}
                >
                  Chọn file PDF
                </button>
              </div>
            ) : (
              <div className="assignment-uploaded">
                <div className="assignment-pdf-icon">PDF</div>

                <div className="assignment-uploaded-info">
                  <strong>{file.name}</strong>

                  <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                </div>

                <div className="assignment-uploaded-stat">
                  <strong>{questions.length}</strong>

                  <span>câu hỏi</span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setQuestions([]);
                  }}
                >
                  Xóa
                </button>
              </div>
            )}

            {questions.length > 0 && (
              <div className="question-summary">
                <div>
                  <span>Câu hỏi nhận diện</span>

                  <strong>{questions.length}</strong>
                </div>

                <div>
                  <span>Đủ 4 phương án</span>

                  <strong>
                    {questions.filter((q) => q.options.length === 4).length}
                  </strong>
                </div>

                <div>
                  <span>Có đáp án</span>

                  <strong>
                    {questions.filter((q) => q.correctAnswer).length}
                  </strong>
                </div>
              </div>
            )}
          </section>

          {/* PREVIEW */}
          {questions.length > 0 && (
            <section className="assignment-card">
              <div className="assignment-card-title">
                <div className="assignment-step">03</div>

                <div>
                  <h2>Xem trước đề</h2>

                  <p>Kiểm tra nội dung trước khi tạo bài cho học sinh.</p>
                </div>
              </div>

              <div className="question-preview-list">
                {questions.map((question) => (
                  <div className="question-preview" key={question.id}>
                    <div className="question-preview-head">
                      <strong>Câu {question.originalNumber}</strong>

                      {question.correctAnswer ? (
                        <span className="answer-found">
                          ✓ Đã nhận diện đáp án
                        </span>
                      ) : (
                        <span className="answer-missing">Chưa có đáp án</span>
                      )}
                    </div>

                    <p>{question.text}</p>

                    <div className="preview-options">
                      {question.options.map((option) => (
                        <div
                          key={option.id}
                          className={
                            option.originalLetter === question.correctAnswer
                              ? "correct"
                              : ""
                          }
                        >
                          <b>{option.originalLetter}</b>

                          <span>{option.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* CREATE */}
          {questions.length > 0 && (
            <section className="assignment-create-panel">
              <div>
                <div className="create-icon">✓</div>

                <div>
                  <strong>Sẵn sàng tạo bài kiểm tra</strong>

                  <p>
                    {questions.length} câu hỏi
                    {" • "}
                    {duration} phút
                    {" • "}
                    Hạn{" "}
                    {deadlineDate
                      ? formatDateTime(deadlineDate)
                      : "chưa cấu hình"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={startExam}
                disabled={
                  loading ||
                  !questions.length ||
                  !deadlineDate ||
                  deadlinePassed
                }
              >
                Tạo & làm thử
                <span>→</span>
              </button>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

/* =========================================================
   STUDENT EXAM VIEW
========================================================= */

function StudentExamView({
  title,
  questions,
  answers,
  remainingSeconds,
  progress,
  examSubmitted,
  score,
  startTime,
  deadline,
  onChooseAnswer,
  onSubmit,
  onBack,
}) {
  const isDanger = remainingSeconds <= 60;

  return (
    <div className="student-exam-page">
      {/* HEADER */}
      <header className="student-exam-header">
        <div>
          <div className="student-breadcrumb">
            Bài tập
            <span>/</span>
            Làm bài
          </div>

          <h1>{title}</h1>

          <p>Chọn một đáp án đúng cho mỗi câu hỏi.</p>
        </div>

        <div className={`exam-timer ${isDanger ? "danger" : ""}`}>
          <span>⏱</span>

          <div>
            <small>Thời gian còn lại</small>

            <strong>{formatTime(remainingSeconds)}</strong>
          </div>
        </div>
      </header>

      <div className="student-exam-container">
        {/* PROGRESS */}
        <div className="exam-progress-card">
          <div>
            <strong>Tiến độ làm bài</strong>

            <span>
              {Object.keys(answers).length}/{questions.length} câu
            </span>
          </div>

          <div className="exam-progress">
            <span
              style={{
                width: `${progress}%`,
              }}
            />
          </div>
        </div>

        {/* DEADLINE */}
        <div className="student-deadline">
          <span>ℹ</span>

          <p>
            Hạn nộp: <strong>{formatDateTime(deadline)}</strong>
            {startTime && (
              <>
                {" • "}
                Bắt đầu: <strong>{formatDateTime(startTime)}</strong>
              </>
            )}
          </p>
        </div>

        {/* QUESTIONS */}
        <div className="student-question-list">
          {questions.map((question, index) => (
            <article className="student-question-card" key={question.id}>
              <div className="student-question-title">
                <span>Câu {index + 1}</span>

                {answers[question.id] && <small>✓ Đã chọn</small>}
              </div>

              <h2>{question.text}</h2>

              <div className="student-options">
                {question.options.map((option) => {
                  const selected =
                    answers[question.id] === option.originalLetter;

                  return (
                    <button
                      type="button"
                      key={option.id}
                      className={selected ? "selected" : ""}
                      disabled={examSubmitted}
                      onClick={() =>
                        onChooseAnswer(question.id, option.originalLetter)
                      }
                    >
                      <span className="option-letter">
                        {option.originalLetter}
                      </span>

                      <span className="option-text">{option.text}</span>

                      {selected && <span className="option-check">✓</span>}
                    </button>
                  );
                })}
              </div>
            </article>
          ))}
        </div>

        {/* SUBMIT */}
        {!examSubmitted ? (
          <div className="submit-exam-panel">
            <div>
              <strong>Bạn đã hoàn thành?</strong>

              <p>Sau khi nộp bài, hệ thống sẽ tự động chấm điểm.</p>
            </div>

            <button type="button" onClick={onSubmit}>
              Nộp bài
              <span>→</span>
            </button>
          </div>
        ) : (
          <div className="exam-result-card">
            <div className="result-icon">✓</div>

            <h2>{score ? "Đã chấm bài" : "Đã nộp bài"}</h2>

            {score && (
              <>
                <div className="result-score">
                  {score.score}
                  <small>/10</small>
                </div>

                <p>
                  Đúng <strong>{score.correct}</strong>
                  {" / "}
                  {score.total} câu
                </p>
              </>
            )}

            <button type="button" onClick={onBack}>
              Quay lại trang giáo viên
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
