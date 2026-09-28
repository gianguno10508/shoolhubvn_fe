import { useState } from "react";
import PanelTitle from "../common/PanelTitle";
import { nextId } from "../../utils/helpers";

export default function ClassesStep({
  classes,
  setClasses,
  grades,
  campuses,
  assignments,
  config,
  onOpenFramework,
}) {
  const [draft, setDraft] = useState("");
  const [draftGrade, setDraftGrade] = useState(grades[0] ? grades[0].id : "");
  const update = (id, patch) =>
    setClasses((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    );

  function add() {
    const v = draft.trim();
    if (!v) return;
    setClasses((prev) => [
      ...prev,
      {
        id: nextId("c"),
        name: v,
        gradeId: draftGrade,
        campusId: "",
        offSlots: [],
      },
    ]);
    setDraft("");
  }

  return (
    <div className="panel">
      <PanelTitle
        title="Lớp học"
        actions={
          <div className="btn-row tight">
            <button className="btn btn-info btn-sm">Tiết học</button>
            <button className="btn btn-primary btn-sm">Chọn lớp học</button>
            <button className="btn btn-primary btn-sm">
              Nhập danh sách lớp
            </button>
          </div>
        }
      />
      <table className="grid-table">
        <thead>
          <tr>
            <th className="w-stt">STT</th>
            <th>Tên Lớp học</th>
            <th>Nhóm lớp (Khối)</th>
            <th>Điểm trường</th>
            <th className="w-act">Khung Chương trình</th>
            <th className="w-act">Hành động</th>
          </tr>
        </thead>
        <tbody>
          {classes.map((c, i) => {
            return (
              <tr key={c.id}>
                <td className="stt">{i + 1}</td>
                <td>
                  <input
                    value={c.name}
                    onChange={(e) => update(c.id, { name: e.target.value })}
                  />
                </td>
                <td>
                  <select
                    value={c.gradeId}
                    onChange={(e) => update(c.id, { gradeId: e.target.value })}
                  >
                    <option value="">-- Chọn khối --</option>
                    {grades.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  {campuses.length === 0 ? (
                    <span className="muted">Không có điểm trường</span>
                  ) : (
                    <select
                      value={c.campusId}
                      onChange={(e) =>
                        update(c.id, { campusId: e.target.value })
                      }
                    >
                      <option value="">Không có điểm trường</option>
                      {campuses.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  )}
                </td>
                <td className="center">
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => onOpenFramework({ type: "class", id: c.id })}
                  >
                    Khung CT
                  </button>
                </td>
                <td className="center">
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() =>
                      setClasses((prev) => prev.filter((x) => x.id !== c.id))
                    }
                  >
                    Xóa
                  </button>
                </td>
              </tr>
            );
          })}
          <tr className="add-row">
            <td className="stt">{classes.length + 1}</td>
            <td>
              <input
                value={draft}
                placeholder="Mời nhập tên lớp học"
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && add()}
              />
            </td>
            <td>
              <select
                value={draftGrade}
                onChange={(e) => setDraftGrade(e.target.value)}
              >
                <option value="">-- Chọn khối --</option>
                {grades.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </td>
            <td colSpan={2} />
            <td className="center">
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
