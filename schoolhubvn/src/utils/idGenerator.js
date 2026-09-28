/* ================= sinh id duy nhất ================= */

let uidCounter = 100;

/**
 * Sinh 1 id mới, duy nhất trong phiên làm việc, có tiền tố cho dễ nhận biết
 * (vd: "su" cho môn học, "t" cho giáo viên, "c" cho lớp, "a" cho phân công...).
 *
 * Khi thêm loại dữ liệu mới trong tương lai, chỉ cần gọi nextId("prefix-moi").
 */
export function nextId(prefix) {
  uidCounter += 1;
  return prefix + uidCounter;
}
