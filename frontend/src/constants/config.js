export const DEFAULT_CONFIG = {
  tenTKB: "TUẦN 01 NH 2025-2026",
  tenTruong: "",
  namHoc: "2025-2026",
  soNgay: 6,
  soBuoi: 2,
  soTiet: 5,
};

export const DEFAULT_CONSTRAINTS = {
  khongTietTrong: true,
  lopToiDaTietTrenBuoi: 5,
  uuTienMonChinhBuoiSang: false,
  chaoCoTiet1Thu2: true,
};

/* Các bước soạn thời khóa biểu (sidebar trình soạn). `count` = khóa đếm số lượng hiển thị bên phải */
export const NAV_GROUPS = [
  {
    title: "Thiết lập",
    items: [
      { key: "config", label: "Thông tin chung", hint: "Tên, năm học, số buổi / tiết" },
      { key: "subjects", label: "Môn học", count: "subjects" },
    ],
  },
  {
    title: "Giáo viên",
    items: [
      { key: "departments", label: "Tổ chuyên môn", count: "departments" },
      { key: "teachers", label: "Danh sách giáo viên", count: "teachers" },
    ],
  },
  {
    title: "Khối & lớp",
    items: [
      { key: "grades", label: "Khối lớp", count: "grades" },
      { key: "classes", label: "Lớp học", count: "classes" },
      { key: "assignments", label: "Phân công giảng dạy", count: "assignments" },
    ],
  },
  {
    title: "Nâng cao",
    items: [{ key: "constraints", label: "Ràng buộc xếp lịch" }],
  },
];
