// utils/accountExport.js — xuất danh sách tài khoản (tên đăng nhập + mật khẩu mặc định) ra Excel để phát cho GV / HS
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { ROLE_LABEL } from "./permissions";
import { DEFAULT_PASSWORD, formatDate } from "./accountName";

const BORDER = { style: "thin", color: { argb: "FFD5DAE5" } };
const BOX = { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER };

/** @param {{ users: object[], title?: string, schoolName?: string, fileName?: string }} */
export async function exportAccountsExcel({ users, title = "DANH SÁCH TÀI KHOẢN", schoolName = "", fileName = "Tai-khoan.xlsx" }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "SchoolHub";
  const ws = wb.addWorksheet("Tài khoản");
  const headers = ["STT", "Họ và tên", "Ngày sinh", "Chức danh", "Lớp", "Tên đăng nhập", "Mật khẩu"];
  ws.columns = [{ width: 6 }, { width: 28 }, { width: 13 }, { width: 20 }, { width: 9 }, { width: 18 }, { width: 16 }];

  ws.mergeCells(1, 1, 1, headers.length);
  ws.getCell(1, 1).value = title;
  ws.getCell(1, 1).font = { bold: true, size: 14, color: { argb: "FF1E1B4B" } };
  ws.getCell(1, 1).alignment = { horizontal: "center" };
  ws.mergeCells(2, 1, 2, headers.length);
  ws.getCell(2, 1).value = [schoolName, `Mật khẩu mặc định: ${DEFAULT_PASSWORD} — đổi ngay sau khi đăng nhập lần đầu`]
    .filter(Boolean)
    .join(" · ");
  ws.getCell(2, 1).font = { italic: true, size: 10, color: { argb: "FF64748B" } };
  ws.getCell(2, 1).alignment = { horizontal: "center" };

  const head = ws.getRow(4);
  headers.forEach((h, i) => {
    const cell = head.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = BOX;
  });
  head.height = 22;

  users.forEach((u, i) => {
    const row = ws.getRow(5 + i);
    [
      i + 1,
      u.name || "",
      formatDate(u.birthDate),
      ROLE_LABEL[u.role] || u.role,
      u.className || "",
      u.username,
      u.mustChangePassword ? DEFAULT_PASSWORD : "(đã tự đổi)",
    ].forEach((v, c) => {
      const cell = row.getCell(c + 1);
      cell.value = v;
      cell.border = BOX;
      cell.alignment = { horizontal: c === 1 || c === 3 ? "left" : "center" };
      if (c === 5) cell.font = { bold: true, color: { argb: "FF3730A3" } };
    });
  });

  const buffer = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), fileName);
}
