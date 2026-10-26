// pages/teacher/namePicker/NamePickerPage.jsx — Gọi tên học sinh ngẫu nhiên bằng các trò chơi vui nhộn
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import { listSchoolUsers } from "../../../api/school";
import { canAccessSchoolUsers } from "../../../utils/permissions";
import { playSound, readMuted, writeMuted } from "../../assignments/game/gameSound";
import { GAMES } from "./games";
import { loadStore, newId, parseNames, readNamesFromSheet, saveStore } from "./pickerUtils";

const HISTORY_MAX = 60;

/** Bỏ trùng tên bằng cách thêm (2), (3)... để mỗi tên là duy nhất */
function uniqueNames(names) {
  const seen = new Map();
  return names.map((name) => {
    const count = (seen.get(name) || 0) + 1;
    seen.set(name, count);
    return count > 1 ? `${name} (${count})` : name;
  });
}

const lastWord = (name) => name.split(/\s+/).pop();
const byVietnameseName = (a, b) => lastWord(a).localeCompare(lastWord(b), "vi") || a.localeCompare(b, "vi");

const timeOf = (at) => new Date(at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });

/* =========================================================
   FORM DANH SÁCH HỌC SINH
========================================================= */

function SchoolImport({ onPick }) {
  const [state, setState] = useState({ loading: true, error: "", classes: [] });
  const [classKey, setClassKey] = useState("");

  useEffect(() => {
    listSchoolUsers()
      .then((users) => {
        const map = new Map();
        users
          .filter((u) => (u.role === "student" || u.role === "red_flag") && u.status !== "locked")
          .forEach((u) => {
            const key = String(u.classId || "none");
            if (!map.has(key)) map.set(key, { key, name: u.className || "Chưa xếp lớp", students: [] });
            map.get(key).students.push(u.name);
          });
        const classes = [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "vi", { numeric: true }));
        setState({ loading: false, error: "", classes });
        if (classes[0]) setClassKey(classes[0].key);
      })
      .catch((err) => setState({ loading: false, error: err.message || "Không tải được danh sách.", classes: [] }));
  }, []);

  if (state.loading) return <p className="np-muted">Đang tải danh sách học sinh của trường...</p>;
  if (state.error) return <p className="np-error">⚠ {state.error}</p>;
  if (!state.classes.length) return <p className="np-muted">Trường chưa có tài khoản học sinh nào.</p>;

  const cls = state.classes.find((c) => c.key === classKey);
  return (
    <div className="np-school-import">
      <select value={classKey} onChange={(e) => setClassKey(e.target.value)}>
        {state.classes.map((c) => (
          <option key={c.key} value={c.key}>
            Lớp {c.name} ({c.students.length} HS)
          </option>
        ))}
      </select>
      <button
        type="button"
        className="btn btn-sm btn-light"
        disabled={!cls}
        onClick={() => onPick(`Lớp ${cls.name}`, [...cls.students].sort(byVietnameseName))}
      >
        Lấy danh sách
      </button>
    </div>
  );
}

function ListEditor({ initial, canImportSchool, onSave, onCancel, onDelete }) {
  const [name, setName] = useState(initial?.name || "");
  const [text, setText] = useState(initial ? initial.students.join("\n") : "");
  const [msg, setMsg] = useState("");
  const [showSchool, setShowSchool] = useState(false);
  const fileRef = useRef(null);
  const names = useMemo(() => parseNames(text), [text]);

  const importFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const list = await readNamesFromSheet(file);
      if (!list.length) return setMsg("Không tìm thấy cột họ tên trong file.");
      setText(list.join("\n"));
      if (!name.trim()) setName(file.name.replace(/\.[^.]+$/, ""));
      setMsg(`Đã nhập ${list.length} học sinh từ file ${file.name}.`);
    } catch {
      setMsg("Không đọc được file. Hãy dùng file Excel (.xlsx, .xls) hoặc .csv.");
    }
  };

  const save = () => {
    if (!names.length) return setMsg("Danh sách đang trống — mỗi dòng nhập tên một học sinh.");
    onSave(name.trim() || "Lớp của tôi", uniqueNames(names));
  };

  return (
    <div className="np-editor">
      <div className="np-editor-head">
        <h3>{initial ? "✏️ Sửa danh sách" : "📝 Tạo danh sách học sinh"}</h3>
        <p>Mỗi dòng một học sinh. Có thể dán thẳng từ Excel / Word, số thứ tự đầu dòng sẽ tự bỏ.</p>
      </div>

      <label className="field">
        <span>Tên danh sách</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Lớp 10A1 – Toán" maxLength={60} />
      </label>

      <label className="field">
        <span>
          Danh sách học sinh <b className="np-count">{names.length} bạn</b>
        </span>
        <textarea
          className="np-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"1. Nguyễn Văn An\n2. Trần Thị Bình\n3. Lê Hoàng Cường\n..."}
          rows={12}
          spellCheck={false}
        />
      </label>

      <div className="np-editor-tools">
        <button type="button" className="btn btn-sm btn-light" onClick={() => fileRef.current?.click()}>
          📥 Nhập từ Excel / CSV
        </button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={importFile} />
        {canImportSchool && (
          <button type="button" className="btn btn-sm btn-light" onClick={() => setShowSchool((v) => !v)}>
            🏫 Lấy từ tài khoản trường
          </button>
        )}
        {text && (
          <button type="button" className="btn btn-sm btn-light" onClick={() => setText([...names].sort(byVietnameseName).join("\n"))}>
            🔤 Sắp xếp A→Z
          </button>
        )}
      </div>
      {showSchool && (
        <SchoolImport
          onPick={(className, list) => {
            setText(list.join("\n"));
            if (!name.trim()) setName(className);
            setShowSchool(false);
            setMsg(`Đã lấy ${list.length} học sinh ${className}.`);
          }}
        />
      )}
      {msg && <p className="np-muted">{msg}</p>}

      <div className="np-editor-actions">
        {onDelete && (
          <button type="button" className="btn btn-sm btn-danger" onClick={onDelete}>
            Xóa danh sách
          </button>
        )}
        <span className="spacer" />
        {onCancel && (
          <button type="button" className="btn btn-light" onClick={onCancel}>
            Hủy
          </button>
        )}
        <button type="button" className="btn btn-primary" onClick={save}>
          💾 Lưu danh sách
        </button>
      </div>
    </div>
  );
}

