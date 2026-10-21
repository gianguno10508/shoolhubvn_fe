// components/notifications/NotificationBell.jsx
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  emitNotificationsChanged,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../../api/notifications";
import { formatEventTime, timeAgo } from "../../utils/time";

/* Chuông thông báo cạnh tài khoản: số chưa đọc + danh sách mới nhất */
export default function NotificationBell({ unread }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    setItems(null);
    listNotifications({ limit: 8 })
      .then(setItems)
      .catch(() => setItems([]));
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  async function openItem(n) {
    setOpen(false);
    if (!n.read) {
      await markNotificationRead(n.id).catch(() => {});
      emitNotificationsChanged();
    }
    navigate(`/thong-bao?id=${n.id}`);
  }

  async function readAll() {
    await markAllNotificationsRead().catch(() => {});
    setItems((prev) => prev?.map((n) => ({ ...n, read: true })));
    emitNotificationsChanged();
  }

  return (
    <div className="bell" ref={ref}>
      <button
        className={"bell-btn" + (open ? " open" : "")}
        onClick={() => setOpen((v) => !v)}
        aria-label={`Thông báo${unread ? ` (${unread} chưa đọc)` : ""}`}
        title="Thông báo"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && <span className="bell-badge">{unread > 99 ? "99+" : unread}</span>}
      </button>

      {open && (
        <div className="bell-panel" role="dialog" aria-label="Thông báo">
          <div className="bell-head">
            <strong>Thông báo</strong>
            {unread > 0 && (
              <button className="link-btn" onClick={readAll}>
                Đánh dấu đã đọc tất cả
              </button>
            )}
          </div>

          <div className="bell-list">
            {items === null && <p className="bell-empty">Đang tải...</p>}
            {items?.length === 0 && (
              <p className="bell-empty">
                <span>🔔</span>
                Chưa có thông báo nào.
              </p>
            )}
            {items?.map((n) => (
              <button key={n.id} className={"bell-item" + (n.read ? "" : " unread")} onClick={() => openItem(n)}>
                <span className={"bell-dot" + (n.priority === "important" ? " important" : "")} />
                <span className="bell-item-body">
                  <strong>
                    {n.priority === "important" && <em>Quan trọng</em>}
                    {n.title}
                  </strong>
                  {n.eventAt && <span className="bell-when">🕒 {formatEventTime(n.eventAt)}</span>}
                  {n.body && <span className="bell-excerpt">{n.body}</span>}
                  <small>
                    {n.senderName} · {n.senderRoleLabel} · {timeAgo(n.createdAt)}
                  </small>
                </span>
              </button>
            ))}
          </div>

          <Link className="bell-foot" to="/thong-bao" onClick={() => setOpen(false)}>
            Xem tất cả thông báo →
          </Link>
        </div>
      )}
    </div>
  );
}
