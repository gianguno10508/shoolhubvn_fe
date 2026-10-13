// hooks/useUnreadCount.js
import { useCallback, useEffect, useState } from "react";
import { getUnreadCount, NOTIFICATIONS_CHANGED } from "../api/notifications";

const POLL_MS = 60 * 1000;

/** Số thông báo chưa đọc, tự cập nhật mỗi phút và khi có sự kiện NOTIFICATIONS_CHANGED */
export default function useUnreadCount(enabled) {
  const [count, setCount] = useState(0);

  const refresh = useCallback(() => {
    if (!enabled) return;
    getUnreadCount()
      .then((r) => setCount(r.count))
      .catch(() => {});
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return undefined;
    refresh();
    const t = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, POLL_MS);
    window.addEventListener(NOTIFICATIONS_CHANGED, refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(t);
      window.removeEventListener(NOTIFICATIONS_CHANGED, refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [enabled, refresh]);

  return [count, refresh];
}
