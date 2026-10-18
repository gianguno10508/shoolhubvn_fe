// pages/lessonPlans/LessonPlanDetailPage.jsx — xem, sửa, xuất Word / PowerPoint giáo án
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { deleteLessonPlan, getLessonPlan, updateLessonPlan } from "../../api/lessonPlans";
import { exportLessonPlanDocx } from "../../utils/lessonPlanDocx";
import { plainText, parseMarkdown } from "../../utils/markdownBlocks";
import { formatDateTime } from "../assignments/assignmentUtils";
import MarkdownView from "./MarkdownView";
import SlideDesignModal from "./SlideDesignModal";

/** Văn bản thuần để dán vào nơi khác (bỏ ký hiệu Markdown) */
function toPlain(markdown) {
  return parseMarkdown(markdown)
    .map((b) => {
      if (b.type === "heading" || b.type === "para") return plainText(b.text);
      if (b.type === "list") return b.items.map((i) => `${"  ".repeat(i.level)}${i.marker || "-"} ${plainText(i.text)}`).join("\n");
      if (b.type === "table") return [b.header, ...b.rows].map((r) => r.map(plainText).join("\t")).join("\n");
      return "";
    })
    .join("\n\n");
}

export default function LessonPlanDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ title: "", content: "" });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [designing, setDesigning] = useState(false);

  useEffect(() => {
    setError("");
    getLessonPlan(id)
      .then(setPlan)
      .catch((err) => setError(err.message || "Không tải được giáo án."));
  }, [id]);

  useEffect(() => {
    if (!notice) return undefined;
    const t = window.setTimeout(() => setNotice(""), 2500);
    return () => window.clearTimeout(t);
  }, [notice]);

  // Cảnh báo khi rời trang lúc đang sửa dở
  const dirty = editing && plan && (draft.title !== plan.title || draft.content !== plan.content);
  useEffect(() => {
    if (!dirty) return undefined;
    const onLeave = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  function startEdit() {
    setDraft({ title: plan.title, content: plan.content });
    setEditing(true);
  }

  function cancelEdit() {
    if (dirty && !window.confirm("Bỏ các thay đổi chưa lưu?")) return;
    setEditing(false);
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      setPlan(await updateLessonPlan(id, draft));
      setEditing(false);
      setNotice("Đã lưu giáo án.");
    } catch (err) {
      setError(err.message || "Không lưu được giáo án.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Xoá giáo án “${plan.title}”?`)) return;
    try {
      await deleteLessonPlan(id);
      navigate("/giao-vien/giao-an");
    } catch (err) {
      setError(err.message || "Không xoá được giáo án.");
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(toPlain(editing ? draft.content : plan.content));
      setNotice("Đã sao chép nội dung giáo án.");
    } catch {
      setError("Trình duyệt không cho sao chép, hãy dùng nút Tải Word.");
    }
  }

  async function exportWord() {
    try {
      await exportLessonPlanDocx(editing ? draft : plan);
    } catch {
      setError("Không xuất được file Word.");
    }
  }

  if (!plan) {
    return (
      <div className="page lp-page">
        {error ? (
          <div className="auth-error as-alert">
            <span>!</span>
            <p>
              {error} <Link to="/giao-vien/giao-an">Quay lại danh sách</Link>
            </p>
          </div>
        ) : (
          <p className="as-empty">Đang tải...</p>
        )}
      </div>
    );
  }

  return (
    <div className="page lp-page">
      <div className="page-head lp-detail-head">
        <Link to="/giao-vien/giao-an" className="btn btn-sm btn-light">
          ← Danh sách
        </Link>
        <div className="lp-detail-title">
          {editing ? (
            <input
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              maxLength={200}
              aria-label="Tên giáo án"
            />
          ) : (
            <h2>{plan.title}</h2>
          )}
          <p>
            {[
              plan.subject,
              plan.grade && `Lớp ${plan.grade}`,
              plan.bookSeries,
              `${plan.periods} tiết`,
              plan.digitalCompetence && "có năng lực số",
            ]
              .filter(Boolean)
              .join(" · ")}
            {" · "}soạn lúc {formatDateTime(plan.createdAt)} từ {plan.imageCount} ảnh
          </p>
        </div>
        <div className="spacer" />
        <div className="lp-actions">
          {editing ? (
            <>
              <button className="btn btn-sm btn-light" type="button" onClick={cancelEdit} disabled={saving}>
                Huỷ
              </button>
              <button className="btn btn-sm btn-primary" type="button" onClick={save} disabled={saving || !draft.title.trim()}>
                {saving ? "Đang lưu..." : "💾 Lưu"}
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-sm btn-light" type="button" onClick={handleDelete}>
                🗑 Xoá
              </button>
              <button className="btn btn-sm btn-light" type="button" onClick={copy}>
                📋 Sao chép
              </button>
              <button className="btn btn-sm btn-light" type="button" onClick={startEdit}>
                ✏️ Sửa
              </button>
              <button className="btn btn-sm btn-primary" type="button" onClick={exportWord}>
                ⬇ Tải Word
              </button>
              <button
                className="btn btn-sm btn-primary lp-ppt-btn"
                type="button"
                onClick={() => setDesigning(true)}
                title="Chọn phong cảnh, AI chuyển giáo án thành bộ slide trình chiếu"
              >
                📊 Tạo PowerPoint
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="auth-error as-alert">
          <span>!</span>
          <p>{error}</p>
        </div>
      )}
      {notice && <div className="lp-notice">✓ {notice}</div>}

      {designing && (
        <SlideDesignModal
          plan={plan}
          onClose={() => setDesigning(false)}
          onDone={(slidesLeft, note) => {
            setDesigning(false);
            setPlan((p) => ({ ...p, hasSlides: true }));
            setNotice(
              `Đã tạo file PowerPoint trình chiếu. ${note || `Hôm nay còn ${slidesLeft} lượt tạo bằng AI.`}`,
            );
          }}
        />
      )}

      {editing ? (
        <div className="lp-editor">
          <div className="lp-editor-pane">
            <small>
              Soạn thảo — <b># Tiêu đề</b>, <b>**đậm**</b>, <b>- gạch đầu dòng</b>, bảng <b>| cột | cột |</b>
            </small>
            <textarea
              value={draft.content}
              onChange={(e) => setDraft((d) => ({ ...d, content: e.target.value }))}
              spellCheck={false}
            />
          </div>
          <div className="lp-editor-pane">
            <small>Xem trước</small>
            <div className="lp-paper scroll">
              <MarkdownView source={draft.content} />
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="lp-paper">
            <MarkdownView source={plan.content} />
          </div>
          <p className="lp-disclaimer">
            ⚠️ Giáo án do AI soạn, Thầy/Cô vui lòng đọc lại và chỉnh sửa cho phù hợp với lớp học trước khi sử dụng.
          </p>
        </>
      )}
    </div>
  );
}
