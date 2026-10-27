// pages/notifications/NotificationsPage.jsx
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  deleteNotification,
  downloadNotificationAttachment,
  emitNotificationsChanged,
  getNotificationAudiences,
  listNotifications,
  listSentNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  sendNotification,
} from "../../api/notifications";
import { formatDateTimeVi, formatEventTime, timeAgo } from "../../utils/time";
import { DateInput, TimeInput } from "../../components/DateInput";
import { Bell, CheckCheck, Clock3, Download, Inbox, Loader2, Mail, Paperclip, PenSquare, Send, Undo2, X } from "lucide-react";

/** Nhãn ngày giờ của thông báo; mờ đi khi thời điểm đã qua */
function EventTime({ value }) {
  if (!value) return null;
  const past = new Date(value).getTime() < Date.now();
  return (
    <span className={"nt-when" + (past ? " past" : "")} title={past ? "Đã qua" : "Thời gian"}>
      <Clock3 size={13} /> {formatEventTime(value)}
    </span>
  );
}

const ATTACH_ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.rtf,.txt,.csv,.jpg,.jpeg,.png,.zip,.rar";
const ATTACH_EXTS = ATTACH_ACCEPT.split(",").map((x) => x.slice(1));
const MAX_FILES = 5;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_BYTES = 25 * 1024 * 1024;

function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Nhãn loại tệp theo đuôi: PDF, DOC, XLS... */
function fileKind(name) {
  const ext = (name.split(".").pop() || "").toLowerCase();
  if (ext === "pdf") return { label: "PDF", cls: "pdf" };
  if (["doc", "docx", "odt", "rtf"].includes(ext)) return { label: "DOC", cls: "doc" };
  if (["xls", "xlsx", "ods", "csv"].includes(ext)) return { label: "XLS", cls: "xls" };
  if (["ppt", "pptx"].includes(ext)) return { label: "PPT", cls: "ppt" };
  if (["jpg", "jpeg", "png"].includes(ext)) return { label: "ẢNH", cls: "img" };
  if (["zip", "rar"].includes(ext)) return { label: "ZIP", cls: "zip" };
  return { label: ext.toUpperCase().slice(0, 4) || "TỆP", cls: "" };
}

const readAsBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^;]*;base64,/, ""));
    reader.onerror = () => reject(new Error(`Không đọc được tệp ${file.name}.`));
    reader.readAsDataURL(file);
  });

