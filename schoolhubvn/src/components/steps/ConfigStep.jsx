import { getDays, getSessions, getTiets } from "../../utils/timeHelpers";
import { Field } from "../common/Field";
import { PanelTitle } from "../common/PanelTitle";

export function ConfigStep({
  config,
  setConfig,
  onSaved,
  onOpenConstraints,
  onResetData,
}) {
  const days = getDays(config.soNgay);
  const sessions = getSessions(config.soBuoi);
  const tiets = getTiets(config.soTiet);
  const set = (field, value) =>
    setConfig((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="panel">
      <PanelTitle title="Cài đặt" />
      <div className="config-grid">
        <Field label="Tên thời khóa biểu">
          <input
            value={config.tenTKB}
            onChange={(e) => set("tenTKB", e.target.value)}
          />
        </Field>
        <Field label="Tên trường học">
          <input
            value={config.tenTruong}
            onChange={(e) => set("tenTruong", e.target.value)}
            placeholder="Nhập tên trường học"
          />
        </Field>
        <Field label="Năm học">
          <input
            value={config.namHoc}
            onChange={(e) => set("namHoc", e.target.value)}
            placeholder="Nhập năm học"
          />
        </Field>
        <Field label="Số ngày trong tuần (không nên sửa)" warn>
          <select
            value={config.soNgay}
            onChange={(e) => set("soNgay", Number(e.target.value))}
          >
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Số buổi trong ngày (không nên sửa)" warn>
          <select
            value={config.soBuoi}
            onChange={(e) => set("soBuoi", Number(e.target.value))}
          >
            <option value={1}>1</option>
            <option value={2}>2</option>
          </select>
        </Field>
        <Field label="Số tiết trong buổi (không nên sửa)" warn>
          <select
            value={config.soTiet}
            onChange={(e) => set("soTiet", Number(e.target.value))}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Phương sai">
          <div className="with-addon">
            <input
              type="number"
              min={0}
              value={config.phuongSai}
              onChange={(e) => set("phuongSai", e.target.value)}
            />
            <button
              className="addon-btn"
              title="Đặt lại phương sai"
              onClick={() => set("phuongSai", 1)}
            >
              ⟳
            </button>
          </div>
        </Field>
        <Field label="Thuật toán">
          <select
            value={config.thuatToan}
            onChange={(e) => set("thuatToan", e.target.value)}
          >
            <option>Thuật toán 1 (nhanh)</option>
            <option>Thuật toán 2</option>
            <option>Thuật toán 3</option>
            <option>Thuật toán 4 (tối ưu)</option>
          </select>
        </Field>
        <div />
      </div>

      <div className="row-right">
        <button className="btn btn-primary" onClick={onSaved}>
          Lưu cài đặt
        </button>
      </div>

      <PanelTitle title="Chức năng nâng cao" />
      <div className="btn-row">
        <button className="btn btn-info" onClick={onOpenConstraints}>
          Cài đặt ràng buộc thời khóa biểu
        </button>
        <button className="btn btn-info" onClick={onOpenConstraints}>
          Cài đặt ràng buộc mới (thử nghiệm)
        </button>
      </div>
      <div className="btn-row">
        <button className="btn btn-danger" onClick={onResetData}>
          Xóa dữ liệu của thời khóa biểu
        </button>
      </div>

      <PanelTitle title="Giao diện" />
      <div className="preview-wrap">
        <table className="preview-grid">
          <thead>
            <tr>
              <th colSpan={2} />
              {days.map((d) => (
                <th key={d}>{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sessions.map((session) =>
              tiets.map((tiet, i) => (
                <tr key={session + tiet}>
                  {i === 0 && (
                    <td className="prev-session" rowSpan={tiets.length}>
                      {session}
                    </td>
                  )}
                  <td className="prev-tiet">Tiết {tiet}</td>
                  {days.map((d) => (
                    <td key={d + tiet} />
                  ))}
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ConfigStep;