/* =========================================================
   KẾT QUẢ
========================================================= */

const CONFETTI = Array.from({ length: 70 }, (_, i) => ({
  left: Math.random() * 100,
  delay: Math.random() * 0.6,
  dur: 2.2 + Math.random() * 1.8,
  color: ["#f43f5e", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7", "#facc15"][i % 6],
  size: 6 + Math.random() * 7,
  rot: Math.random() * 360,
}));

const CHEERS = ["Xin mời", "Người may mắn là", "Chúc mừng", "Đến lượt", "Xin chúc mừng bạn"];

function ResultOverlay({ result, stars, onStar, onAbsent, onClose }) {
  const cheer = useMemo(() => CHEERS[Math.floor(Math.random() * CHEERS.length)], []);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" || e.key === "Enter") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="np-result-backdrop" onClick={onClose}>
      <div className="np-confetti" aria-hidden="true">
        {CONFETTI.map((c, i) => (
          <span
            key={i}
            style={{
              left: `${c.left}%`,
              width: c.size,
              height: c.size * 0.45,
              background: c.color,
              animationDelay: `${c.delay}s`,
              animationDuration: `${c.dur}s`,
              transform: `rotate(${c.rot}deg)`,
            }}
          />
        ))}
      </div>
      <div className="np-result" onClick={(e) => e.stopPropagation()}>
        <div className="np-result-burst" aria-hidden="true">🎉</div>
        <p className="np-result-cheer">{cheer}</p>
        <h2 className="np-result-name">{result.name}</h2>
        <p className="np-result-no">Số thứ tự {result.no}</p>
        {stars > 0 && <div className="np-result-stars">{"⭐".repeat(Math.min(stars, 10))}{stars > 10 ? ` ×${stars}` : ""}</div>}
        <div className="np-result-actions">
          <button type="button" className="btn btn-warn" onClick={onStar}>⭐ Cộng điểm</button>
          <button type="button" className="btn btn-light" onClick={onAbsent}>🙅 Vắng / gọi bạn khác</button>
          <button type="button" className="btn btn-primary" onClick={onClose}>Tiếp tục ➜</button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   TRANG CHÍNH
========================================================= */

export default function NamePickerPage() {
  const { user } = useAuth();
  const [store, setStore] = useState(loadStore);
  const [editing, setEditing] = useState(null); // null | "new" | "edit"
  const [gameId, setGameId] = useState(() => store.gameId || GAMES[0].id);
  const [noRepeat, setNoRepeat] = useState(store.noRepeat !== false);
  const [muted, setMuted] = useState(readMuted);
  const [round, setRound] = useState(0);
  const [result, setResult] = useState(null);
  const [fullscreen, setFullscreen] = useState(false);
  const stageRef = useRef(null);
  const memo = useRef({}).current;
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  const list = store.lists.find((l) => l.id === store.activeId) || store.lists[0] || null;
  const game = GAMES.find((g) => g.id === gameId) || GAMES[0];

  useEffect(() => saveStore({ ...store, gameId, noRepeat }), [store, gameId, noRepeat]);

  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const updateList = useCallback(
    (fn) => setStore((s) => ({ ...s, lists: s.lists.map((l) => (l.id === (s.activeId || s.lists[0]?.id) ? fn(l) : l)) })),
    [],
  );

  const students = list?.students;
  const everyone = useMemo(() => (students || []).map((name, i) => ({ id: i, name, no: i + 1 })), [students]);
  const calledSet = new Set(list?.called || []);
  const calledCount = everyone.filter((p) => calledSet.has(p.name)).length;
  // Chỉ tính lại người còn lại khi sang lượt mới — để trò chơi không bị dựng lại khi đang hiện kết quả
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pool = useMemo(() => (noRepeat ? everyone.filter((p) => !calledSet.has(p.name)) : everyone), [everyone, noRepeat, round]);

  const sfx = useCallback((name) => {
    if (!mutedRef.current) playSound(name);
  }, []);

  const handleResult = useCallback(
    (item) => {
      sfx("win");
      setResult(item);
      updateList((l) => ({
        ...l,
        called: l.called.includes(item.name) ? l.called : [...l.called, item.name],
        history: [{ name: item.name, no: item.no, game: gameId, at: Date.now() }, ...l.history].slice(0, HISTORY_MAX),
      }));
    },
    [gameId, sfx, updateList],
  );

  const closeResult = useCallback(() => {
    setResult(null);
    setRound((r) => r + 1);
  }, []);

  const addStar = () => {
    sfx("correct");
    updateList((l) => ({ ...l, stars: { ...l.stars, [result.name]: (l.stars[result.name] || 0) + 1 } }));
  };

  const markAbsent = () => {
    updateList((l) => ({
      ...l,
      called: l.called.filter((n) => n !== result.name),
      history: l.history.map((h, i) => (i === 0 && h.name === result.name ? { ...h, absent: true } : h)),
    }));
    closeResult();
  };

  const saveList = (name, students) => {
    setStore((s) => {
      if (editing === "edit" && list) {
        const keep = new Set(students);
        const lists = s.lists.map((l) =>
          l.id === list.id
            ? {
                ...l,
                name,
                students,
                called: l.called.filter((n) => keep.has(n)),
                stars: Object.fromEntries(Object.entries(l.stars).filter(([n]) => keep.has(n))),
              }
            : l,
        );
        return { ...s, lists };
      }
      const created = { id: newId(), name, students, called: [], history: [], stars: {} };
      return { ...s, lists: [...s.lists, created], activeId: created.id };
    });
    setEditing(null);
    setRound((r) => r + 1);
  };

  const deleteList = () => {
    if (!list || !window.confirm(`Xóa danh sách "${list.name}"?`)) return;
    setStore((s) => {
      const lists = s.lists.filter((l) => l.id !== list.id);
      return { ...s, lists, activeId: lists[0]?.id || null };
    });
    setEditing(null);
  };

  const resetCalled = () => {
    updateList((l) => ({ ...l, called: [] }));
    setRound((r) => r + 1);
  };

  const toggleMute = () => {
    writeMuted(!muted);
    setMuted(!muted);
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else stageRef.current?.requestFullscreen?.().catch(() => {});
  };

  const chooseGame = (id) => {
    setGameId(id);
    setRound((r) => r + 1);
  };

  const canImportSchool = canAccessSchoolUsers(user);
  const showEditor = editing || !list;
  const ranking = list
    ? Object.entries(list.stars)
        .filter(([, n]) => n > 0)
        .sort((a, b) => b[1] - a[1])
    : [];
  const GameComponent = game.Component;

  return (
    <div className="page np-page">
      <div className="page-head">
        <span className="page-head-icon np-icon">🎲</span>
        <div>
          <h2>Gọi tên ngẫu nhiên</h2>
          <p>Nhập danh sách lớp một lần, sau đó gọi tên học sinh bằng {GAMES.length} trò chơi vui nhộn — công bằng, bất ngờ, không ai đoán trước được.</p>
        </div>
      </div>

      {showEditor ? (
        <div className="panel">
          <ListEditor
            key={editing === "edit" ? list?.id : "new"}
            initial={editing === "edit" ? list : null}
            canImportSchool={canImportSchool}
            onSave={saveList}
            onCancel={list ? () => setEditing(null) : null}
            onDelete={editing === "edit" ? deleteList : null}
          />
        </div>
      ) : (
        <>
          {/* ---------- Thanh danh sách & tùy chọn ---------- */}
          <div className="np-toolbar">
            <label className="np-list-select">
              <span>📋</span>
              <select value={list.id} onChange={(e) => setStore((s) => ({ ...s, activeId: e.target.value }))}>
                {store.lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.students.length})
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="btn btn-sm btn-light" onClick={() => setEditing("edit")}>✏️ Sửa</button>
            <button type="button" className="btn btn-sm btn-light" onClick={() => setEditing("new")}>➕ Danh sách mới</button>
            <span className="spacer" />
            <label className="np-switch">
              <input type="checkbox" checked={noRepeat} onChange={(e) => setNoRepeat(e.target.checked)} />
              <span>Không gọi lại bạn đã gọi</span>
            </label>
            <button type="button" className="btn btn-sm btn-light" onClick={toggleMute} title="Bật / tắt âm thanh">
              {muted ? "🔇" : "🔊"}
            </button>
            <button type="button" className="btn btn-sm btn-light" onClick={toggleFullscreen}>
              {fullscreen ? "🗗 Thu nhỏ" : "⛶ Trình chiếu"}
            </button>
          </div>

          {/* ---------- Chọn trò chơi ---------- */}
          <div className="np-games">
            {GAMES.map((g) => (
              <button
                key={g.id}
                type="button"
                className={`np-game-card ${g.id === game.id ? "active" : ""}`}
                onClick={() => chooseGame(g.id)}
              >
                <span className="np-game-icon">{g.icon}</span>
                <strong>{g.title}</strong>
                <small>{g.desc}</small>
              </button>
            ))}
          </div>

          <div className="np-layout">
            {/* ---------- Sân khấu ---------- */}
            <section className={`np-stage ${fullscreen ? "is-full" : ""}`} ref={stageRef}>
              <div className="np-stage-head">
                <h3>
                  {game.icon} {game.title}
                </h3>
                <span className="np-progress">
                  {noRepeat ? (
                    <>
                      Đã gọi <b>{calledCount}</b>/{list.students.length}
                      <i style={{ width: `${(calledCount / list.students.length) * 100}%` }} />
                    </>
                  ) : (
                    <>{list.students.length} học sinh</>
                  )}
                </span>
                {fullscreen && (
                  <button type="button" className="btn btn-sm btn-light" onClick={toggleFullscreen}>
                    ✕ Thoát
                  </button>
                )}
              </div>

              {pool.length ? (
                <GameComponent key={`${list.id}-${game.id}-${round}-${noRepeat}`} pool={pool} sfx={sfx} onResult={handleResult} memo={memo} />
              ) : (
                <div className="np-all-done">
                  <div>🎊</div>
                  <h3>Đã gọi hết cả lớp!</h3>
                  <p>Tất cả {list.students.length} bạn đều đã được gọi.</p>
                  <button type="button" className="np-go" onClick={resetCalled}>
                    🔄 Gọi lại từ đầu
                  </button>
                </div>
              )}

              {result && (
                <ResultOverlay
                  result={result}
                  stars={list.stars[result.name] || 0}
                  onStar={addStar}
                  onAbsent={markAbsent}
                  onClose={closeResult}
                />
              )}
            </section>

            {/* ---------- Lịch sử & điểm cộng ---------- */}
            <aside className="np-side">
              <div className="np-side-card">
                <div className="np-side-head">
                  <h3>🕘 Đã gọi</h3>
                  {list.called.length > 0 && (
                    <button type="button" className="np-link" onClick={resetCalled}>Làm mới lượt</button>
                  )}
                </div>
                {list.history.length === 0 ? (
                  <p className="np-muted">Chưa gọi bạn nào.</p>
                ) : (
                  <ol className="np-history">
                    {list.history.slice(0, 20).map((h) => (
                      <li key={h.at} className={h.absent ? "absent" : ""}>
                        <span className="np-history-icon">{GAMES.find((g) => g.id === h.game)?.icon || "🎲"}</span>
                        <span className="np-history-name">
                          {h.name}
                          {h.absent && <small> · vắng</small>}
                        </span>
                        <time>{timeOf(h.at)}</time>
                      </li>
                    ))}
                  </ol>
                )}
                {list.history.length > 0 && (
                  <button type="button" className="np-link" onClick={() => updateList((l) => ({ ...l, history: [] }))}>
                    Xóa lịch sử
                  </button>
                )}
              </div>

              <div className="np-side-card">
                <div className="np-side-head">
                  <h3>⭐ Bảng điểm cộng</h3>
                  {ranking.length > 0 && (
                    <button
                      type="button"
                      className="np-link"
                      onClick={() => window.confirm("Xóa toàn bộ điểm cộng của danh sách này?") && updateList((l) => ({ ...l, stars: {} }))}
                    >
                      Xóa
                    </button>
                  )}
                </div>
                {ranking.length === 0 ? (
                  <p className="np-muted">Bấm “⭐ Cộng điểm” khi bạn được gọi trả lời đúng.</p>
                ) : (
                  <ol className="np-ranking">
                    {ranking.slice(0, 15).map(([name, n], i) => (
                      <li key={name}>
                        <span className="np-rank">{["🥇", "🥈", "🥉"][i] || i + 1}</span>
                        <span className="np-history-name">{name}</span>
                        <b>{n} ⭐</b>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
