// pages/lessonPlans/LessonPlanListPage.jsx — soạn giáo án mới từ ảnh SGK + danh sách giáo án đã soạn
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { generateLessonPlan, getLessonPlanQuota, listLessonPlans } from "../../api/lessonPlans";
import { formatDateTime } from "../assignments/assignmentUtils";

const SUBJECTS = [
  "Toán", "Ngữ văn", "Tiếng Anh", "Vật lí", "Hoá học", "Sinh học", "Khoa học tự nhiên", "Lịch sử", "Địa lí",
  "Lịch sử và Địa lí", "Giáo dục công dân", "Giáo dục kinh tế và pháp luật", "Tin học", "Công nghệ",
  "Tiếng Việt", "Tự nhiên và Xã hội", "Khoa học", "Đạo đức", "Âm nhạc", "Mĩ thuật",
  "Giáo dục thể chất", "Hoạt động trải nghiệm",
];
const GRADES = Array.from({ length: 12 }, (_, i) => String(i + 1));
const BOOKS = ["Kết nối tri thức với cuộc sống", "Chân trời sáng tạo", "Cánh Diều"];
const SUGGESTIONS = [
  "Thêm trò chơi khởi động",
  "Tăng cường hoạt động nhóm",
  "Có phiếu học tập",
  "Ứng dụng công nghệ thông tin",
  "Phân hoá học sinh khá giỏi / yếu",
  "Thêm câu hỏi trắc nghiệm luyện tập",
];
const STAGES = [
  "Đang đọc ảnh sách giáo khoa...",
  "Đang xác định mục tiêu bài học...",
  "Đang thiết kế hoạt động khởi động...",
  "Đang soạn hoạt động hình thành kiến thức...",
  "Đang soạn phần luyện tập, vận dụng...",
  "Đang hoàn thiện giáo án...",
];
const MAX_SIDE = 1600; // thu nhỏ ảnh trước khi gửi để nhanh và tiết kiệm lượt AI
const MAX_IMAGES_DEFAULT = 30;

const readAsDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

/** Thu nhỏ ảnh (cạnh dài tối đa 1600px) và nén JPEG; ảnh trình duyệt không đọc được thì gửi nguyên bản */
async function prepareImage(file) {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    const url = await readAsDataUrl(blob);
    return { name: file.name, mimeType: "image/jpeg", url };
  } catch {
    const url = await readAsDataUrl(file);
    return { name: file.name, mimeType: file.type || "image/jpeg", url };
  }
}

let nextImageId = 0;

