export const DEFAULT_CONFIG = {
  tenTKB: "TUẦN 01 NH 2025-2026",
  tenTruong: "",
  namHoc: "2025-2026",
  soNgay: 6,
  soBuoi: 2,
  soTiet: 5,
  phuongSai: 1,
  thuatToan: "Thuật toán 4 (tối ưu)",
};

export const DEFAULT_CONSTRAINTS = {
  khongTietTrong: true,
  lopToiDaTietTrenBuoi: 5,
  uuTienMonChinhBuoiSang: false,
  chaoCoTiet1Thu2: true,
};

export const STATUS_STAGES = [
  "Khởi tạo",
  "Chỉnh sửa",
  "Khóa dữ liệu",
  "Thủ công",
  "Đang chạy",
  "Đã có kết quả",
];

export const NAV_GROUPS = [
  {
    title: "Cài đặt",
    items: [
      { key: "config", label: "Bước 1: Cấu hình chung" },
      { key: "subjects", label: "Bước 2: Danh sách môn học" },
    ],
  },
  {
    title: "Tổ chuyên môn / Giáo viên",
    items: [
      { key: "departments", label: "Bước 3: Danh sách tổ chuyên môn" },
      { key: "teachers", label: "Bước 4: Danh sách giáo viên" },
    ],
  },
  {
    title: "Khối / lớp",
    items: [
      { key: "grades", label: "Bước 5: Danh sách khối (nhóm lớp)" },
      {
        key: "campuses",
        label: "Bước 5.1: Danh sách điểm trường",
        small: true,
      },
      { key: "classes", label: "Bước 6: Danh sách lớp học" },
      { key: "assignments", label: "Bước 7: Thiết lập phân công giảng dạy" },
    ],
  },
  {
    title: "Nâng cao",
    items: [{ key: "constraints", label: "Bước 8: Cài đặt ràng buộc" }],
  },
];
