import { nextId } from "../utils/idGenerator";
import { abbreviateName } from "../utils/textHelpers";

/* =================================================================
 * Dữ liệu mẫu để app có sẵn nội dung khi khởi động lần đầu.
 * Đây thuần là dữ liệu khởi tạo — muốn đổi trường mẫu, môn mẫu... chỉ
 * cần sửa ở file này, không ảnh hưởng logic các bước.
 * ================================================================= */

export const SEED_SUBJECTS = [
  { name: "Chào cờ", tietLienTiep: 1 },
  { name: "SHL", tietLienTiep: 1 },
  { name: "Toán", tietLienTiep: 2 },
  { name: "Vật lí", tietLienTiep: 2 },
  { name: "Hóa học", tietLienTiep: 2 },
  { name: "Sinh học", tietLienTiep: 1 },
  { name: "Ngữ văn", tietLienTiep: 2 },
  { name: "Lịch sử", tietLienTiep: 2 },
  { name: "Địa lí", tietLienTiep: 2 },
  { name: "Tiếng Anh", tietLienTiep: 2 },
  { name: "GDKTPL", tietLienTiep: 1 },
  { name: "HĐTN & HN", tietLienTiep: 1 },
].map((s) => ({
  id: nextId("su"),
  name: s.name,
  short: "",
  gioiHan: "",
  tietLienTiep: s.tietLienTiep,
  buoiToiDa: "",
  tietTranh: 0,
}));

export const SEED_DEPARTMENTS = ["KHTN", "KHXH"].map((name) => ({
  id: nextId("d"),
  name,
}));

export const SEED_TEACHERS = [
  { fullName: "Đặng Thị Chuyên", dept: 0 },
  { fullName: "La Mỹ Duyên", dept: 0 },
  { fullName: "Hoàng Thị Hà", dept: 1 },
  { fullName: "Ngô Thị Hiền", dept: 1 },
  { fullName: "Nông Thị Hồng", dept: 0 },
  { fullName: "Nguyễn Quang Hùng", dept: 0 },
  { fullName: "Chu Thị Hường", dept: 1 },
  { fullName: "Lăng Thị Yến", dept: 1 },
  { fullName: "Bàn Thị Mận", dept: 1 },
].map((t) => ({
  id: nextId("t"),
  fullName: t.fullName,
  short: abbreviateName(t.fullName),
  departmentIds: [SEED_DEPARTMENTS[t.dept].id],
}));

export const SEED_GRADES = ["KHỐI 10", "KHỐI 11", "KHỐI 12"].map((name) => ({
  id: nextId("g"),
  name,
  laDiemTruong: false,
}));

export const SEED_CLASSES = [
  "10A1",
  "10A2",
  "10A3",
  "10A4",
  "10A5",
  "10A6",
].map((name) => ({
  id: nextId("c"),
  name,
  gradeId: SEED_GRADES[0].id,
  campusId: "",
  offSlots: [],
}));
