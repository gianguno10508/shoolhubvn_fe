import { useEffect, useRef, useState, useCallback } from "react";
import {
  listTimetables,
  getTimetable,
  createTimetable,
  updateTimetable,
} from "../api/timetables";
import { DEFAULT_CONFIG, DEFAULT_CONSTRAINTS } from "../constants/config";

/* Dữ liệu của 1 tài khoản mới: trống hoàn toàn (không nạp dữ liệu mẫu) */
export function emptyTimetableData() {
  return {
    config: { ...DEFAULT_CONFIG },
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
 * Tải bản thời khóa biểu của tài khoản đang đăng nhập:
 *  - Chưa có bản nào  -> tự tạo 1 bản trống trên server.
 *  - Đã có            -> tải bản cập nhật gần nhất.
 * Trả về status ("loading" | "ready" | "error"), timetableId, initialData và hàm save().
 */
export default function useTimetable() {
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [timetableId, setTimetableId] = useState(null);
  const [initialData, setInitialData] = useState(null);
  const idRef = useRef(null);

  const load = useCallback(async () => {
    setStatus("loading");
    setError("");
    try {
      const list = await listTimetables();
      let id;
      let data;
      if (list.length === 0) {
        data = emptyTimetableData();
        const created = await createTimetable(data.config.tenTKB, data);
        id = created._id;
      } else {
        id = list[0]._id; // server đã sắp xếp mới nhất trước
        const doc = await getTimetable(id);
        // Gộp với dữ liệu trống để bản cũ thiếu trường nào cũng không bị lỗi
        data = { ...emptyTimetableData(), ...doc.data };
      }
      idRef.current = id;
      setTimetableId(id);
      setInitialData(data);
      setStatus("ready");
    } catch (err) {
      setError(err.message || "Không tải được dữ liệu từ máy chủ.");
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** Lưu toàn bộ dữ liệu lên server. Ném lỗi nếu thất bại để nơi gọi báo cho người dùng. */
  const save = useCallback(async (data) => {
    if (!idRef.current) throw new Error("Chưa có bản thời khóa biểu để lưu.");
    const name = (data.config && data.config.tenTKB) || "Thời khóa biểu";
    await updateTimetable(idRef.current, name, data);
  }, []);

  return { status, error, timetableId, initialData, save, reload: load };
}
