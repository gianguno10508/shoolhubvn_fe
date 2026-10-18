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
        tietLienTiep: 1,
        monChinh: false,
      },
    ]);
    setDraft("");
  }

  return (
    <div className="panel">
      <PanelTitle title="Môn học" />
      <p className="hint">
        Tiết liên tiếp là số tiết học liền nhau mặc định khi thêm môn vào Khung CT (ví dụ Toán 2 tiết liền). Đánh dấu
        môn chính để được ưu tiên xếp buổi sáng (bật trong Ràng buộc xếp lịch).
      </p>
      <table className="grid-table">
        <thead>
          <tr>
            <th className="w-stt">STT</th>
            <th>Tên môn</th>
            <th>Rút gọn</th>
            <th>
              Tiết liên tiếp <small>Số tiết học liền nhau</small>
            </th>
            <th className="w-act">Môn chính</th>
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
                  type="number"
                  min={1}
                  max={4}
                  value={s.tietLienTiep}
                  onChange={(e) =>
                    update(s.id, { tietLienTiep: e.target.value })
                  }
                />
              </td>
              <td className="center">
                <button
                  className={"toggle" + (s.monChinh ? " on" : "")}
                  onClick={() => update(s.id, { monChinh: !s.monChinh })}
                  aria-pressed={!!s.monChinh}
                  aria-label={`Môn chính: ${s.name}`}
                >
                  <span />
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
            <td colSpan={3} />
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
