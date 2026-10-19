// pages/assignments/AssignmentListPage.jsx
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { listAssignments } from "../../api/assignments";
import { useAuth } from "../../context/AuthContext";
import { hasPermission } from "../../utils/permissions";
import { assignmentState, formatDateTime, formatScore, timeLeft } from "./assignmentUtils";
import GameHub, { gameOf } from "./game/GameHub";

/* Bài tập & Tự chấm — 2 chế độ:
 *  - Cổ điển : danh sách bài tập đã giao (mọi chức danh trừ học sinh / cờ đỏ)
 *  - Trò chơi: vượt chướng ngại vật / ai là triệu phú / bắn zombie từ đề PDF, chơi ngay trên lớp, không lưu điểm;
 *    hoặc “Giao cho học sinh chơi” → bài tập có `game`, học sinh chơi trên web hoặc app và được chấm điểm */
export default function AssignmentListPage() {
  const [params, setParams] = useSearchParams();
  const mode = params.get("mode") === "game" ? "game" : "classic";
  const game = gameOf(params.get("game"));

  return (
    <div className="page as-page">
      <div className="page-head">
        <span className="page-head-icon as-icon">{mode === "game" ? game.icon : "📝"}</span>
        <div>
          <h2>Bài tập & Tự chấm</h2>
          <p>
            {mode === "game"
              ? game.intro
              : "Giao bài trắc nghiệm từ file PDF, học sinh làm trực tuyến và được chấm điểm tự động."}
          </p>
        </div>
        <div className="spacer" />
        {mode === "classic" ? (
          <Link className="btn btn-primary" to="/giao-vien/bai-tap/moi">
            + Giao bài mới
          </Link>
        ) : (
          <Link className="btn btn-primary" to={`/giao-vien/bai-tap/moi?game=${game.key}`} title="Học sinh chơi trên web hoặc app, tự chấm điểm">
            📲 Giao cho học sinh chơi
          </Link>
        )}
      </div>

      <div className="og-mode" role="tablist">
        <button className={mode === "classic" ? "active" : ""} onClick={() => setParams({})}>
          📝 Cổ điển
        </button>
        <button className={mode === "game" ? "active" : ""} onClick={() => setParams({ mode: "game", game: game.key })}>
          🎮 Trò chơi
        </button>
      </div>

      {mode === "game" ? (
        <GameHub game={game.key} onSelect={(key) => setParams({ mode: "game", game: key })} />
      ) : (
        <ClassicList />
      )}
    </div>
  );
}

function ClassicList() {
  const { user } = useAuth();
  const canSeeAll = hasPermission(user, "users.view");

  const [scope, setScope] = useState("mine");
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function load() {
    setLoading(true);
    setError("");
    listAssignments(scope)
      .then(setList)
      .catch((err) => setError(err.message || "Không tải được danh sách bài tập."))
      .finally(() => setLoading(false));
  }

  useEffect(load, [scope]);

  return (
    <>
      {canSeeAll && (
        <div className="tabs">
          <button className={"tab" + (scope === "mine" ? " active" : "")} onClick={() => setScope("mine")}>
            Bài tôi giao
          </button>
          <button className={"tab" + (scope === "all" ? " active" : "")} onClick={() => setScope("all")}>
            Toàn trường
          </button>
        </div>
      )}

      {loading && <p className="as-empty">Đang tải...</p>}

      {!loading && error && (
        <div className="auth-error as-alert">
          <span>!</span>
          <p>
            {error}{" "}
            <button className="link-btn" onClick={load}>
              Thử lại
            </button>
          </p>
        </div>
      )}

      {!loading && !error && list.length === 0 && (
        <div className="as-empty">
          <span>📭</span>
          <strong>Chưa có bài tập nào</strong>
          <p>Bấm “Giao bài mới” để tải đề PDF và giao cho lớp.</p>
        </div>
      )}

      {!loading && !error && list.length > 0 && (
        <div className="as-grid">
          {list.map((a) => {
            const state = assignmentState(a);
            const percent = a.studentCount ? Math.round((a.submittedCount / a.studentCount) * 100) : 0;
            return (
              <Link key={a.id} to={`/giao-vien/bai-tap/${a.id}`} className="as-item">
                <div className="as-item-top">
                  <span className={"as-badge " + state.key}>{state.label}</span>
                  {a.game && <span className="as-game-tag">{gameOf(a.game).icon} {gameOf(a.game).name}</span>}
                  {state.key === "open" && <span className="as-item-left">{timeLeft(a.dueAt)}</span>}
                </div>
                <h3>{a.title}</h3>
                <div className="as-item-classes">
                  {a.classNames.map((n) => (
                    <span key={n}>{n}</span>
                  ))}
                </div>
                <dl className="as-item-meta">
                  <div>
                    <dt>Hạn nộp</dt>
                    <dd>{formatDateTime(a.dueAt)}</dd>
                  </div>
                  <div>
                    <dt>Thời gian</dt>
                    <dd>{a.durationMinutes} phút</dd>
                  </div>
                  <div>
                    <dt>Số câu</dt>
                    <dd>{a.questionCount}</dd>
                  </div>
                  <div>
                    <dt>Điểm TB</dt>
                    <dd>{formatScore(a.averageScore, a.totalPoints)}</dd>
                  </div>
                </dl>
                <div className="as-progress">
                  <div className="as-progress-bar">
                    <span style={{ width: `${percent}%` }} />
                  </div>
                  <small>
                    {a.submittedCount}/{a.studentCount} học sinh đã nộp
                  </small>
                </div>
                {scope === "all" && a.createdBy && (
                  <small className="as-item-owner">Giao bởi {a.createdBy.name || a.createdBy.username}</small>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