export default function LessonPlanListPage() {
  const navigate = useNavigate();
  const inputRef = useRef(null);

  const [form, setForm] = useState({
    title: "",
    subject: "",
    grade: "",
    bookSeries: BOOKS[0],
    periods: 1,
    notes: "",
    digitalCompetence: false,
  });
  const [images, setImages] = useState([]); // [{ id, name, mimeType, url }]
  const [dragActive, setDragActive] = useState(false);
  const [preparing, setPreparing] = useState(null); // { done, total } khi đang xử lý ảnh
  const [generating, setGenerating] = useState(false);
  const [stage, setStage] = useState(0);
  const [error, setError] = useState("");

  const [quota, setQuota] = useState(null);
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const maxImages = quota?.maxImages || MAX_IMAGES_DEFAULT;

  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  function loadList() {
    setLoading(true);
    setListError("");
    listLessonPlans()
      .then(setList)
      .catch((err) => setListError(err.message || "Không tải được danh sách giáo án."))
      .finally(() => setLoading(false));
    getLessonPlanQuota()
      .then(setQuota)
      .catch(() => {});
  }

  useEffect(loadList, []);

  // Dán ảnh trực tiếp (Ctrl + V)
  useEffect(() => {
    const onPaste = (e) => {
      const files = [...(e.clipboardData?.files || [])].filter((f) => f.type.startsWith("image/"));
      if (files.length) addFiles(files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  });

  // Chữ chạy trong lúc chờ AI
  useEffect(() => {
    if (!generating) return undefined;
    setStage(0);
    const t = window.setInterval(() => setStage((s) => Math.min(s + 1, STAGES.length - 1)), 9000);
    return () => window.clearInterval(t);
  }, [generating]);

  async function addFiles(fileList) {
    const files = [...fileList].filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
    if (!files.length) {
      setError("Chỉ nhận file ảnh (JPG, PNG, WEBP).");
      return;
    }
    const room = maxImages - images.length;
    if (room <= 0) {
      setError(`Tối đa ${maxImages} ảnh cho mỗi giáo án.`);
      return;
    }
    setError(files.length > room ? `Chỉ lấy thêm ${room} ảnh (tối đa ${maxImages} ảnh).` : "");
    // Ảnh chụp màn hình: sắp theo thời điểm chụp rồi theo tên file để đúng thứ tự trang
    const batch = files
      .slice(0, room)
      .sort((a, b) => a.lastModified - b.lastModified || a.name.localeCompare(b.name, undefined, { numeric: true }));
    setPreparing({ done: 0, total: batch.length });
    try {
      for (const file of batch) {
        const img = await prepareImage(file);
        setImages((prev) => [...prev, { ...img, id: ++nextImageId }]);
        setPreparing((p) => ({ ...p, done: p.done + 1 }));
      }
    } catch {
      setError("Không đọc được ảnh, vui lòng thử ảnh khác.");
    } finally {
      setPreparing(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function move(index, delta) {
    setImages((prev) => {
      const next = [...prev];
      const to = index + delta;
      if (to < 0 || to >= next.length) return prev;
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });
  }

  function addSuggestion(text) {
    set("notes", form.notes ? `${form.notes.replace(/\s+$/, "")}\n- ${text}` : `- ${text}`);
  }

  async function handleGenerate() {
    if (!images.length) {
      setError("Vui lòng tải lên ít nhất 1 ảnh trang sách giáo khoa.");
      return;
    }
    setError("");
    setGenerating(true);
    try {
      const plan = await generateLessonPlan({
        ...form,
        images: images.map((img) => ({ mimeType: img.mimeType, data: img.url.split(",")[1] })),
      });
      navigate(`/giao-vien/giao-an/${plan.id}`);
    } catch (err) {
      setError(err.message || "Không soạn được giáo án.");
      setGenerating(false);
      getLessonPlanQuota()
        .then(setQuota)
        .catch(() => {});
    }
  }

  const outOfQuota = quota && quota.used >= quota.limit;

  return (
    <div className="page lp-page">
      <div className="page-head">
        <span className="page-head-icon lp-icon">📖</span>
        <div>
          <h2>Giáo án AI</h2>
          <p>Chụp ảnh các trang sách giáo khoa của bài học, AI sẽ soạn kế hoạch bài dạy theo mẫu Công văn 5512.</p>
        </div>
        <div className="spacer" />
        {quota && (
          <span className={"lp-quota" + (outOfQuota ? " out" : "")} title="Số giáo án đã soạn hôm nay">
            Hôm nay: {quota.used}/{quota.limit} giáo án
          </span>
        )}
      </div>

      {error && (
        <div className="auth-error as-alert">
          <span>!</span>
          <p>{error}</p>
        </div>
      )}

      <section className="as-card">
        <div className="as-card-head">
          <span className="as-step">1</span>
          <div>
            <h3>Ảnh sách giáo khoa</h3>
            <p>
              Tải lên tất cả ảnh chụp / chụp màn hình của bài học (tối đa {maxImages} ảnh), có thể chọn nhiều ảnh một lúc.
              Ảnh được tự sắp theo thời điểm chụp, kiểm tra lại thứ tự trước khi soạn. Có thể dán ảnh bằng{" "}
              <b>Ctrl + V</b>. Ảnh rõ chữ, không bị cắt mất nội dung thì giáo án càng bám sát SGK.
            </p>
          </div>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => addFiles(e.target.files || [])}
        />

        {images.length > 0 && (
          <>
          <div className="lp-thumbs-head">
            <strong>
              {images.length}/{maxImages} ảnh
            </strong>
            <span>Kiểm tra thứ tự trang, dùng ← → để đổi chỗ</span>
            <div className="spacer" />
            <button
              type="button"
              className="btn btn-sm btn-light"
              onClick={() => window.confirm("Bỏ tất cả ảnh đã chọn?") && setImages([])}
              disabled={generating || !!preparing}
            >
              Xoá tất cả
            </button>
          </div>
          <ol className="lp-thumbs">
            {images.map((img, i) => (
              <li key={img.id}>
                <img src={img.url} alt={`Trang ${i + 1}`} />
                <span className="lp-thumb-num">{i + 1}</span>
                <div className="lp-thumb-actions">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0 || generating} title="Lên trước">
                    ←
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === images.length - 1 || generating}
                    title="Ra sau"
                  >
                    →
                  </button>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => setImages((prev) => prev.filter((x) => x.id !== img.id))}
                    disabled={generating}
                    title="Bỏ ảnh"
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ol>
          </>
        )}

        {images.length < maxImages && (
          <div
            className={"as-dropzone" + (dragActive ? " drag-active" : "") + (images.length ? " lp-dropzone-small" : "")}
            onClick={() => !generating && inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              if (!generating) addFiles(e.dataTransfer.files || []);
            }}
          >
            <span className="as-dropzone-icon">{preparing ? <span className="spin">↻</span> : "📷"}</span>
            <strong>
              {preparing
                ? `Đang xử lý ảnh ${preparing.done}/${preparing.total}...`
                : images.length
                  ? "Thêm ảnh tiếp theo"
                  : "Kéo thả nhiều ảnh cùng lúc vào đây"}
            </strong>
            <span>
              hoặc <b>chọn ảnh từ máy</b> — giữ Ctrl hoặc Shift (hoặc Ctrl + A trong thư mục) để chọn nhiều ảnh một lúc
            </span>
          </div>
        )}
      </section>

      <section className="as-card">
        <div className="as-card-head">
          <span className="as-step">2</span>
          <div>
            <h3>Thông tin bài dạy</h3>
            <p>Không bắt buộc — để trống thì AI tự nhận biết từ ảnh. Điền đủ giúp giáo án chính xác hơn.</p>
          </div>
        </div>

        <div className="as-form-grid">
          <label className="field">
            <span>Môn học</span>
            <input
              list="lp-subjects"
              value={form.subject}
              onChange={(e) => set("subject", e.target.value)}
              placeholder="VD: Toán"
            />
            <datalist id="lp-subjects">
              {SUBJECTS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </label>
          <label className="field">
            <span>Lớp</span>
            <select value={form.grade} onChange={(e) => set("grade", e.target.value)}>
              <option value="">— Chọn lớp —</option>
              {GRADES.map((g) => (
                <option key={g} value={g}>
                  Lớp {g}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Bộ sách</span>
            <input list="lp-books" value={form.bookSeries} onChange={(e) => set("bookSeries", e.target.value)} />
            <datalist id="lp-books">
              {BOOKS.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
          </label>
          <label className="field">
            <span>Số tiết</span>
            <select value={form.periods} onChange={(e) => set("periods", Number(e.target.value))}>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n} tiết
                </option>
              ))}
            </select>
          </label>
          <label className="field lp-span-2">
            <span>Tên bài (không bắt buộc)</span>
            <input
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="VD: Bài 3. Phép cộng phân số"
              maxLength={200}
            />
          </label>
          <label className="field lp-span-2">
            <span>Yêu cầu thêm cho AI (không bắt buộc)</span>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="VD: Lớp có nhiều học sinh yếu, cần hoạt động đơn giản, trực quan"
              maxLength={2000}
            />
          </label>
        </div>
        <label className={"as-switch lp-digital" + (form.digitalCompetence ? " on" : "")}>
          <input
            type="checkbox"
            checked={form.digitalCompetence}
            onChange={(e) => set("digitalCompetence", e.target.checked)}
          />
          <span className="as-switch-track" />
          <span>
            <strong>💻 Tích hợp năng lực số</strong>
            <small>
              AI chọn mã phù hợp trong <b>Bảng mã năng lực số THPT (lớp 10, 11, 12 — NC1)</b>, ghi vào mục tiêu và từng
              hoạt động, ví dụ “(NLS: 1.1NC1b)”.
              {form.grade && Number(form.grade) < 10 && (
                <em className="lp-warn"> Lưu ý: bảng mã dành cho lớp 10–12, lớp {form.grade} có thể chưa phù hợp.</em>
              )}
            </small>
          </span>
        </label>

        <div className="lp-chips">
          {SUGGESTIONS.map((s) => (
            <button key={s} type="button" onClick={() => addSuggestion(s)}>
              + {s}
            </button>
          ))}
        </div>
      </section>

      <div className="as-submit-bar">
        <span>
          {images.length ? `${images.length} ảnh` : "Chưa có ảnh"}
          {form.digitalCompetence && " · có năng lực số"} · theo mẫu Phụ lục IV — Công văn 5512 · có thể sửa
          và xuất Word sau khi soạn
        </span>
        <button
          className="btn btn-primary"
          type="button"
          onClick={handleGenerate}
          disabled={!images.length || generating || !!preparing || outOfQuota}
        >
          {generating ? (
            <>
              <span className="spin">↻</span> Đang soạn...
            </>
          ) : (
            "✨ Soạn giáo án"
          )}
        </button>
      </div>

      {generating && (
        <div className="lp-generating" role="status">
          <span className="lp-generating-icon">📝</span>
          <strong>{STAGES[stage]}</strong>
          <small>Thường mất 30 giây – 2 phút tuỳ số ảnh. Vui lòng không đóng trang.</small>
        </div>
      )}

      <section className="lp-saved">
        <h3>Giáo án đã soạn</h3>
        {loading && <p className="as-empty small">Đang tải...</p>}
        {!loading && listError && (
          <div className="auth-error as-alert">
            <span>!</span>
            <p>
              {listError}{" "}
              <button className="link-btn" onClick={loadList}>
                Thử lại
              </button>
            </p>
          </div>
        )}
        {!loading && !listError && list.length === 0 && (
          <div className="as-empty small">
            <span>📭</span>
            <strong>Chưa có giáo án nào</strong>
            <p>Tải ảnh sách giáo khoa lên và bấm “Soạn giáo án”.</p>
          </div>
        )}
        {!loading && list.length > 0 && (
          <div className="lp-grid">
            {list.map((p) => (
              <Link key={p.id} to={`/giao-vien/giao-an/${p.id}`} className="lp-item">
                <h4>{p.title}</h4>
                <div className="lp-tags">
                  {p.subject && <span>{p.subject}</span>}
                  {p.grade && <span>Lớp {p.grade}</span>}
                  <span>{p.periods} tiết</span>
                  {p.digitalCompetence && <span className="nls">Năng lực số</span>}
                </div>
                <small>
                  {p.bookSeries && `${p.bookSeries} · `}
                  {formatDateTime(p.createdAt)}
                </small>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
