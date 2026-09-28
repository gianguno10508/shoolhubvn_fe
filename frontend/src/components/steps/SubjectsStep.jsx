import { useState } from "react";
import PanelTitle from "../common/PanelTitle";
import { nextId } from "../../utils/helpers";

export default function SubjectsStep({ subjects, setSubjects }) {
  const [draft, setDraft] = useState("");
  const update = (id, patch) =>
    setSubjects((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    );

  function add() {
    const v = draft.trim();
    if (!v) return;
    setSubjects((prev) => [
      ...prev,
      {
        id: nextId("su"),
        name: v,
        short: "",
        gioiHan: "",
        tietLienTiep: 1,
        buoiToiDa: "",
        tietTranh: 0,
      },
    ]);
    setDraft("");
  }

  return (
    <div className="panel">
      <PanelTitle
        title="Môn học"
        actions={
          <div className="btn-row tight">
            <button className="btn btn-info btn-sm">Tiết tránh</button>
            <button className="btn btn-primary btn-sm">Chọn môn học</button>
            <button className="btn btn-primary btn-sm">
              Nhập danh sách môn
            </button>
          </div>
        }
      />
      <table className="grid-table">
        <thead>
          <tr>
            <th className="w-stt">STT</th>
            <th>Tên môn</th>
            <th>Rút gọn</th>
            <th>
              Giới hạn <small>Giới hạn cùng thời điểm</small>
            </th>
            <th>
              Tiết liên tiếp <small>Số tiết liên tiếp tối đa</small>
            </th>
            <th>
              Buổi tối đa <small>Số buổi tối đa trong một ngày</small>
            </th>
            <th className="w-act">Tiết tránh</th>
            <th className="w-act" />
          </tr>
        </thead>
        <tbody>
          {subjects.map((s, i) => (
            <tr key={s.id}>
              <td className="stt">{i + 1}</td>
              <td>
                <input
                  value={s.name}
                  onChange={(e) => update(s.id, { name: e.target.value })}
                />
              </td>
              <td>
                <input
                  value={s.short}
                  placeholder="Tên môn rút gọn (nếu cần)"
                  onChange={(e) => update(s.id, { short: e.target.value })}
                />
              </td>
              <td>
                <input
                  value={s.gioiHan}
                  placeholder="Không giới hạn"
                  onChange={(e) => update(s.id, { gioiHan: e.target.value })}
                />
              </td>
              <td>
                <input
                  type="number"
                  min={1}
                  value={s.tietLienTiep}
                  onChange={(e) =>
                    update(s.id, { tietLienTiep: e.target.value })
                  }
                />
              </td>
              <td>
                <input
                  value={s.buoiToiDa}
                  placeholder="Không giới hạn"
                  onChange={(e) => update(s.id, { buoiToiDa: e.target.value })}
                />
              </td>
              <td>
                <button className="btn btn-primary btn-sm block">
                  {s.tietTranh} tiết
                </button>
              </td>
              <td>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() =>
                    setSubjects((prev) => prev.filter((x) => x.id !== s.id))
                  }
                >
                  Xóa
                </button>
              </td>
            </tr>
          ))}
          <tr className="add-row">
            <td className="stt">{subjects.length + 1}</td>
            <td>
              <input
                value={draft}
                placeholder="Mời nhập tên môn học"
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && add()}
              />
            </td>
            <td colSpan={5} />
            <td>
              <button className="btn btn-add" onClick={add}>
                +
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
