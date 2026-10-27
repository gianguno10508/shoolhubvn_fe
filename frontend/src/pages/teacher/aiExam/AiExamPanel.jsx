// pages/teacher/aiExam/AiExamPanel.jsx — Tạo đề với AI: chọn sách → chọn bài → cấu hình → AI soạn ma trận, bản đặc tả, đề + đáp án
import { useEffect, useMemo, useState } from "react";
import { deleteAiExam, generateAiExam, getAiExam, getCurriculum, getExamAiQuota, listAiExams } from "../../../api/examAi";
import { useAuth } from "../../../context/AuthContext";
import {
  ArrowLeftRight,
  BookOpen,
  Download,
  FileText,
  FolderClock,
  Library,
  ListChecks,
  Plus,
  RefreshCw,
  Shuffle,
  Sparkles,
  Trash2,
  TriangleAlert,
  Wand2,
} from "lucide-react";
import { downloadAiExamWord } from "./aiExamDocx";
import {
  buildMatrix,
  chapterSpans,
  examCounts,
  fmtPoint,
  LETTERS,
  LEVEL_KEYS,
  LEVEL_LABEL,
  LEVEL_SHORT,
  levelPercents,
  PROGRAMS,
  TF_LABELS,
  toShuffleQuestions,
} from "./examMatrix";

const SUBJECTS = [
  "Toán", "Ngữ văn", "Tiếng Việt", "Tiếng Anh", "Vật lí", "Hoá học", "Sinh học", "Khoa học tự nhiên", "Khoa học",
  "Lịch sử", "Địa lí", "Lịch sử và Địa lí", "Giáo dục công dân", "Giáo dục kinh tế và pháp luật", "Đạo đức",
  "Tự nhiên và Xã hội", "Tin học", "Công nghệ", "Giáo dục quốc phòng và an ninh", "Hoạt động trải nghiệm",
];
const BOOKS = ["Kết nối tri thức với cuộc sống", "Chân trời sáng tạo", "Cánh Diều"];
const EXAM_NAMES = [
  "Kiểm tra giữa học kì I",
  "Kiểm tra cuối học kì I",
  "Kiểm tra giữa học kì II",
  "Kiểm tra cuối học kì II",
  "Kiểm tra thường xuyên",
];
const RATIO_PRESETS = [
  { label: "4 - 3 - 2 - 1", value: { nb: 40, th: 30, vd: 20, vdc: 10 } },
  { label: "5 - 3 - 2 - 0", value: { nb: 50, th: 30, vd: 20, vdc: 0 } },
  { label: "4 - 3 - 3 - 0", value: { nb: 40, th: 30, vd: 30, vdc: 0 } },
  { label: "3 - 4 - 2 - 1", value: { nb: 30, th: 40, vd: 20, vdc: 10 } },
];
const STAGES = [
  "Đang phân tích các bài đã chọn...",
  "Đang lập ma trận đề...",
  "Đang viết bản đặc tả yêu cầu cần đạt...",
  "Đang soạn câu trắc nghiệm nhiều lựa chọn...",
  "Đang soạn câu đúng / sai...",
  "Đang soạn câu tự luận và hướng dẫn chấm...",
  "Đang kiểm tra lại đề...",
];

/** Cấu hình mặc định theo chương trình học: tiểu học & GDTX nhẹ nhàng hơn */
function programDefaults(program) {
  if (program === "primary") return { ratios: { nb: 50, th: 30, vd: 20, vdc: 0 }, mcPoints: 0.5, duration: 40 };
  if (program === "gdtx") return { ratios: { nb: 50, th: 30, vd: 20, vdc: 0 }, mcPoints: 0.25, duration: 45 };
  return { ratios: { nb: 40, th: 30, vd: 20, vdc: 10 }, mcPoints: 0.25, duration: program === "upper_secondary" ? 45 : 60 };
}

const lessonKey = (chapter, title) => `${chapter}§${title}`;

