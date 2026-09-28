import { PanelTitle } from "../common/PanelTitle";

/*
 * Muốn thêm ràng buộc mới trong tương lai:
 *  1. Thêm field mặc định vào DEFAULT_CONSTRAINTS (constants/appConstants.js).
 *  2. Thêm 1 dòng UI (checkbox hoặc number) bên dưới, gọi set("tenField", value).
 *  3. Áp dụng ràng buộc đó ở nơi thực sự kiểm tra/xếp tiết (App.jsx runCheck,
 *     hoặc TimetableView.handleCellClick / autoFill).
 */
export function ConstraintsStep({ constraints, setConstraints }) {
  const set = (field, value) =>
    setConstraints((prev) => ({ ...prev, [field]: value }));
  return (
    <div className="panel">
      <PanelTitle title="Cài đặt ràng buộc" />
      <p className="hint">
        Các ràng buộc này áp dụng khi kiểm tra dữ liệu và khi xếp tiết. Giáo
        viên không bị giới hạn số tiết trong ngày — chỉ lớp học mới bị giới hạn
        số tiết tối đa trong một buổi.
      </p>
      <div className="constraint-list">
        <label className="switch-row">
          <input
            type="checkbox"
            checked={constraints.khongTietTrong}
            onChange={(e) => set("khongTietTrong", e.target.checked)}
          />
          Không để tiết trống xen giữa các tiết trong cùng một buổi
        </label>
        <label className="switch-row">
          <input
            type="checkbox"
            checked={constraints.chaoCoTiet1Thu2}
            onChange={(e) => set("chaoCoTiet1Thu2", e.target.checked)}
          />
          Chào cờ luôn ở tiết 1 sáng thứ 2
        </label>
        <label className="switch-row">
          <input
            type="checkbox"
            checked={constraints.uuTienMonChinhBuoiSang}
            onChange={(e) => set("uuTienMonChinhBuoiSang", e.target.checked)}
          />
          Ưu tiên xếp môn chính vào buổi sáng
        </label>
        <label className="switch-row number">
          Số tiết tối đa của một lớp học trong một buổi
          <input
            type="number"
            min={1}
            max={10}
            value={constraints.lopToiDaTietTrenBuoi}
            onChange={(e) => set("lopToiDaTietTrenBuoi", e.target.value)}
          />
        </label>
      </div>
    </div>
  );
}

export default ConstraintsStep;
