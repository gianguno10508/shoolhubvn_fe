import { useState } from "react";
import { nextId } from "../../utils/idGenerator";
import { PanelTitle } from "../common/PanelTitle";

export function DepartmentsStep({
  departments,
  setDepartments,
  teachers,
  onOpenTeachers,
}) {
  const [draft, setDraft] = useState("");
  function add() {
    const v = draft.trim();
    if (!v) return;
    setDepartments((prev) => [...prev, { id: nextId("d"), name: v }]);
    setDraft("");
  }
  return (
    <div className="panel">
      <PanelTitle title="Nhóm giáo viên (Tổ bộ môn)" />
      <table className="grid-table">
        <thead>
          <tr>
            <th className="w-stt">STT</th>
            <th>Tên nhóm giáo viên (tổ bộ môn)</th>
            <th className="w-act2">Hành động</th>
          </tr>
        </thead>
        <tbody>
          {departments.map((d, i) => (
            <tr key={d.id}>
              <td className="stt">{i + 1}</td>
              <td>
                <input
                  value={d.name}
                  onChange={(e) =>
                    setDepartments((prev) =>
                      prev.map((x) =>
                        x.id === d.id ? { ...x, name: e.target.value } : x,
                      ),
                    )
                  }
                />
              </td>
              <td className="actions">
                <button
                  className="btn btn-primary btn-sm"
                  onClick={onOpenTeachers}
                >
                  Chi tiết (
                  {
                    teachers.filter((t) => t.departmentIds.includes(d.id))
                      .length
                  }
                  )
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() =>
                    setDepartments((prev) => prev.filter((x) => x.id !== d.id))
                  }
                >
                  Xóa
                </button>
              </td>
            </tr>
          ))}
          <tr className="add-row">
            <td className="stt">{departments.length + 1}</td>
            <td>
              <input
                value={draft}
                placeholder="Mời nhập nhóm giáo viên (tổ bộ môn)"
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && add()}
              />
            </td>
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

export default DepartmentsStep;
