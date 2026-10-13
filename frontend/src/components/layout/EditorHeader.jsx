// components/layout/EditorHeader.jsx
import { useState } from "react";
import { STATUS_STAGES } from "../../constants/config";

/* Thanh tiêu đề trình soạn TKB: tên + trạng thái + các thao tác chính */
export default function EditorHeader({
  config,
  stage,
  onChangeStage,
  shareUrl,
  view,
  onBack,
  onCheck,
  onViewResult,
  onEditSteps,
  onExport,
  onSave,
  saving,
}) {
  const [copied, setCopied] = useState(false);

  function copyLink() {
    navigator.clipboard?.writeText(shareUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  const progress = STATUS_STAGES.indexOf(stage) / (STATUS_STAGES.length - 1);

  return (
    <header className="ed-header">
      <button className="ed-back" onClick={onBack} title="Về danh sách thời khóa biểu">
        ←
      </button>

      <div className="ed-title">
        <h1>{config.tenTKB || "Thời khóa biểu chưa đặt tên"}</h1>
        <div className="ed-meta">
          {config.tenTruong && <span>{config.tenTruong}</span>}
          {config.namHoc && <span>Năm học {config.namHoc}</span>}
          <span>
            {config.soNgay} ngày · {config.soBuoi} buổi · {config.soTiet} tiết/buổi
          </span>
          <button className="ed-link" onClick={copyLink} title={shareUrl}>
            {copied ? "✓ Đã sao chép liên kết" : "🔗 Sao chép liên kết"}
          </button>
        </div>
      </div>

      <label className="ed-stage" title="Trạng thái thời khóa biểu">
        <span className="ed-stage-ring" style={{ "--p": progress }} />
        <select value={stage} onChange={(e) => onChangeStage(e.target.value)}>
          {STATUS_STAGES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>

      <div className="ed-actions">
        <button className="btn btn-light" onClick={onCheck}>
          Kiểm tra dữ liệu
        </button>
        {view === "timetable" ? (
          <button className="btn btn-light" onClick={onEditSteps}>
            ✎ Sửa dữ liệu
          </button>
        ) : (
          <button className="btn btn-info" onClick={onViewResult}>
            ▦ Xem thời khóa biểu
          </button>
        )}
        <button className="btn btn-light" onClick={onExport}>
          ⤓ Excel
        </button>
        <button className="btn btn-primary" onClick={onSave} disabled={saving}>
          {saving ? "Đang lưu..." : "Lưu"}
        </button>
      </div>
    </header>
  );
}
