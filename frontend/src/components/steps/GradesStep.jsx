import { useState } from "react";
import PanelTitle from "../common/PanelTitle";
import { nextId } from "../../utils/helpers";

export default function GradesStep({
  grades,
  setGrades,
  classes,
  gradeAssignments,
  onOpenFramework,
}) {
  const [draft, setDraft] = useState("");
  function add() {
    const v = draft.trim();
    if (!v) return;
    setGrades((prev) => [
      ...prev,
      { id: nextId("g"), name: v, laDiemTruong: false },
    ]);
    setDraft("");
  }
  return (
    <div className="panel">
      <PanelTitle title="Nhóm lớp (Khối)" />
      <p className="hint">
        Khung CT của khối là bản mẫu. Mỗi lớp có thể đồng bộ từ bản mẫu này rồi
        chỉnh riêng.
      </p>
      <table className="grid-table">
        <thead>
          <tr>
            <th className="w-stt">STT</th>
            <th>Tên Nhóm lớp (Khối)</th>
            <th className="w-act">Là điểm trường</th>
            <th className="w-act">Khung Chương trình</th>
            <th className="w-act">Hành động</th>
          </tr>
        </thead>
        <tbody>
          {grades.map((g, i) => (
            <tr key={g.id}>
              <td className="stt">{i + 1}</td>
              <td>
                <input
                  value={g.name}
                  onChange={(e) =>
                    setGrades((prev) =>
                      prev.map((x) =>
                        x.id === g.id ? { ...x, name: e.target.value } : x,
                      ),
                    )
                  }
                />
              </td>
              <td className="center">
                <button
                  className={"toggle" + (g.laDiemTruong ? " on" : "")}
                  onClick={() =>
                    setGrades((prev) =>
                      prev.map((x) =>
                        x.id === g.id
                          ? { ...x, laDiemTruong: !x.laDiemTruong }
                          : x,
                      ),
                    )
                  }
                  aria-pressed={g.laDiemTruong}
                >
                  <span />
                </button>
              </td>
              <td className="center">
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => onOpenFramework({ type: "grade", id: g.id })}
                >
                  Khung CT
                </button>
              </td>
              <td className="center">
                <button
                  className="btn btn-danger btn-sm"
                  disabled={classes.some((c) => c.gradeId === g.id)}
                  title={
                    classes.some((c) => c.gradeId === g.id)
                      ? "Còn lớp thuộc khối này"
                      : ""
                  }
                  onClick={() =>
                    setGrades((prev) => prev.filter((x) => x.id !== g.id))
                  }
                >
                  Xóa
                </button>
              </td>
            </tr>
          ))}
          <tr className="add-row">
            <td className="stt">{grades.length + 1}</td>
            <td>
              <input
                value={draft}
                placeholder="Mời nhập tên Nhóm lớp (Khối)"
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && add()}
              />
            </td>
            <td colSpan={3} className="center">
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
