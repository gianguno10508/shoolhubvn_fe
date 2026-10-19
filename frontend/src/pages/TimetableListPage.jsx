import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  listTimetables,
  createTimetable,
  duplicateTimetable,
  trashTimetable,
  restoreTimetable,
  deleteTimetableForever,
  publishTimetable,
} from "../api/timetables";
import { emptyTimetableData } from "../hooks/useTimetable";

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleString("vi-VN");
}

/** Ngày tuần áp dụng (lưu 0h UTC) → "dd/mm/yyyy" */
function formatDay(value) {
  return new Date(value).toLocaleDateString("vi-VN", { timeZone: "UTC" });
}

/** Thứ 2 tuần này và chủ nhật cùng tuần, dạng YYYY-MM-DD (giờ máy) */
function thisWeek() {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const iso = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  const end = new Date(d);
  end.setDate(d.getDate() + 6);
  return { start: iso(d), end: iso(end) };
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
  const [newWeek, setNewWeek] = useState(thisWeek);
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

  function handlePublish(t) {
    if (t.published) {
      if (!window.confirm(`Thôi áp dụng "${t.name}"? Giáo viên, học sinh sẽ không xem được TKB trên app.`)) return;
      run(t._id, () => publishTimetable(t._id, false), "Đã thôi áp dụng thời khóa biểu.");
      return;
    }
    const when = t.weekStart
      ? `cho tuần ${formatDay(t.weekStart)} – ${formatDay(t.weekEnd)}`
      : "(chưa đặt tuần áp dụng — chỉ hiện khi trường chưa có TKB theo tuần nào)";
    if (!window.confirm(`Áp dụng "${t.name}" ${when}? Giáo viên, học sinh sẽ xem TKB này trên app di động.`)) return;
    run(t._id, () => publishTimetable(t._id, true), "Đã áp dụng — giáo viên, học sinh đã xem được trên app.");
  }

  async function submitCreate(e) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    if (!newWeek.start || !newWeek.end) {
      showToast("Vui lòng chọn ngày bắt đầu và ngày kết thúc tuần.", true);
      return;
    }
    if (newWeek.end < newWeek.start) {
      showToast("Ngày kết thúc tuần phải sau ngày bắt đầu.", true);
      return;
    }
    setCreating(true);
    try {
      const data = emptyTimetableData(name);
      data.config = { ...data.config, tuanBatDau: newWeek.start, tuanKetThuc: newWeek.end };
      await createTimetable(name, data);
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
    <div className="page tkb-list-page">
      <div className="page-head">
        <span className="page-head-icon">📅</span>
        <div>
          <h2>Danh sách thời khóa biểu</h2>
          <p>Quản lý và tổ chức các thời khóa biểu của trường</p>
        </div>
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
                      {t.published && <span className="tkb-published">Đang áp dụng</span>}
                    </Link>
                  )}
                  {!isTrash && (
                    <small className="tkb-row-week">
                      {t.weekStart
                        ? `🗓️ Tuần ${formatDay(t.weekStart)} – ${formatDay(t.weekEnd)}`
                        : "⚠️ Chưa đặt tuần áp dụng"}
                    </small>
                  )}
                  <small className="tkb-row-date">
                    {isTrash
                      ? `Đã xóa lúc ${formatDate(t.deletedAt)}`
                      : `Tạo lúc ${formatDate(t.createdAt)}`}
                  </small>
                </div>

                <span className="tkb-row-id">Id: {t._id}</span>

                <div className="tkb-row-actions">
                  <button className="btn btn-sm btn-light" onClick={() => handleCopyId(t._id)}>
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
                        className={"btn btn-sm " + (t.published ? "btn-light" : "btn-primary")}
                        disabled={busy}
                        onClick={() => handlePublish(t)}
                        title="Giáo viên xem lịch dạy, học sinh xem TKB lớp trên app di động"
                      >
                        {t.published ? "Thôi áp dụng" : "📱 Áp dụng cho app"}
                      </button>
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
            <div className="tkb-week-fields">
              <label className="field">
                <span>Ngày bắt đầu tuần</span>
                <input type="date" value={newWeek.start} onChange={(e) => setNewWeek({ ...newWeek, start: e.target.value })} />
              </label>
              <label className="field">
                <span>Ngày kết thúc tuần</span>
                <input
                  type="date"
                  value={newWeek.end}
                  min={newWeek.start || undefined}
                  onChange={(e) => setNewWeek({ ...newWeek, end: e.target.value })}
                />
              </label>
            </div>
            <p className="hint">App chỉ hiển thị lịch trong khoảng ngày này, ngoài khoảng thì không có lịch.</p>
            <div className="btn-row modal-actions">
              <button
                type="button"
                className="btn btn-light"
                disabled={creating}
                onClick={() => setShowCreate(false)}
              >
                Hủy
              </button>
              <button className="btn btn-primary" type="submit" disabled={creating || !newName.trim() || !newWeek.start || !newWeek.end}>
                {creating ? "Đang tạo..." : "Tạo mới"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
