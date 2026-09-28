import { useEffect, useState, useCallback } from "react";
import { getTimetable, updateTimetable } from "../api/timetables";
import { DEFAULT_CONFIG, DEFAULT_CONSTRAINTS } from "../constants/config";

/* Dữ liệu của 1 thời khóa biểu mới: trống hoàn toàn (không nạp dữ liệu mẫu) */
export function emptyTimetableData(name) {
  return {
    config: { ...DEFAULT_CONFIG, ...(name ? { tenTKB: name } : {}) },
    constraints: { ...DEFAULT_CONSTRAINTS },
    subjects: [],
    departments: [],
    teachers: [],
    grades: [],
    campuses: [],
    classes: [],
    assignments: [],
    gradeAssignments: [],
    schedule: {},
  };
}

/**
 * Tải 1 thời khóa biểu theo id từ backend và cung cấp hàm save().
 * status: "loading" | "ready" | "error"
 */
export default function useTimetable(id) {
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [initialData, setInitialData] = useState(null);

  const load = useCallback(async () => {
    setStatus("loading");
    setError("");
    try {
      const doc = await getTimetable(id);
      // Gộp với dữ liệu trống để bản cũ thiếu trường nào cũng không bị lỗi
      const base = emptyTimetableData(doc.name);
      const saved = doc.data || {};
      setInitialData({
        ...base,
        ...saved,
        config: { ...base.config, ...(saved.config || {}) },
      });
      setStatus("ready");
    } catch (err) {
      setError(err.message || "Không tải được dữ liệu từ máy chủ.");
      setStatus("error");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  /** Lưu toàn bộ dữ liệu lên server. Ném lỗi nếu thất bại để nơi gọi báo cho người dùng. */
  const save = useCallback(
    async (data) => {
      const name = (data.config && data.config.tenTKB) || "Thời khóa biểu";
      await updateTimetable(id, name, data);
    },
    [id],
  );

  return { status, error, initialData, save, reload: load };
}
