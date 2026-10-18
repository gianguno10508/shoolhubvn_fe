// components/layout/EditorHeader.jsx
import { useState } from "react";

/* Thanh tiêu đề trình soạn TKB: tên + các thao tác chính */
export default function EditorHeader({
  config,
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
