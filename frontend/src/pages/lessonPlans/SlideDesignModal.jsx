// pages/lessonPlans/SlideDesignModal.jsx — chọn chủ đề (phong cảnh) rồi tạo file PowerPoint từ giáo án
import { useEffect, useMemo, useState } from "react";
import { getLessonPlanQuota, getLessonPlanSlides } from "../../api/lessonPlans";
import { exportLessonPlanPptx } from "../../utils/lessonPlanPptx";
import { SLIDE_THEMES, svgDataUrl, themeById } from "../../utils/slideThemes";

const THEME_KEY = "lp-slide-theme";

function savedTheme() {
  try {
    return themeById(window.localStorage.getItem(THEME_KEY)).id;
  } catch {
    return SLIDE_THEMES[0].id;
  }
}

export default function SlideDesignModal({ plan, onClose, onDone }) {
  const [themeId, setThemeId] = useState(savedTheme);
  const [refresh, setRefresh] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [left, setLeft] = useState(null); // lượt tạo PowerPoint bằng AI còn lại hôm nay

  useEffect(() => {
    getLessonPlanQuota()
      .then((q) => setLeft(Math.max(0, (q.slidesLimit ?? 2) - (q.slidesUsed ?? 0))))
      .catch(() => setLeft(null));
  }, []);
  const needAi = !plan.hasSlides || refresh;
  const blocked = needAi && left === 0;

  // Ảnh xem trước: bìa + slide nội dung của từng chủ đề
  const previews = useMemo(
    () => Object.fromEntries(SLIDE_THEMES.map((t) => [t.id, { cover: svgDataUrl(t.cover()), content: svgDataUrl(t.content()) }])),
    [],
  );
  const theme = themeById(themeId);

  async function create() {
    setBusy(true);
    setError("");
    try {
      window.localStorage.setItem(THEME_KEY, themeId);
    } catch {
      /* trình duyệt chặn lưu — bỏ qua */
    }
    try {
      const { slides, slidesLeft, reused } = await getLessonPlanSlides(plan.id, refresh);
      await exportLessonPlanPptx(plan, slides, themeId);
      onDone(slidesLeft, reused && needAi ? "Hết lượt hôm nay nên dùng lại nội dung slide cũ." : "");
    } catch (err) {
      setError(err.message || "Không tạo được slide trình chiếu.");
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={() => !busy && onClose()}>
      <div className="modal lp-slide-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>🎨 Thiết kế slide trình chiếu</h3>
          <button type="button" className="nt-close" onClick={onClose} disabled={busy} aria-label="Đóng">
            ×
          </button>
        </div>

        <p className="lp-slide-intro">
          Chọn phong cảnh cho bộ slide. AI chuyển giáo án thành slide ngắn gọn cho học sinh, kèm hình minh hoạ, câu hỏi
          trắc nghiệm và lời dẫn cho giáo viên ở phần ghi chú.
        </p>

        <div className="lp-theme-grid" role="radiogroup" aria-label="Chủ đề slide">
          {SLIDE_THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={themeId === t.id}
              className={"lp-theme" + (themeId === t.id ? " active" : "")}
              onClick={() => setThemeId(t.id)}
              disabled={busy}
            >
              <span className="lp-theme-thumb">
                <img src={previews[t.id].cover} alt="" />
                <img className="lp-theme-mini" src={previews[t.id].content} alt="" />
              </span>
              <strong>{t.name}</strong>
              <small>{t.hint}</small>
            </button>
          ))}
        </div>

        {left !== null && (
          <p className={"lp-slide-quota" + (left === 0 ? " out" : "")}>
            Hôm nay còn <b>{left}</b> lượt tạo PowerPoint bằng AI. Đổi phong cảnh với nội dung đã tạo không tốn lượt.
          </p>
        )}

        {plan.hasSlides && (
          <label className="lp-slide-refresh">
            <input
              type="checkbox"
              checked={refresh}
              onChange={(e) => setRefresh(e.target.checked)}
              disabled={busy || left === 0}
            />
            Nhờ AI viết lại nội dung slide mới (tốn 1 lượt)
            <small>Không chọn: dùng lại nội dung đã tạo, chỉ đổi phong cảnh — tải ngay.</small>
          </label>
        )}

        {error && (
          <div className="auth-error">
            <span>!</span>
            <p>{error}</p>
          </div>
        )}

        <div className="btn-row modal-actions">
          <button type="button" className="btn btn-light" onClick={onClose} disabled={busy}>
            Huỷ
          </button>
          <button type="button" className="btn btn-primary lp-ppt-btn" onClick={create} disabled={busy || blocked}>
            {blocked
              ? "Hết lượt hôm nay"
              : busy
              ? !needAi
                ? "Đang dựng file..."
                : "⏳ AI đang thiết kế slide..."
              : `📊 Tạo PowerPoint — ${theme.name}`}
          </button>
        </div>
      </div>
    </div>
  );
}