/** Danh sách tệp đính kèm của 1 thông báo, bấm để tải về */
function Attachments({ notification, onError }) {
  const [busy, setBusy] = useState(null);
  if (!notification.attachments?.length) return null;

  async function download(e, f) {
    e.stopPropagation();
    setBusy(f.id);
    try {
      await downloadNotificationAttachment(notification.id, f.id);
    } catch (err) {
      onError(err.message || "Không tải được tệp.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="nt-files">
      {notification.attachments.map((f) => {
        const kind = fileKind(f.name);
        return (
          <button key={f.id} type="button" className="nt-file" onClick={(e) => download(e, f)} disabled={busy === f.id} title="Tải về">
            <span className={"nt-file-ext " + kind.cls}>{kind.label}</span>
            <span className="nt-file-name">{f.name}</span>
            <small>{formatSize(f.size)}</small>
            <span className="nt-file-dl">{busy === f.id ? <Loader2 size={16} className="ai-spin-icon" /> : <Download size={16} />}</span>
          </button>
        );
      })}
    </div>
  );
}

const pad = (n) => String(n).padStart(2, "0");
const todayInput = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const TYPE_LABEL = {
  staff: "Toàn bộ giáo viên & cán bộ",
  all: "Toàn trường (cả học sinh)",
  roles: "Theo chức danh",
  classes: "Theo lớp",
};

/* Thông báo: hộp thư đến cho mọi người, gửi thông báo cho BGH / Đoàn / GVCN */
export default function NotificationsPage() {
  const [params, setParams] = useSearchParams();
  const focusId = params.get("id");

  const [audiences, setAudiences] = useState(null);
  const [tab, setTab] = useState("inbox");
  const [inbox, setInbox] = useState(null);
  const [sent, setSent] = useState(null);
  const [error, setError] = useState("");
  const [composing, setComposing] = useState(false);
  const [toast, setToast] = useState(null);
  const [expanded, setExpanded] = useState(focusId);

  function showToast(msg, isError = false) {
    setToast({ msg, error: isError });
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(null), 2600);
  }

  function loadInbox() {
    listNotifications({ limit: 100 })
      .then(setInbox)
      .catch((err) => setError(err.message || "Không tải được thông báo."));
  }

  function loadSent() {
    listSentNotifications()
      .then(setSent)
      .catch((err) => setError(err.message || "Không tải được thông báo đã gửi."));
  }

  useEffect(() => {
    loadInbox();
    getNotificationAudiences()
      .then(setAudiences)
      .catch(() => setAudiences({ canSend: false }));
  }, []);

  useEffect(() => {
    if (tab === "sent" && sent === null) loadSent();
  }, [tab, sent]);

  // Mở từ chuông: cuộn tới thông báo
  useEffect(() => {
    if (focusId && inbox) {
      setExpanded(focusId);
      document.getElementById(`n-${focusId}`)?.scrollIntoView({ block: "center" });
    }
  }, [focusId, inbox]);

  async function toggle(n) {
    const open = expanded !== String(n.id);
    setExpanded(open ? String(n.id) : null);
    if (focusId) setParams({}, { replace: true });
    if (open && !n.read) {
      await markNotificationRead(n.id).catch(() => {});
      setInbox((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      emitNotificationsChanged();
    }
  }

  async function readAll() {
    await markAllNotificationsRead();
    setInbox((prev) => prev.map((x) => ({ ...x, read: true })));
    emitNotificationsChanged();
  }

  async function revoke(n) {
    if (!window.confirm(`Thu hồi thông báo “${n.title}”? Người nhận sẽ không còn thấy thông báo này.`)) return;
    try {
      await deleteNotification(n.id);
      setSent((prev) => prev.filter((x) => x.id !== n.id));
      showToast("Đã thu hồi thông báo.");
    } catch (err) {
      showToast(err.message || "Không thu hồi được.", true);
    }
  }

  const unread = inbox?.filter((n) => !n.read).length || 0;
  const canSend = audiences?.canSend;

  return (
    <div className="page nt-page">
      {toast && <div className={"toast" + (toast.error ? " toast-error" : "")}>{toast.msg}</div>}

      <div className="page-head">
        <span className="page-head-icon nt-icon">
          <Bell size={24} />
        </span>
        <div>
          <h2>Thông báo</h2>
          <p>
            {canSend
              ? audiences.ownClass && audiences.types.length === 1
                ? `Nhận thông báo của trường và gửi thông báo cho lớp ${audiences.ownClass.name}.`
                : "Nhận thông báo và gửi thông báo đến giáo viên, học sinh trong trường."
              : "Thông báo từ Ban giám hiệu, Đoàn trường và giáo viên chủ nhiệm."}
          </p>
        </div>
        <div className="spacer" />
        {canSend && (
          <button className="btn btn-primary" onClick={() => setComposing(true)}>
            <PenSquare size={16} /> Soạn thông báo
          </button>
        )}
      </div>

      <div className="nt-toolbar">
        <div className="tabs">
          <button className={"tab" + (tab === "inbox" ? " active" : "")} onClick={() => setTab("inbox")}>
            <Inbox size={15} /> Hộp thư đến {unread > 0 && <span className="nt-count">{unread}</span>}
          </button>
          {canSend && (
            <button className={"tab" + (tab === "sent" ? " active" : "")} onClick={() => setTab("sent")}>
              <Send size={15} /> Đã gửi
            </button>
          )}
        </div>
        {tab === "inbox" && unread > 0 && (
          <button className="btn btn-sm btn-light" onClick={readAll}>
            <CheckCheck size={15} /> Đánh dấu đã đọc tất cả
          </button>
        )}
      </div>

      {error && (
        <div className="auth-error">
          <span>!</span>
          <p>{error}</p>
        </div>
      )}

      {/* ----- Hộp thư đến ----- */}
      {tab === "inbox" && (
        <div className="nt-list">
          {inbox === null && <p className="as-empty">Đang tải...</p>}
          {inbox?.length === 0 && (
            <div className="as-empty">
              <span>
                <Inbox size={34} />
              </span>
              <strong>Chưa có thông báo nào</strong>
            </div>
          )}
          {inbox?.map((n) => {
            const open = expanded === String(n.id);
            return (
              <article
                key={n.id}
                id={`n-${n.id}`}
                className={"nt-item" + (n.read ? "" : " unread") + (open ? " open" : "") + (n.priority === "important" ? " important" : "")}
              >
                <button className="nt-item-head" onClick={() => toggle(n)} aria-expanded={open}>
                  <span className="nt-avatar">{(n.senderName || "?").charAt(0).toUpperCase()}</span>
                  <span className="nt-item-main">
                    <span className="nt-item-title">
                      {!n.read && <span className="nt-dot" />}
                      {n.priority === "important" && <em className="nt-flag">Quan trọng</em>}
                      <strong>{n.title}</strong>
                      {n.attachments?.length > 0 && (
                        <span className="nt-clip" title={`${n.attachments.length} tệp đính kèm`}>
                          <Paperclip size={13} /> {n.attachments.length}
                        </span>
                      )}
                    </span>
                    <EventTime value={n.eventAt} />
                    <span className="nt-item-meta">
                      {n.senderName} · {n.senderRoleLabel} → {n.audienceLabel}
                    </span>
                    {!open && n.body && <span className="nt-excerpt">{n.body}</span>}
                  </span>
                  <time title={formatDateTimeVi(n.createdAt)}>{timeAgo(n.createdAt)}</time>
                </button>
                {open && (
                  <div className="nt-body">
                    {n.body ? (
                      n.body.split("\n").map((line, i) => <p key={i}>{line || " "}</p>)
                    ) : !n.attachments?.length ? (
                      <p className="muted">(Không có nội dung)</p>
                    ) : null}
                    <Attachments notification={n} onError={(msg) => showToast(msg, true)} />
                    <small>Gửi lúc {formatDateTimeVi(n.createdAt)}</small>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* ----- Đã gửi ----- */}
      {tab === "sent" && (
        <div className="nt-list">
          {sent === null && <p className="as-empty">Đang tải...</p>}
          {sent?.length === 0 && (
            <div className="as-empty">
              <span>
                <Mail size={34} />
              </span>
              <strong>Bạn chưa gửi thông báo nào</strong>
            </div>
          )}
          {sent?.map((n) => {
            const percent = n.recipientCount ? Math.round((n.readCount / n.recipientCount) * 100) : 0;
            return (
              <article key={n.id} className={"nt-item nt-sent" + (n.priority === "important" ? " important" : "")}>
                <div className="nt-item-head">
                  <span className="nt-item-main">
                    <span className="nt-item-title">
                      {n.priority === "important" && <em className="nt-flag">Quan trọng</em>}
                      <strong>{n.title}</strong>
                    </span>
                    <EventTime value={n.eventAt} />
                    <span className="nt-item-meta">
                      Gửi tới {n.audienceLabel} · {formatDateTimeVi(n.createdAt)}
                    </span>
                    {n.body && <span className="nt-excerpt">{n.body}</span>}
                    <Attachments notification={n} onError={(msg) => showToast(msg, true)} />
                    <span className="nt-read">
                      <span className="as-progress-bar">
                        <span style={{ width: `${percent}%` }} />
                      </span>
                      <small>
                        {n.readCount}/{n.recipientCount} người đã đọc
                      </small>
                    </span>
                  </span>
                  <button className="btn btn-sm btn-danger" onClick={() => revoke(n)}>
                    <Undo2 size={14} /> Thu hồi
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {composing && audiences && (
        <ComposeModal
          audiences={audiences}
          onClose={() => setComposing(false)}
          onSent={(n) => {
            setComposing(false);
            setSent((prev) => (prev ? [{ ...n, readCount: 0 }, ...prev] : prev));
            setTab("sent");
            showToast(`Đã gửi thông báo tới ${n.recipientCount} người.`);
          }}
        />
      )}
    </div>
  );
}

function ComposeModal({ audiences, onClose, onSent }) {
  const classOnly = audiences.types.length === 1 && audiences.types[0] === "classes" && audiences.ownClass;
  const [type, setType] = useState(audiences.types[0]);
  const [roles, setRoles] = useState([]);
  const [classIds, setClassIds] = useState(classOnly ? [audiences.ownClass.id] : []);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState("normal");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [files, setFiles] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fileInput = useRef(null);

  function addFiles(list) {
    setError("");
    const next = [...files];
    for (const f of list) {
      const ext = (f.name.split(".").pop() || "").toLowerCase();
      if (!ATTACH_EXTS.includes(ext)) {
        setError(`Tệp “${f.name}” không được hỗ trợ. Chỉ nhận PDF, Word, Excel, PowerPoint, ảnh, TXT, ZIP.`);
        continue;
      }
      if (f.size > MAX_FILE_BYTES) {
        setError(`Tệp “${f.name}” quá lớn (tối đa 10MB mỗi tệp).`);
        continue;
      }
      if (next.some((x) => x.name === f.name && x.size === f.size)) continue;
      if (next.length >= MAX_FILES) {
        setError(`Tối đa ${MAX_FILES} tệp đính kèm.`);
        break;
      }
      if (next.reduce((sum, x) => sum + x.size, 0) + f.size > MAX_TOTAL_BYTES) {
        setError("Tổng dung lượng tệp đính kèm tối đa 25MB.");
        break;
      }
      next.push(f);
    }
    setFiles(next);
    if (fileInput.current) fileInput.current.value = "";
  }

  const toggle = (list, setList, v) => setList(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (time && !date) return setError("Vui lòng chọn ngày.");
    if (date && !time) return setError("Vui lòng nhập giờ, phút.");
    const eventAt = date ? new Date(`${date}T${time}`).toISOString() : null;
    setBusy(true);
    try {
      const attachments = await Promise.all(files.map(async (f) => ({ name: f.name, data: await readAsBase64(f) })));
      const n = await sendNotification({ title, body, priority, eventAt, audience: { type, roles, classIds }, attachments });
      onSent(n);
    } catch (err) {
      setError(err.message || "Không gửi được thông báo.");
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={() => !busy && onClose()}>
      <form className="modal nt-compose" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="modal-head">
          <h3>
            <PenSquare size={20} /> Soạn thông báo
          </h3>
          <button type="button" className="nt-close" onClick={onClose} aria-label="Đóng">
            <X size={18} />
          </button>
        </div>

        <div className="field">
          <span>Gửi tới</span>
          {classOnly ? (
            <div className="nt-fixed-audience">🏫 Học sinh lớp {audiences.ownClass.name}</div>
          ) : (
            <div className="nt-audience">
              {audiences.types.map((t) => (
                <label key={t} className={"nt-audience-opt" + (type === t ? " active" : "")}>
                  <input type="radio" name="aud" checked={type === t} onChange={() => setType(t)} />
                  {TYPE_LABEL[t]}
                </label>
              ))}
            </div>
          )}
        </div>

        {type === "roles" && (
          <div className="as-chip-row nt-chips">
            {audiences.roles.map((r) => (
              <button
                key={r.value}
                type="button"
                className={"as-chip" + (roles.includes(r.value) ? " selected" : "")}
                onClick={() => toggle(roles, setRoles, r.value)}
              >
                {r.label}
              </button>
            ))}
          </div>
        )}
        {type === "classes" && !classOnly && (
          <div className="as-chip-row nt-chips">
            {audiences.classes.map((c) => (
              <button
                key={c.id}
                type="button"
                className={"as-chip" + (classIds.includes(c.id) ? " selected" : "")}
                onClick={() => toggle(classIds, setClassIds, c.id)}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}

        <label className="field">
          <span>Tiêu đề *</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} placeholder="Ví dụ: Lịch họp hội đồng tháng 10" autoFocus />
        </label>
        <label className="field">
          <span>Nội dung</span>
          <textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} placeholder="Nội dung thông báo..." />
        </label>
        <div className="field">
          <span>Thời gian (ngày, giờ phút) — không bắt buộc</span>
          <div className="nt-when-row">
            <DateInput value={date} onChange={(e) => setDate(e.target.value)} aria-label="Ngày" />
            <TimeInput value={time} onChange={(e) => setTime(e.target.value)} aria-label="Giờ phút" />
            {!date && (
              <button type="button" className="btn btn-sm btn-light" onClick={() => setDate(todayInput())}>
                Hôm nay
              </button>
            )}
            {(date || time) && (
              <button
                type="button"
                className="btn btn-sm btn-light"
                onClick={() => {
                  setDate("");
                  setTime("");
                }}
              >
                Bỏ
              </button>
            )}
          </div>
          {date && time && <small className="nt-when-preview">🕒 {formatEventTime(`${date}T${time}`)}</small>}
        </div>
        <div className="field">
          <span>Tệp đính kèm — không bắt buộc</span>
          <div
            className="nt-attach-drop"
            onClick={() => fileInput.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              addFiles(Array.from(e.dataTransfer.files || []));
            }}
          >
            <input ref={fileInput} type="file" multiple hidden accept={ATTACH_ACCEPT} onChange={(e) => addFiles(Array.from(e.target.files || []))} />
            <Paperclip size={20} className="nt-attach-icon" />
            <span>
              <b>Chọn tệp</b> hoặc kéo thả vào đây
            </span>
            <small>PDF, Word, Excel, PowerPoint, ảnh, ZIP · tối đa {MAX_FILES} tệp, 10MB/tệp</small>
          </div>
          {files.length > 0 && (
            <div className="nt-files">
              {files.map((f, i) => {
                const kind = fileKind(f.name);
                return (
                  <div key={f.name + f.size} className="nt-file">
                    <span className={"nt-file-ext " + kind.cls}>{kind.label}</span>
                    <span className="nt-file-name">{f.name}</span>
                    <small>{formatSize(f.size)}</small>
                    <button
                      type="button"
                      className="nt-file-remove"
                      onClick={() => setFiles(files.filter((_, j) => j !== i))}
                      aria-label={`Bỏ ${f.name}`}
                      disabled={busy}
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <label className="nt-important">
          <input type="checkbox" checked={priority === "important"} onChange={(e) => setPriority(e.target.checked ? "important" : "normal")} />
          Đánh dấu <b>quan trọng</b>
        </label>

        {error && (
          <div className="auth-error">
            <span>!</span>
            <p>{error}</p>
          </div>
        )}

        <div className="btn-row modal-actions">
          <button type="button" className="btn btn-light" onClick={onClose} disabled={busy}>
            Hủy
          </button>
          <button className="btn btn-primary" type="submit" disabled={busy || !title.trim()}>
            {busy ? <Loader2 size={16} className="ai-spin-icon" /> : <Send size={16} />}
            {busy ? (files.length ? "Đang tải tệp lên..." : "Đang gửi...") : "Gửi thông báo"}
          </button>
        </div>
      </form>
    </div>
  );
}
