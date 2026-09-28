import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  listTimetables,
  createTimetable,
  duplicateTimetable,
  trashTimetable,
  restoreTimetable,
  deleteTimetableForever,
} from "../api/timetables";
import { emptyTimetableData } from "../hooks/useTimetable";

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleString("vi-VN");
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Trình duyệt không cho dùng clipboard (ví dụ trang http): để người dùng tự sao chép
    window.prompt("Sao chép Id:", text);
    return false;
  }
}

export default function TimetableListPage() {
  const [tab, setTab] = useState("active"); // active | trash
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [busyId, setBusyId] = useState(null);
  const [toast, setToast] = useState(null); // { msg, error }

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const isTrash = tab === "trash";
  const reload = () => setReloadKey((k) => k + 1);

  function showToast(msg, isError = false) {
    setToast({ msg, error: isError });
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(null), 2600);
  }

  // Tải danh sách mỗi khi đổi tab hoặc có thao tác làm thay đổi dữ liệu
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    listTimetables(isTrash)
      .then((list) => {
        if (!cancelled) setItems(list);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Không tải được danh sách.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isTrash, reloadKey]);

  /* Chạy 1 thao tác trên 1 dòng: khóa nút của dòng đó, báo kết quả, tải lại danh sách */
  async function run(id, action, successMsg) {
    setBusyId(id);
    try {
      await action();
      showToast(successMsg);
      reload();
    } catch (err) {
      showToast(err.message || "Có lỗi xảy ra.", true);
    } finally {
      setBusyId(null);
    }
  }

  async function handleCopyId(id) {
    if (await copyText(id)) showToast("Đã sao chép Id.");
  }

  function handleTrash(t) {
    if (!window.confirm(`Chuyển "${t.name}" vào thùng rác? Bạn có thể khôi phục lại sau.`)) return;
    run(t._id, () => trashTimetable(t._id), "Đã chuyển vào thùng rác.");
  }

  function handleForever(t) {
    if (!window.confirm(`Xóa vĩnh viễn "${t.name}"? Thao tác này không thể hoàn tác.`)) return;
    run(t._id, () => deleteTimetableForever(t._id), "Đã xóa vĩnh viễn.");
  }

  async function submitCreate(e) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      await createTimetable(name, emptyTimetableData(name));
      setShowCreate(false);
      setNewName("");
      if (isTrash) setTab("active");
      else reload();
      showToast("Đã tạo thời khóa biểu mới.");
    } catch (err) {
      showToast(err.message || "Không tạo được thời khóa biểu.", true);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <h2>Danh sách thời khóa biểu</h2>
        <div className="spacer" />
        <button className="btn btn-orange" onClick={() => setShowCreate(true)}>
          + Thêm mới
        </button>
      </div>

      <div className="tabs">
        <button
          className={"tab" + (!isTrash ? " active" : "")}
          onClick={() => setTab("active")}
        >
          Mới
        </button>
        <button
          className={"tab" + (isTrash ? " active" : "")}
          onClick={() => setTab("trash")}
        >
          Thùng rác
        </button>
      </div>

      {toast && <div className={"toast" + (toast.error ? " toast-error" : "")}>{toast.msg}</div>}

      {loading && <p className="hint">Đang tải...</p>}

      {!loading && error && (
        <p className="auth-error">
          {error}{" "}
          <button className="link-btn" onClick={reload}>
            Thử lại
          </button>
        </p>
      )}

      {!loading && !error && items.length === 0 && (
        <p className="empty">
          {isTrash
            ? "Thùng rác trống."
            : "Chưa có thời khóa biểu nào. Bấm “Thêm mới” để tạo."}
        </p>
      )}

      {!loading && !error && items.length > 0 && (
        <ul className="tkb-list">
          {items.map((t) => {
            const busy = busyId === t._id;
            return (
              <li className="tkb-row" key={t._id}>
                <div className="tkb-row-main">
                  {isTrash ? (
                    <span className="tkb-row-title muted">📅 {t.name}</span>
                  ) : (
                    <Link className="tkb-row-title" to={`/tkb/${t._id}`}>
                      📅 {t.name}
                    </Link>
                  )}
                  <small className="tkb-row-date">
                    {isTrash
                      ? `Đã xóa lúc ${formatDate(t.deletedAt)}`
                      : `Tạo lúc ${formatDate(t.createdAt)}`}
                  </small>
                </div>

                <span className="tkb-row-id">Id: {t._id}</span>

                <div className="tkb-row-actions">
                  <button className="btn btn-sm btn-red" onClick={() => handleCopyId(t._id)}>
                    Copy Id
                  </button>
                  {isTrash ? (
                    <>
                      <button
                        className="btn btn-sm btn-orange"
                        disabled={busy}
                        onClick={() =>
                          run(t._id, () => restoreTimetable(t._id), "Đã khôi phục thời khóa biểu.")
                        }
                      >
                        Khôi phục
                      </button>
                      <button
                        className="btn btn-sm btn-red"
                        disabled={busy}
                        onClick={() => handleForever(t)}
                      >
                        Xóa vĩnh viễn
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="btn btn-sm btn-orange"
                        disabled={busy}
                        onClick={() =>
                          run(t._id, () => duplicateTimetable(t._id), "Đã nhân bản thời khóa biểu.")
                        }
                      >
                        Nhân bản tkb này
                      </button>
                      <button
                        className="btn btn-sm btn-red"
                        disabled={busy}
                        onClick={() => handleTrash(t)}
                      >
                        Xóa
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {showCreate && (
        <div className="modal-backdrop" onClick={() => !creating && setShowCreate(false)}>
          <form className="modal modal-sm" onClick={(e) => e.stopPropagation()} onSubmit={submitCreate}>
            <div className="modal-head">
              <h3>Thêm thời khóa biểu mới</h3>
            </div>
            <label className="field">
              <span>Tên thời khóa biểu</span>
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ví dụ: TUẦN 01 NH 2025-2026"
              />
            </label>
            <div className="btn-row modal-actions">
              <button
                type="button"
                className="btn btn-info"
                disabled={creating}
                onClick={() => setShowCreate(false)}
              >
                Hủy
              </button>
              <button className="btn btn-primary" type="submit" disabled={creating || !newName.trim()}>
                {creating ? "Đang tạo..." : "Tạo mới"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
