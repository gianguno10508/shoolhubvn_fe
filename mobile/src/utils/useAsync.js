// utils/useAsync.js — tải dữ liệu 1 lần + kéo để tải lại
import { useCallback, useEffect, useRef, useState } from "react";

/** @param {() => Promise<any>} loader  @param {any[]} deps — tải lại khi deps đổi */
export default function useAsync(loader, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const run = useCallback(async (isRefresh) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      setData(await loaderRef.current());
    } catch (err) {
      setError(err.message || "Không tải được dữ liệu.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    run(false);
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  const reload = useCallback(() => run(true), [run]);
  return { data, setData, error, loading, refreshing, reload };
}
