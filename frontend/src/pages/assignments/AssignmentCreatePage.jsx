// pages/assignments/AssignmentCreatePage.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createAssignment } from "../../api/assignments";
import { listClasses } from "../../api/school";
import { useAuth } from "../../context/AuthContext";
import { LETTERS, readQuestionsFromPdf, validateQuestions } from "../../utils/pdfQuestions";
import { toLocalInput } from "./assignmentUtils";

function defaultDueAt() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  d.setHours(23, 59, 0, 0);
  return toLocalInput(d);
}

/* Giao bài tập mới: tải đề PDF (cùng định dạng trộn đề) → kiểm tra đáp án → cấu hình → giao */
export default function AssignmentCreatePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileInputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [reading, setReading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const [classes, setClasses] = useState([]);
  const [config, setConfig] = useState({
    title: "",
    description: "",
    durationMinutes: 45,
    totalPoints: 10,
    openAt: toLocalInput(new Date()),
    dueAt: defaultDueAt(),
    maxAttempts: 1,
    classIds: user?.classId ? [user.classId] : [],
    shuffleQuestions: true,
    shuffleOptions: true,
    showAnswers: false,
  });

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listClasses()
      .then(setClasses)
      .catch((err) => setError(err.message || "Không tải được danh sách lớp."));
  }, []);

  const checked = useMemo(() => validateQuestions(questions), [questions]);
  const invalidCount = checked.filter((q) => q.errors.length).length;

  const set = (field, value) => setConfig((prev) => ({ ...prev, [field]: value }));

  function toggleClass(id) {
    setConfig((prev) => ({
      ...prev,
      classIds: prev.classIds.includes(id) ? prev.classIds.filter((x) => x !== id) : [...prev.classIds, id],
    }));
  }

  async function processFile(selected) {
    if (!selected) return;
    setError("");
    setReading(true);
    try {
      const parsed = await readQuestionsFromPdf(selected);
      setFile(selected);
      setQuestions(parsed);
      if (!config.title) set("title", selected.name.replace(/\.pdf$/i, ""));
    } catch (err) {
      setFile(null);
      setQuestions([]);
      setError(err.message || "Không thể đọc file PDF.");
    } finally {
      setReading(false);
    }
  }

  function removeFile() {
    setFile(null);
    setQuestions([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function setCorrect(questionId, letter) {
    setQuestions((prev) => prev.map((q) => (q.id === questionId ? { ...q, correctAnswer: letter } : q)));
  }

  async function submit() {
    setError("");
    if (!questions.length) return setError("Vui lòng tải đề PDF trước.");
    if (invalidCount) return setError(`Còn ${invalidCount} câu chưa hoàn chỉnh, hãy kiểm tra lại ở bước 2.`);
    if (!config.title.trim()) return setError("Vui lòng nhập tên bài.");
    if (!config.classIds.length) return setError("Vui lòng chọn ít nhất 1 lớp.");
    if (new Date(config.dueAt) <= new Date(config.openAt)) return setError("Hạn nộp phải sau thời điểm mở bài.");

    setSaving(true);
    try {
      const created = await createAssignment({
        ...config,
        title: config.title.trim(),
        durationMinutes: Number(config.durationMinutes),
        totalPoints: Number(config.totalPoints),
        maxAttempts: Number(config.maxAttempts),
        openAt: new Date(config.openAt).toISOString(),
        dueAt: new Date(config.dueAt).toISOString(),
        sourceFileName: file?.name || "",
        questions: questions.map((q) => ({
          text: q.text,
          correctAnswer: q.correctAnswer,
          options: q.options.map((o) => ({ text: o.text })),
        })),
      });
      navigate(`/giao-vien/bai-tap/${created.id}`, { replace: true });
    } catch (err) {
      setError(err.message || "Không giao được bài tập.");
      setSaving(false);
    }
  }

  return (
    <div className="page as-page">
      <div className="page-head">
        <span className="page-head-icon as-icon">📝</span>
        <div>
          <h2>Giao bài tập mới</h2>
          <p>Tải đề trắc nghiệm PDF, kiểm tra đáp án rồi giao cho các lớp. Hệ thống tự chấm điểm.</p>
        </div>
        <div className="spacer" />
        <Link className="btn btn-light" to="/giao-vien/bai-tap">
          ← Danh sách bài tập
        </Link>
      </div>

      {error && (
        <div className="auth-error as-alert">
          <span>!</span>
          <p>{error}</p>
        </div>
      )}

      {/* ===== Bước 1: tải đề ===== */}
      <section className="as-card">
        <div className="as-card-head">
          <span className="as-step">1</span>
          <div>
            <h3>Tải đề PDF</h3>
            <p>
              Mỗi câu bắt đầu bằng <b>“Câu 1.”</b>, phương án <b>A. B. C. D.</b>, đáp án đúng có dấu gạch dưới phía
              trước, ví dụ <b>“_B.”</b> — giống định dạng trộn đề.
            </p>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,.pdf"
          hidden
          onChange={(e) => processFile(e.target.files?.[0])}
        />

        {!file ? (
          <div
            className={"as-dropzone" + (dragActive ? " drag-active" : "")}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              processFile(e.dataTransfer.files?.[0]);
            }}
          >
            <span className="as-dropzone-icon">{reading ? <span className="spin">↻</span> : "↑"}</span>
            <strong>{reading ? "Đang đọc đề..." : "Kéo thả file PDF vào đây"}</strong>
            <span>
              hoặc <b>chọn file từ máy tính</b>
            </span>
          </div>
        ) : (
          <div className="as-file">
            <span className="as-file-icon">PDF</span>
            <div className="as-file-info">
              <strong>{file.name}</strong>
              <span>
                {questions.length} câu hỏi ·{" "}
                {invalidCount ? (
                  <b className="bad-text">{invalidCount} câu cần kiểm tra</b>
                ) : (
                  <b className="ok-text">Đủ đáp án</b>
                )}
              </span>
            </div>
            <button className="btn btn-sm btn-light" type="button" onClick={removeFile}>
              Chọn file khác
            </button>
          </div>
        )}
      </section>

      {/* ===== Bước 2: kiểm tra đáp án ===== */}
      {questions.length > 0 && (
        <section className="as-card">
          <div className="as-card-head">
            <span className="as-step">2</span>
            <div>
              <h3>Kiểm tra đáp án</h3>
              <p>Bấm vào chữ cái để đổi đáp án đúng. Câu thiếu phương án hoặc chưa có đáp án được tô màu cam.</p>
            </div>
          </div>

          <ol className="as-question-list">
            {checked.map((q, index) => (
              <li key={q.id} className={"as-question" + (q.errors.length ? " has-error" : "")}>
                <div className="as-question-text">
                  <b>Câu {index + 1}.</b> {q.text}
                </div>
                <div className="as-option-grid">
                  {q.options.map((o) => (
                    <button
                      key={o.letter}
                      type="button"
                      className={"as-option" + (q.correctAnswer === o.letter ? " correct" : "")}
                      onClick={() => setCorrect(q.id, o.letter)}
                    >
                      <span className="as-option-letter">{o.letter}</span>
                      <span>{o.text}</span>
                    </button>
                  ))}
                  {LETTERS.slice(q.options.length).map((l) => (
                    <span key={l} className="as-option missing">
                      <span className="as-option-letter">{l}</span>
                      <span>Thiếu phương án</span>
                    </span>
                  ))}
                </div>
                {q.errors.length > 0 && <p className="as-question-error">{q.errors.join(" · ")}</p>}
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* ===== Bước 3: cấu hình ===== */}
      <section className="as-card">
        <div className="as-card-head">
          <span className="as-step">3</span>
          <div>
            <h3>Cấu hình bài tập</h3>
            <p>Thời gian làm bài tính từ lúc học sinh bấm “Bắt đầu”, nhưng không vượt quá hạn nộp.</p>
          </div>
        </div>

        <div className="as-form-grid">
          <label className="field as-span-full">
            <span>Tên bài *</span>
            <input value={config.title} onChange={(e) => set("title", e.target.value)} placeholder="Ví dụ: Ôn tập chương II" />
          </label>
          <label className="field as-span-full">
            <span>Mô tả / lời dặn</span>
            <textarea
              rows={2}
              value={config.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Không bắt buộc"
            />
          </label>
          <label className="field">
            <span>Thời gian làm bài (phút) *</span>
            <input type="number" min={1} max={600} value={config.durationMinutes} onChange={(e) => set("durationMinutes", e.target.value)} />
          </label>
          <label className="field">
            <span>Thang điểm *</span>
            <input type="number" min={1} max={1000} value={config.totalPoints} onChange={(e) => set("totalPoints", e.target.value)} />
          </label>
          <label className="field">
            <span>Mở bài từ</span>
            <input type="datetime-local" value={config.openAt} onChange={(e) => set("openAt", e.target.value)} />
          </label>
          <label className="field">
            <span>Hạn nộp (deadline) *</span>
            <input type="datetime-local" value={config.dueAt} onChange={(e) => set("dueAt", e.target.value)} />
          </label>
          <label className="field">
            <span>Số lượt làm tối đa</span>
            <input type="number" min={1} max={10} value={config.maxAttempts} onChange={(e) => set("maxAttempts", e.target.value)} />
          </label>
        </div>

        <div className="field as-classes">
          <span>Giao cho lớp *</span>
          {classes.length === 0 ? (
            <p className="hint">Trường chưa có lớp nào. Tài khoản trường cần tạo lớp ở mục “Tài khoản trường”.</p>
          ) : (
            <div className="as-chip-row">
              {classes.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={"as-chip" + (config.classIds.includes(c.id) ? " selected" : "")}
                  onClick={() => toggleClass(c.id)}
                >
                  {config.classIds.includes(c.id) ? "✓ " : ""}
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="as-switches">
          {[
            ["shuffleQuestions", "Trộn thứ tự câu hỏi", "Mỗi học sinh nhận thứ tự câu khác nhau"],
            ["shuffleOptions", "Trộn phương án A–D", "Hạn chế nhìn bài nhau"],
            ["showAnswers", "Cho xem đáp án sau khi nộp", "Học sinh thấy câu đúng / sai của mình"],
          ].map(([key, label, sub]) => (
            <label key={key} className="as-switch">
              <input type="checkbox" checked={config[key]} onChange={(e) => set(key, e.target.checked)} />
              <span className="as-switch-track" />
              <span>
                <strong>{label}</strong>
                <small>{sub}</small>
              </span>
            </label>
          ))}
        </div>
      </section>

      <div className="as-submit-bar">
        <span>
          {questions.length ? `${questions.length} câu` : "Chưa có đề"} · {config.classIds.length} lớp ·{" "}
          {config.durationMinutes} phút · thang {config.totalPoints} điểm
        </span>
        <button className="btn btn-primary" type="button" onClick={submit} disabled={saving || reading}>
          {saving ? "Đang giao bài..." : "Giao bài tập"}
        </button>
      </div>
    </div>
  );
}
