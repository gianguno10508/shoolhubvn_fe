import { useState } from "react";
import { nextId } from "../../utils/idGenerator";
import { PanelTitle } from "../common/PanelTitle";

export function CampusesStep({ campuses, setCampuses, classes }) {
  const [draft, setDraft] = useState("");
  function add() {
    const v = draft.trim();
    if (!v) return;
    setCampuses((prev) => [...prev, { id: nextId("p"), name: v }]);
    setDraft("");
  }
  return (
    <div className="panel">
      <PanelTitle title="Điểm trường" />
      <p className="hint">Chỉ cần khai báo nếu trường có nhiều cơ sở.</p>
      <table className="grid-table">
        <thead>
          <tr>
            <th className="w-stt">STT</th>
            <th>Tên điểm trường</th>
            <th className="w-act">Số lớp</th>
            <th className="w-act">Hành động</th>
          </tr>
        </thead>
        <tbody>
          {campuses.length === 0 && (
            <tr>
              <td colSpan={4} className="empty">
                Chưa khai báo điểm trường nào.
              </td>
            </tr>
          )}
          {campuses.map((p, i) => (
            <tr key={p.id}>
              <td className="stt">{i + 1}</td>
              <td>
                <input
                  value={p.name}
                  onChange={(e) =>
                    setCampuses((prev) =>
                      prev.map((x) =>
                        x.id === p.id ? { ...x, name: e.target.value } : x,
                      ),
                    )
                  }
                />
              </td>
              <td className="center">
                {classes.filter((c) => c.campusId === p.id).length}
              </td>
              <td className="center">
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() =>
                    setCampuses((prev) => prev.filter((x) => x.id !== p.id))
                  }
                >
                  Xóa
                </button>
              </td>
            </tr>
          ))}
          <tr className="add-row">
            <td className="stt">{campuses.length + 1}</td>
            <td>
              <input
                value={draft}
                placeholder="Mời nhập tên điểm trường"
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && add()}
              />
            </td>
            <td colSpan={2} className="center">
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

export default CampusesStep;
