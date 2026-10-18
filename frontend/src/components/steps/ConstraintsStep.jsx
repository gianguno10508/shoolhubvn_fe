import PanelTitle from "../common/PanelTitle";

export default function ConstraintsStep({ constraints, setConstraints }) {
  const set = (field, value) =>
    setConstraints((prev) => ({ ...prev, [field]: value }));
  return (
    <div className="panel">
      <PanelTitle title="Cài đặt ràng buộc" />
      <p className="hint">
        Áp dụng khi bấm “Xếp tự động”. Luôn đảm bảo: không trùng giờ giáo viên,
        không xếp vào tiết nghỉ / tiết tránh, các tiết cùng môn trong một buổi
        luôn liền nhau và mỗi môn được rải đều sang các ngày khác nhau.
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
          Ưu tiên xếp môn chính vào buổi sáng (đánh dấu môn chính ở mục Môn học)
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
