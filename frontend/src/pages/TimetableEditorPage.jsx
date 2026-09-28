import { useParams, useNavigate } from "react-router-dom";
import useTimetable from "../hooks/useTimetable";
import TimetableApp from "../TimetableApp";

/* Trang soạn 1 thời khóa biểu: /tkb/:id */
export default function TimetableEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { status, error, initialData, save, reload } = useTimetable(id);
  const backToList = () => navigate("/tkb");

  if (status === "loading") {
    return <div className="center-screen">Đang tải thời khóa biểu...</div>;
  }

  if (status === "error") {
    return (
      <div className="center-screen">
        <p style={{ color: "var(--danger)" }}>{error}</p>
        <div className="btn-row">
          <button className="btn btn-primary" onClick={reload}>
            Thử lại
          </button>
          <button className="btn btn-info" onClick={backToList}>
            Về danh sách
          </button>
        </div>
      </div>
    );
  }

  return (
    <TimetableApp
      key={id}
      initialData={initialData}
      timetableId={id}
      onSave={save}
      onBack={backToList}
    />
  );
}