export default function AiExamPanel({ onUseForShuffle }) {
  const { user } = useAuth();
  const [view, setView] = useState("create"); // create | history | result
  const [quota, setQuota] = useState(null);
  const [error, setError] = useState("");

  // Bước 1: sách
  const [program, setProgram] = useState("upper_secondary");
  const [grade, setGrade] = useState("10");
  const [subject, setSubject] = useState("");
  const [bookSeries, setBookSeries] = useState(BOOKS[0]);

  // Bước 2: bài
  const [chapters, setChapters] = useState(null);
  const [loadingLessons, setLoadingLessons] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [customLesson, setCustomLesson] = useState("");

  // Bước 3: cấu hình
  const [examName, setExamName] = useState(EXAM_NAMES[0]);
  const [duration, setDuration] = useState(45);
  const [ratios, setRatios] = useState({ nb: 40, th: 30, vd: 20, vdc: 10 });
  const [objectivePercent, setObjectivePercent] = useState(70);
  const [mcPercent, setMcPercent] = useState(75);
  const [mcPoints, setMcPoints] = useState(0.25);
  const [essayCount, setEssayCount] = useState(2);
  const [notes, setNotes] = useState("");

  const [generating, setGenerating] = useState(false);
  const [stage, setStage] = useState(0);
  const [exam, setExam] = useState(null);
  const [history, setHistory] = useState(null);

  useEffect(() => {
    getExamAiQuota()
      .then(setQuota)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!generating) return undefined;
    setStage(0);
    const t = window.setInterval(() => setStage((s) => Math.min(STAGES.length - 1, s + 1)), 9000);
    return () => window.clearInterval(t);
  }, [generating]);

  useEffect(() => {
    if (view === "history" && history === null) {
      listAiExams()
        .then(setHistory)
        .catch((err) => setError(err.message));
    }
  }, [view, history]);

  const programInfo = PROGRAMS.find((p) => p.value === program);
  const counts = examCounts({ objectivePercent, mcPercent, mcPoints, essayCount });
  const ratioSum = LEVEL_KEYS.reduce((s, k) => s + (Number(ratios[k]) || 0), 0);

  function chooseProgram(value) {
    setProgram(value);
    const p = PROGRAMS.find((x) => x.value === value);
    if (!p.grades.includes(Number(grade))) setGrade(String(p.grades[0]));
    const d = programDefaults(value);
    setRatios(d.ratios);
    setMcPoints(d.mcPoints);
    setDuration(d.duration);
  }

  function resetLessons() {
    setChapters(null);
    setSelected(new Set());
  }

  async function loadLessons(refresh = false) {
    setError("");
    if (!subject.trim()) return setError("Vui lòng chọn môn học.");
    if (!bookSeries.trim()) return setError("Vui lòng chọn bộ sách.");
    setLoadingLessons(true);
    try {
      const data = await getCurriculum({ grade, subject: subject.trim(), bookSeries: bookSeries.trim(), refresh });
      // Giữ lại bài tự nhập
      const custom = chapters?.find((c) => c.custom);
      setChapters([...data.chapters, ...(custom ? [custom] : [])]);
      if (refresh) setSelected(new Set());
    } catch (err) {
      setError(err.message || "Không lấy được danh sách bài.");
      if (!chapters) setChapters([]);
    } finally {
      setLoadingLessons(false);
    }
  }

  function toggleLesson(key) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleChapter(ch) {
    const keys = ch.lessons.map((l) => lessonKey(ch.title, l));
    const all = keys.every((k) => selected.has(k));
    setSelected((prev) => {
      const next = new Set(prev);
      keys.forEach((k) => (all ? next.delete(k) : next.add(k)));
      return next;
    });
  }

  function selectSemester(sem) {
    const next = new Set();
    (chapters || []).filter((c) => c.semester === sem).forEach((c) => c.lessons.forEach((l) => next.add(lessonKey(c.title, l))));
    setSelected(next);
  }

  function addCustomLesson(e) {
    e.preventDefault();
    const title = customLesson.trim();
    if (!title) return;
    setChapters((prev) => {
      const list = prev ? [...prev] : [];
      const i = list.findIndex((c) => c.custom);
      const custom = i >= 0 ? { ...list[i] } : { title: "Bài tự thêm", semester: 0, lessons: [], custom: true };
      if (!custom.lessons.includes(title)) custom.lessons = [...custom.lessons, title];
      if (i >= 0) list[i] = custom;
      else list.push(custom);
      return list;
    });
    setSelected((prev) => new Set(prev).add(lessonKey("Bài tự thêm", title)));
    setCustomLesson("");
  }

  const selectedLessons = useMemo(() => {
    const out = [];
    (chapters || []).forEach((c) =>
      c.lessons.forEach((l) => {
        if (selected.has(lessonKey(c.title, l))) out.push({ chapter: c.custom ? "" : c.title, title: l });
      }),
    );
    return out;
  }, [chapters, selected]);

  async function generate() {
    setError("");
    if (!selectedLessons.length) return setError("Vui lòng chọn ít nhất 1 bài cần ra đề.");
    if (ratioSum !== 100) return setError("Tổng tỉ lệ 4 mức độ phải bằng 100%.");
    setGenerating(true);
    try {
      const result = await generateAiExam({
        level: program,
        grade,
        subject: subject.trim(),
        bookSeries: bookSeries.trim(),
        lessons: selectedLessons,
        examName,
        duration,
        ratios,
        objectivePercent,
        mcPercent,
        mcPoints,
        essayCount,
        notes,
      });
      setExam(result);
      setHistory(null);
      setView("result");
      setQuota((q) => (q ? { ...q, used: q.used + 1 } : q));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err.message || "Không tạo được đề.");
    } finally {
      setGenerating(false);
    }
  }

  async function openExam(id) {
    setError("");
    try {
      setExam(await getAiExam(id));
      setView("result");
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeExam(item) {
    if (!window.confirm(`Xoá đề “${item.title}”?`)) return;
    try {
      await deleteAiExam(item.id);
      setHistory((prev) => prev.filter((x) => x.id !== item.id));
    } catch (err) {
      setError(err.message);
    }
  }

  const left = quota ? Math.max(0, quota.limit - quota.used) : null;

  return (
    <div className="ai-exam">
      <div className="ai-exam-bar">
        <div className="tabs">
          <button type="button" className={"tab" + (view === "create" ? " active" : "")} onClick={() => setView("create")}>
            <Sparkles size={15} /> Tạo đề mới
          </button>
          {exam && (
            <button type="button" className={"tab" + (view === "result" ? " active" : "")} onClick={() => setView("result")}>
              <FileText size={15} /> Đề đang xem
            </button>
          )}
          <button type="button" className={"tab" + (view === "history" ? " active" : "")} onClick={() => setView("history")}>
            <FolderClock size={15} /> Đề đã tạo
          </button>
        </div>
        {left !== null && (
          <span className={"ai-quota" + (left === 0 ? " empty" : "")}>
            Còn {left}/{quota.limit} lượt tạo đề hôm nay
          </span>
        )}
      </div>

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

      {view === "history" && <HistoryList history={history} onOpen={openExam} onRemove={removeExam} />}

      {view === "result" && exam && (
        <ExamResult
          exam={exam}
          schoolName={user?.school?.name}
          onNew={() => setView("create")}
          onUseForShuffle={onUseForShuffle}
        />
      )}

      {view === "create" && (
        <>
          {/* ---------- BƯỚC 1 ---------- */}
          <section className="shuffle-card">
            <div className="card-heading">
              <div className="step-number">01</div>
              <div>
                <h2>Chọn chương trình & sách</h2>
                <p>Chương trình học quyết định độ khó của đề; GDNN-GDTX và tiểu học sẽ nhẹ nhàng hơn.</p>
              </div>
            </div>

            <div className="ai-programs">
              {PROGRAMS.map((p) => (
                <button key={p.value} type="button" className={"ai-program" + (program === p.value ? " active" : "")} onClick={() => chooseProgram(p.value)}>
                  <strong>{p.label}</strong>
                  <small>{p.note || `Lớp ${p.grades[0]} – ${p.grades[p.grades.length - 1]}`}</small>
                </button>
              ))}
            </div>

            <div className="ai-form-grid">
              <label className="form-field">
                <span>Khối lớp</span>
                <select
                  value={grade}
                  onChange={(e) => {
                    setGrade(e.target.value);
                    resetLessons();
                  }}
                >
                  {programInfo.grades.map((g) => (
                    <option key={g} value={g}>
                      Lớp {g}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span>Môn học</span>
                <input
                  list="ai-subjects"
                  value={subject}
                  placeholder="Chọn hoặc nhập môn"
                  onChange={(e) => {
                    setSubject(e.target.value);
                    resetLessons();
                  }}
                />
                <datalist id="ai-subjects">
                  {SUBJECTS.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </label>
              <label className="form-field">
                <span>Bộ sách</span>
                <input
                  list="ai-books"
                  value={bookSeries}
                  placeholder="Chọn hoặc nhập bộ sách"
                  onChange={(e) => {
                    setBookSeries(e.target.value);
                    resetLessons();
                  }}
                />
                <datalist id="ai-books">
                  {BOOKS.map((b) => (
                    <option key={b} value={b} />
                  ))}
                </datalist>
              </label>
            </div>

            {!chapters && (
              <button type="button" className="btn btn-primary ai-load-btn" onClick={() => loadLessons(false)} disabled={loadingLessons || !subject.trim()}>
                {loadingLessons ? <RefreshCw size={17} className="ai-spin-icon" /> : <Library size={17} />}
                {loadingLessons ? "Đang lấy danh sách bài..." : "Lấy danh sách bài"}
              </button>
            )}
          </section>

          {/* ---------- BƯỚC 2 ---------- */}
          {chapters && (
            <section className="shuffle-card">
              <div className="card-heading">
                <div className="step-number">02</div>
                <div>
                  <h2>Chọn bài cần ra đề</h2>
                  <p>
                    {subject} {grade} – {bookSeries}. Danh sách do AI liệt kê theo mục lục SGK, hãy kiểm tra lại; có thể tự thêm bài.
                  </p>
                </div>
              </div>

              <div className="ai-lesson-tools">
                <button type="button" className="btn btn-sm btn-light" onClick={() => selectSemester(1)}>
                  Chọn học kì I
                </button>
                <button type="button" className="btn btn-sm btn-light" onClick={() => selectSemester(2)}>
                  Chọn học kì II
                </button>
                <button type="button" className="btn btn-sm btn-light" onClick={() => setSelected(new Set())} disabled={!selected.size}>
                  Bỏ chọn tất cả
                </button>
                <div className="spacer" />
                <button type="button" className="btn btn-sm btn-light" onClick={() => loadLessons(true)} disabled={loadingLessons}>
                  <RefreshCw size={14} className={loadingLessons ? "ai-spin-icon" : ""} />
                  {loadingLessons ? "Đang lấy..." : "Lấy lại bằng AI"}
                </button>
              </div>

              {chapters.length === 0 && <p className="ai-muted">Chưa có danh sách bài. Bạn có thể tự nhập tên bài bên dưới.</p>}

              <div className="ai-chapters">
                {chapters.map((ch) => {
                  const keys = ch.lessons.map((l) => lessonKey(ch.title, l));
                  const count = keys.filter((k) => selected.has(k)).length;
                  return (
                    <div key={ch.title} className="ai-chapter">
                      <label className="ai-chapter-head">
                        <input
                          type="checkbox"
                          checked={count === keys.length && count > 0}
                          ref={(el) => el && (el.indeterminate = count > 0 && count < keys.length)}
                          onChange={() => toggleChapter(ch)}
                        />
                        <strong>{ch.title}</strong>
                        {ch.semester > 0 && <em>HK{ch.semester === 1 ? "I" : "II"}</em>}
                        {count > 0 && <small>{count} bài</small>}
                      </label>
                      <div className="ai-lessons">
                        {ch.lessons.map((l) => {
                          const key = lessonKey(ch.title, l);
                          return (
                            <label key={key} className={"ai-lesson" + (selected.has(key) ? " selected" : "")}>
                              <input type="checkbox" checked={selected.has(key)} onChange={() => toggleLesson(key)} />
                              {l}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <form className="ai-custom-lesson" onSubmit={addCustomLesson}>
                <input value={customLesson} onChange={(e) => setCustomLesson(e.target.value)} placeholder="Tự nhập tên bài, VD: Bài 5. Dữ liệu và thông tin" maxLength={200} />
                <button type="submit" className="btn btn-light" disabled={!customLesson.trim()}>
                  <Plus size={16} /> Thêm bài
                </button>
              </form>

              <div className="ai-selected-count">
                Đã chọn <b>{selectedLessons.length}</b> bài
              </div>
            </section>
          )}

          {/* ---------- BƯỚC 3 ---------- */}
          {chapters && (
            <section className="shuffle-card">
              <div className="card-heading">
                <div className="step-number">03</div>
                <div>
                  <h2>Cấu hình đề</h2>
                  <p>Tỉ lệ mức độ nhận thức, cấu trúc trắc nghiệm / tự luận và dạng câu trắc nghiệm.</p>
                </div>
              </div>

              <div className="ai-form-grid">
                <label className="form-field">
                  <span>Loại bài kiểm tra</span>
                  <input list="ai-exam-names" value={examName} onChange={(e) => setExamName(e.target.value)} />
                  <datalist id="ai-exam-names">
                    {EXAM_NAMES.map((n) => (
                      <option key={n} value={n} />
                    ))}
                  </datalist>
                </label>
                <label className="form-field">
                  <span>Thời gian làm bài (phút)</span>
                  <input type="number" min={10} max={180} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
                </label>
              </div>

              {/* Tỉ lệ mức độ */}
              <div className="ai-block">
                <div className="ai-block-head">
                  <strong>Tỉ lệ mức độ (theo điểm)</strong>
                  <span className={"ai-sum" + (ratioSum === 100 ? " ok" : "")}>Tổng: {ratioSum}%</span>
                </div>
                <div className="ai-ratio-grid">
                  {LEVEL_KEYS.map((k) => (
                    <label key={k} className={"ai-ratio " + k}>
                      <span>{LEVEL_LABEL[k]}</span>
                      <div className="number-input">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={5}
                          value={ratios[k]}
                          onChange={(e) => setRatios({ ...ratios, [k]: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                        />
                        <span>%</span>
                      </div>
                    </label>
                  ))}
                </div>
                <div className="ai-presets">
                  {RATIO_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      className={"as-chip" + (LEVEL_KEYS.every((k) => ratios[k] === p.value[k]) ? " selected" : "")}
                      onClick={() => setRatios(p.value)}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cấu trúc đề */}
              <div className="ai-block">
                <div className="ai-block-head">
                  <strong>Cấu trúc đề</strong>
                </div>
                <div className="ai-structure">
                  {[
                    { value: 70, label: "70% trắc nghiệm – 30% tự luận" },
                    { value: 100, label: "100% trắc nghiệm" },
                  ].map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      className={"ai-program" + (objectivePercent === o.value ? " active" : "")}
                      onClick={() => setObjectivePercent(o.value)}
                    >
                      <strong>{o.label}</strong>
                    </button>
                  ))}
                  <label className={"ai-program ai-structure-custom" + (![70, 100].includes(objectivePercent) ? " active" : "")}>
                    <strong>Tuỳ chỉnh</strong>
                    <select value={objectivePercent} onChange={(e) => setObjectivePercent(Number(e.target.value))}>
                      {[30, 40, 50, 60, 70, 80, 90, 100].map((v) => (
                        <option key={v} value={v}>
                          {v}% TN – {100 - v}% TL
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              {/* Dạng trắc nghiệm */}
              <div className="ai-block">
                <div className="ai-block-head">
                  <strong>Trong phần trắc nghiệm</strong>
                  <span className="ai-muted">
                    Nhiều lựa chọn {mcPercent}% · Đúng/Sai {100 - mcPercent}%
                  </span>
                </div>
                <input
                  type="range"
                  className="ai-range"
                  min={0}
                  max={100}
                  step={5}
                  value={mcPercent}
                  onChange={(e) => setMcPercent(Number(e.target.value))}
                  aria-label="Tỉ lệ câu nhiều lựa chọn"
                />
                <div className="ai-presets">
                  {[100, 75, 70, 60, 50].map((v) => (
                    <button key={v} type="button" className={"as-chip" + (mcPercent === v ? " selected" : "")} onClick={() => setMcPercent(v)}>
                      {v === 100 ? "Chỉ nhiều lựa chọn" : `${v}% – ${100 - v}%`}
                    </button>
                  ))}
                </div>
                <div className="ai-form-grid">
                  <label className="form-field">
                    <span>Điểm mỗi câu nhiều lựa chọn</span>
                    <select value={mcPoints} onChange={(e) => setMcPoints(Number(e.target.value))}>
                      <option value={0.25}>0,25 điểm</option>
                      <option value={0.5}>0,5 điểm</option>
                      <option value={1}>1 điểm</option>
                    </select>
                  </label>
                  {objectivePercent < 100 && (
                    <label className="form-field">
                      <span>Số câu tự luận</span>
                      <input type="number" min={1} max={8} value={essayCount} onChange={(e) => setEssayCount(Math.max(1, Math.min(8, Number(e.target.value) || 1)))} />
                    </label>
                  )}
                </div>
              </div>

              <label className="form-field">
                <span>Yêu cầu thêm cho AI (không bắt buộc)</span>
                <textarea
                  rows={3}
                  maxLength={1500}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="VD: Ưu tiên câu hỏi gắn thực tế địa phương; câu tự luận có 1 câu thực hành..."
                />
              </label>

              {/* Xem trước */}
              <div className="ai-preview">
                <div>
                  <span>Nhiều lựa chọn</span>
                  <strong>{counts.mc} câu</strong>
                  <small>{counts.mc ? `${fmtPoint(mcPoints)} đ/câu · ${fmtPoint(counts.mc * mcPoints)} điểm` : "—"}</small>
                </div>
                <div>
                  <span>Đúng / Sai</span>
                  <strong>{counts.tf} câu</strong>
                  <small>{counts.tf ? `4 ý/câu · ${counts.tf} điểm` : "—"}</small>
                </div>
                <div>
                  <span>Tự luận</span>
                  <strong>{counts.essay} câu</strong>
                  <small>{counts.essay ? `${fmtPoint(counts.essayPoints)} điểm` : "—"}</small>
                </div>
                <div>
                  <span>Bài đã chọn</span>
                  <strong>{selectedLessons.length}</strong>
                  <small>{programInfo.label}</small>
                </div>
              </div>

              <div className="config-actions">
                <div>
                  <span className="config-note-icon">i</span>
                  <span>AI soạn trong khoảng 1–2 phút. Hãy đọc lại đề trước khi sử dụng.</span>
                </div>
                <button type="button" className="btn btn-primary" onClick={generate} disabled={generating || left === 0 || !selectedLessons.length || ratioSum !== 100}>
                  <Wand2 size={18} />
                  {generating ? "Đang tạo đề..." : "Tạo ma trận, đặc tả & đề"}
                </button>
              </div>
            </section>
          )}
        </>
      )}

      {generating && (
        <div className="modal-backdrop">
          <div className="modal ai-generating">
            <div className="ai-spinner">
              <Sparkles size={20} />
            </div>
            <strong>AI đang soạn đề...</strong>
            <span>{STAGES[stage]}</span>
            <small>Vui lòng không đóng trang (khoảng 1–2 phút).</small>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================= Lịch sử ================= */

function HistoryList({ history, onOpen, onRemove }) {
  if (history === null) return <p className="ai-muted">Đang tải...</p>;
  if (!history.length) {
    return (
      <div className="as-empty">
        <span>
          <FolderClock size={34} />
        </span>
        <strong>Chưa có đề nào được tạo</strong>
      </div>
    );
  }
  return (
    <div className="ai-history">
      {history.map((h) => (
        <div key={h.id} className="ai-history-item">
          <button type="button" className="ai-history-main" onClick={() => onOpen(h.id)}>
            <strong>{h.title}</strong>
            <small>
              {PROGRAMS.find((p) => p.value === h.level)?.label} · {h.subject} {h.grade} · {h.questionCount} câu · {h.duration} phút ·{" "}
              {new Date(h.createdAt).toLocaleString("vi-VN")}
            </small>
          </button>
          <span className="ai-history-icon">
            <BookOpen size={18} />
          </span>
          <button type="button" className="btn btn-sm btn-danger" onClick={() => onRemove(h)} title="Xoá đề">
            <Trash2 size={14} /> Xoá
          </button>
        </div>
      ))}
    </div>
  );
}

/* ================= Kết quả ================= */

function ExamResult({ exam, schoolName, onNew, onUseForShuffle }) {
  const [tab, setTab] = useState("matrix");
  const [exporting, setExporting] = useState(false);
  const matrix = useMemo(() => buildMatrix(exam), [exam]);
  const percents = levelPercents(matrix.levelPoints);
  const c = exam.config;

  async function exportWord(kind) {
    setExporting(true);
    try {
      await downloadAiExamWord(exam, kind, schoolName);
    } finally {
      setExporting(false);
    }
  }

  const canShuffle = exam.mcQuestions.length + exam.tfQuestions.length > 0;

  return (
    <section className="shuffle-card ai-result">
      <div className="ai-result-head">
        <div>
          <div className="header-eyebrow">ĐỀ DO AI SOẠN</div>
          <h2>{exam.title}</h2>
          <p>
            {PROGRAMS.find((p) => p.value === c.level)?.label} · {c.subject} {c.grade} · {c.bookSeries} · {c.duration} phút ·{" "}
            {c.lessons.length} bài
          </p>
        </div>
        <button type="button" className="btn btn-light" onClick={onNew}>
          <Sparkles size={16} /> Tạo đề khác
        </button>
      </div>

      {exam.warnings?.length > 0 && (
        <div className="ai-warnings">
          {exam.warnings.map((w) => (
            <span key={w}>
              <TriangleAlert size={14} /> {w}
            </span>
          ))}
        </div>
      )}

      <div className="ai-level-bars">
        {LEVEL_KEYS.map((k) => (
          <div key={k} className={"ai-level " + k}>
            <span>{LEVEL_LABEL[k]}</span>
            <strong>{fmtPoint(percents[k])}%</strong>
            <small>yêu cầu {c.ratios[k]}%</small>
          </div>
        ))}
      </div>

      <div className="ai-actions">
        <button type="button" className="btn btn-primary" onClick={() => exportWord("all")} disabled={exporting}>
          <Download size={17} />
          {exporting ? "Đang xuất..." : "Tải Word (ma trận + đặc tả + đề + đáp án)"}
        </button>
        <button type="button" className="btn btn-light" onClick={() => exportWord("matrix")} disabled={exporting}>
          Ma trận
        </button>
        <button type="button" className="btn btn-light" onClick={() => exportWord("spec")} disabled={exporting}>
          Bản đặc tả
        </button>
        <button type="button" className="btn btn-light" onClick={() => exportWord("exam")} disabled={exporting}>
          Đề & đáp án
        </button>
        {canShuffle && onUseForShuffle && (
          <button
            type="button"
            className="btn btn-light ai-to-shuffle"
            onClick={() => onUseForShuffle(toShuffleQuestions(exam), exam.title)}
            title="Đưa phần trắc nghiệm sang công cụ Trộn đề để tạo nhiều mã đề"
          >
            <Shuffle size={16} /> Trộn đề từ đề này
          </button>
        )}
      </div>

      <div className="tabs ai-result-tabs">
        {[
          ["matrix", "Ma trận", ArrowLeftRight],
          ["spec", "Bản đặc tả", ListChecks],
          ["exam", "Đề kiểm tra", FileText],
          ["answers", "Đáp án", BookOpen],
        ].map(([k, label, Icon]) => (
          <button key={k} type="button" className={"tab" + (tab === k ? " active" : "")} onClick={() => setTab(k)}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {tab === "matrix" && <MatrixView exam={exam} matrix={matrix} />}
      {tab === "spec" && <SpecView exam={exam} matrix={matrix} />}
      {tab === "exam" && <ExamView exam={exam} />}
      {tab === "answers" && <AnswerView exam={exam} />}
    </section>
  );
}

function MatrixView({ exam, matrix }) {
  const { parts, rows, totals } = matrix;
  const spans = chapterSpans(rows);
  const partPoints = {
    mc: exam.mcQuestions.length * (exam.config.mcPoints || 0.25),
    tf: exam.tfQuestions.length,
    essay: exam.essayQuestions.reduce((s, q) => s + q.points, 0),
  };
  return (
    <div className="ai-table-wrap">
      <table className="ai-table">
        <thead>
          <tr>
            <th rowSpan={3}>TT</th>
            <th rowSpan={3}>Chương / Chủ đề</th>
            <th rowSpan={3}>Nội dung / Đơn vị kiến thức</th>
            <th colSpan={parts.length * 4}>Mức độ đánh giá</th>
            <th colSpan={2} rowSpan={2}>
              Tổng
            </th>
          </tr>
          <tr>
            {parts.map((p) => (
              <th key={p.key} colSpan={4} className={"part-" + p.key}>
                {p.label} <small>(số {p.unit})</small>
              </th>
            ))}
          </tr>
          <tr>
            {parts.map((p) =>
              LEVEL_KEYS.map((k) => (
                <th key={p.key + k} className={"lv " + k}>
                  {LEVEL_SHORT[k]}
                </th>
              )),
            )}
            <th>Số câu/ý</th>
            <th>% điểm</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>{i + 1}</td>
              {spans[i] > 0 && (
                <td rowSpan={spans[i]} className="left">
                  {r.chapter}
                </td>
              )}
              <td className="left">{r.lesson}</td>
              {parts.map((p) => LEVEL_KEYS.map((k) => <td key={p.key + k}>{r.cells[p.key][k] || ""}</td>))}
              <td>
                <b>{r.total}</b>
              </td>
              <td>{fmtPoint(r.points * 10)}%</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3}>Tổng số câu / ý</td>
            {parts.map((p) => LEVEL_KEYS.map((k) => <td key={p.key + k}>{totals.cells[p.key][k] || ""}</td>))}
            <td>{totals.total}</td>
            <td>{fmtPoint(totals.points * 10)}%</td>
          </tr>
          <tr>
            <td colSpan={3}>Tổng điểm từng phần</td>
            {parts.map((p) => (
              <td key={p.key} colSpan={4}>
                {fmtPoint(partPoints[p.key])} điểm
              </td>
            ))}
            <td colSpan={2}>{fmtPoint(totals.points)} điểm</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function SpecView({ exam, matrix }) {
  const { parts, rows } = matrix;
  return (
    <div className="ai-table-wrap">
      <table className="ai-table spec">
        <thead>
          <tr>
            <th rowSpan={2}>TT</th>
            <th rowSpan={2}>Nội dung</th>
            <th rowSpan={2}>Mức độ</th>
            <th rowSpan={2} className="req">
              Yêu cầu cần đạt
            </th>
            <th colSpan={parts.length}>Câu hỏi</th>
          </tr>
          <tr>
            {parts.map((p) => (
              <th key={p.key} className={"part-" + p.key}>
                {p.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const spec = exam.specification.find((s) => s.lesson === i);
            const levels = LEVEL_KEYS.filter((k) => spec?.requirements?.[k] || parts.some((p) => r.refs[p.key][k].length));
            return levels.map((k, j) => (
              <tr key={`${i}-${k}`}>
                {j === 0 && <td rowSpan={levels.length}>{i + 1}</td>}
                {j === 0 && (
                  <td rowSpan={levels.length} className="left">
                    <b>{r.lesson}</b>
                    {r.chapter && <small className="ai-chapter-note">{r.chapter}</small>}
                  </td>
                )}
                <td className={"lv " + k}>{LEVEL_LABEL[k]}</td>
                <td className="left pre">{spec?.requirements?.[k] || ""}</td>
                {parts.map((p) => (
                  <td key={p.key}>{r.refs[p.key][k].join(", ")}</td>
                ))}
              </tr>
            ));
          })}
        </tbody>
      </table>
    </div>
  );
}

const LevelTag = ({ level }) => <span className={"ai-tag " + level}>{LEVEL_SHORT[level]}</span>;

function ExamView({ exam }) {
  const c = exam.config;
  const lessonName = (i) => c.lessons[i]?.title || "Nội dung khác";
  let part = 0;
  const roman = ["I", "II", "III"];
  return (
    <div className="ai-paper">
      <div className="ai-paper-head">
        <strong>{(c.examName || "Đề kiểm tra").toUpperCase()}</strong>
        <span>
          Môn: {c.subject} – Lớp {c.grade} · Thời gian: {c.duration} phút
        </span>
      </div>

      {exam.mcQuestions.length > 0 && (
        <>
          <h4>
            PHẦN {roman[part++]}. TRẮC NGHIỆM NHIỀU LỰA CHỌN ({fmtPoint(exam.mcQuestions.length * c.mcPoints)} điểm)
          </h4>
          {exam.mcQuestions.map((q, i) => (
            <div key={i} className="ai-q">
              <p className="pre">
                <b>Câu {i + 1}.</b> {q.question} <LevelTag level={q.level} />
                <small className="ai-q-lesson">{lessonName(q.lesson)}</small>
              </p>
              <div className="ai-options">
                {q.options.map((o, j) => (
                  <span key={j} className={LETTERS[j] === q.answer ? "correct" : ""}>
                    <b>{LETTERS[j]}.</b> {o}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {exam.tfQuestions.length > 0 && (
        <>
          <h4>
            PHẦN {roman[part++]}. TRẮC NGHIỆM ĐÚNG SAI ({exam.tfQuestions.length} điểm)
          </h4>
          {exam.tfQuestions.map((q, i) => (
            <div key={i} className="ai-q">
              <p className="pre">
                <b>Câu {i + 1}.</b> {q.stem}
                <small className="ai-q-lesson">{lessonName(q.lesson)}</small>
              </p>
              <div className="ai-statements">
                {q.statements.map((s, j) => (
                  <span key={j} className={s.correct ? "correct" : "wrong"}>
                    <b>{TF_LABELS[j]})</b> {s.text} <LevelTag level={s.level} /> <em>{s.correct ? "Đúng" : "Sai"}</em>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {exam.essayQuestions.length > 0 && (
        <>
          <h4>
            PHẦN {roman[part++]}. TỰ LUẬN ({fmtPoint(exam.essayQuestions.reduce((s, q) => s + q.points, 0))} điểm)
          </h4>
          {exam.essayQuestions.map((q, i) => (
            <div key={i} className="ai-q">
              <p className="pre">
                <b>
                  Câu {i + 1} ({fmtPoint(q.points)} điểm).
                </b>{" "}
                {q.question} <LevelTag level={q.level} />
                <small className="ai-q-lesson">{lessonName(q.lesson)}</small>
              </p>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function AnswerView({ exam }) {
  return (
    <div className="ai-paper">
      {exam.mcQuestions.length > 0 && (
        <>
          <h4>Trắc nghiệm nhiều lựa chọn</h4>
          <div className="ai-answer-grid">
            {exam.mcQuestions.map((q, i) => (
              <span key={i}>
                <small>{i + 1}</small>
                <b>{q.answer}</b>
              </span>
            ))}
          </div>
        </>
      )}
      {exam.tfQuestions.length > 0 && (
        <>
          <h4>Trắc nghiệm đúng sai</h4>
          <table className="ai-table ai-tf-key">
            <thead>
              <tr>
                <th>Câu</th>
                {TF_LABELS.map((l) => (
                  <th key={l}>{l})</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {exam.tfQuestions.map((q, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  {q.statements.map((s, j) => (
                    <td key={j} className={s.correct ? "t" : "f"}>
                      {s.correct ? "Đúng" : "Sai"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="ai-muted">Chọn đúng 1 ý: 0,1 điểm; 2 ý: 0,25 điểm; 3 ý: 0,5 điểm; cả 4 ý: 1 điểm.</p>
        </>
      )}
      {exam.essayQuestions.length > 0 && (
        <>
          <h4>Tự luận – hướng dẫn chấm</h4>
          {exam.essayQuestions.map((q, i) => (
            <div key={i} className="ai-q">
              <p>
                <b>
                  Câu {i + 1} ({fmtPoint(q.points)} điểm)
                </b>
              </p>
              <p className="pre ai-guide">{q.answerGuide || "(Không có hướng dẫn)"}</p>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
