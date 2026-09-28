import { useState } from "react";
import PanelTitle from "../common/PanelTitle";
import { nextId, abbreviateName } from "../../utils/helpers";

export default function TeachersStep({ teachers, setTeachers, departments, assignments }) {
  const [draft, setDraft] = useState("");
  const update = (id, patch) =>
    setTeachers((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    );

  function add() {
    const v = draft.trim();
    if (!v) return;
    setTeachers((prev) => [
      ...prev,
      {
        id: nextId("t"),
        fullName: v,
        short: abbreviateName(v),
        departmentIds: [],
      },
    ]);
    setDraft("");
  }

  return (
    <div className="panel">
      <PanelTitle
        title="Giáo viên"
        actions={
          <div className="btn-row tight">
            <button className="btn btn-info btn-sm">Ràng buộc</button>
            <button className="btn btn-primary btn-sm">Chọn giáo viên</button>
            <button className="btn btn-primary btn-sm">
              Nhập danh sách giáo viên
            </button>
          </div>
        }
      />
      <p className="hint">
        Tên rút gọn tự sinh từ họ tên: viết tắt họ và chữ đệm, giữ nguyên tên
        cuối. Ví dụ Nguyễn Văn An → N.V.An. Bạn vẫn sửa lại được.
      </p>
      <table className="grid-table">
        <thead>
          <tr>
            <th className="w-stt">STT</th>
            <th>Tên giáo viên</th>
            <th>Tên rút gọn</th>
            <th>Nhóm (tổ)</th>
            <th className="w-act2">Hành động</th>
          </tr>
        </thead>
        <tbody>
          {teachers.map((t, i) => {
            const soTiet = assignments
              .filter((a) => a.teacherId === t.id)
              .reduce((s, a) => s + Number(a.soTiet || 0), 0);
            return (
              <tr key={t.id}>
                <td className="stt">{i + 1}</td>
                <td>
                  <input
                    value={t.fullName}
                    onChange={(e) =>
                      update(t.id, {
                        fullName: e.target.value,
                        short: abbreviateName(e.target.value),
                      })
                    }
                  />
                </td>
                <td>
                  <input
                    value={t.short}
                    onChange={(e) => update(t.id, { short: e.target.value })}
                  />
                </td>
                <td>
                  <div className="chip-cell">
                    {t.departmentIds.map((id) => {
                      const d = departments.find((x) => x.id === id);
                      if (!d) return null;
                      return (
                        <span className="tag" key={id}>
                          <button
                            onClick={() =>
                              update(t.id, {
                                departmentIds: t.departmentIds.filter(
                                  (x) => x !== id,
                                ),
                              })
                            }
                            aria-label={`Bỏ ${d.name}`}
                          >
                            ×
                          </button>
                          {d.name}
                        </span>
                      );
                    })}
                    <select
                      value=""
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v && !t.departmentIds.includes(v))
                          update(t.id, {
                            departmentIds: [...t.departmentIds, v],
                          });
                      }}
                    >
                      <option value="">+ tổ</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </td>
                <td className="actions">
                  <button className="btn btn-primary btn-sm">
                    Chi tiết ({soTiet} tiết)
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() =>
                      setTeachers((prev) => prev.filter((x) => x.id !== t.id))
                    }
                  >
                    Xóa
                  </button>
                </td>
              </tr>
            );
          })}
          <tr className="add-row">
            <td className="stt">{teachers.length + 1}</td>
            <td>
              <input
                value={draft}
                placeholder="Mời nhập họ tên giáo viên"
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && add()}
              />
            </td>
            <td className="muted">
              {draft.trim() ? abbreviateName(draft) : ""}
            </td>
            <td />
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
