// pages/discipline/DisciplinePage.jsx
import { useCallback, useEffect, useState } from "react";
import { getDisciplineConfig } from "../../api/discipline";
import { useAuth } from "../../context/AuthContext";
import { hasPermission } from "../../utils/permissions";
import SummaryTab from "./SummaryTab";
import ScoreTab from "./ScoreTab";
import ConfigTab from "./ConfigTab";
import LessonLogTab from "./LessonLogTab";

/* Thi đua & Nề nếp
 *  - Tổng hợp : GVCN, BGH, Đoàn TN, cờ đỏ xem điểm tuần / tháng
 *  - Chấm điểm: Cờ đỏ, Đoàn TN
 *  - Cấu hình : Đoàn TN, tài khoản trường
 *  - Sổ đầu bài: mọi người vào được trang — đọc PDF, xuất Excel Thứ / Tiết / Điểm */
export default function DisciplinePage() {
  const { user } = useAuth();
  const canScore = hasPermission(user, "discipline.score");
  const canConfig = hasPermission(user, "discipline.config");

  const tabs = [
    ["summary", "Bảng xếp hạng"],
    ...(canScore ? [["score", "Chấm điểm"]] : []),
    ...(canConfig ? [["config", "Cấu hình chấm"]] : []),
    ["lessonLog", "Sổ đầu bài"],
  ];

  const [tab, setTab] = useState(user?.role === "red_flag" ? "score" : "summary");
  const [config, setConfig] = useState(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);

  const showToast = useCallback((msg, isError = false) => {
    setToast({ msg, error: isError });
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(null), 2600);
  }, []);

  useEffect(() => {
    getDisciplineConfig()
      .then(setConfig)
      .catch((err) => setError(err.message || "Không tải được cấu hình thi đua."));
  }, []);

  return (
    <div className="page dc-page">
      {toast && <div className={"toast" + (toast.error ? " toast-error" : "")}>{toast.msg}</div>}

      <div className="page-head">
        <span className="page-head-icon">🏆</span>
        <div>
          <h2>Thi đua & Nề nếp</h2>
          <p>
            {user?.role === "homeroom_teacher"
              ? `Theo dõi điểm thi đua lớp ${user.className || "chủ nhiệm"} theo tuần, theo tháng.`
              : "Chấm điểm nề nếp hằng ngày, tổng hợp xếp hạng các lớp theo tuần và tháng."}
          </p>
        </div>
      </div>

      {tabs.length > 1 && (
        <div className="tabs">
          {tabs.map(([key, label]) => (
            <button key={key} className={"tab" + (tab === key ? " active" : "")} onClick={() => setTab(key)}>
              {label}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="auth-error">
          <span>!</span>
          <p>{error}</p>
        </div>
      )}

      {!config && !error && tab !== "lessonLog" && <p className="as-empty">Đang tải...</p>}

      {config && tab === "summary" && <SummaryTab user={user} />}
      {config && tab === "score" && <ScoreTab user={user} config={config} showToast={showToast} />}
      {config && tab === "config" && <ConfigTab config={config} onSaved={setConfig} showToast={showToast} />}
      {tab === "lessonLog" && <LessonLogTab user={user} showToast={showToast} />}
    </div>
  );
}
