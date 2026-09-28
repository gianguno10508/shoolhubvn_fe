import { nextId } from "./idGenerator";

/**
 * Tạo 1 phân công giảng dạy mới (dùng cho cả Khung CT của khối và của lớp).
 * `extra` cho phép override bất kỳ field nào, hoặc thêm field mới cho
 * tính năng tương lai mà không phải sửa các nơi gọi hàm này.
 */
export function newAssignment(extra) {
  return {
    id: nextId("a"),
    classId: "",
    gradeId: "",
    subjectId: "",
    teacherId: "",
    soTiet: 1,
    tietLienTiep: 1,
    fixed: [],
    avoid: [],
    ...extra,
  };
}
