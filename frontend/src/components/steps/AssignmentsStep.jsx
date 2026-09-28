import { useState, useMemo } from "react";
import PanelTitle from "../common/PanelTitle";
import { newAssignment } from "../../utils/helpers";

export default function AssignmentsStep({
  assignments,
  setAssignments,
  classes,
  subjects,
  teachers,
  grades,
  filter,
  setFilter,
  onGoToTimetable,
  onOpenFramework,
}) {
  const [subjectId, setSubjectId] = useState(subjects[0] ? subjects[0].id : "");
  const [teacherId, setTeacherId] = useState("");
  const [soTiet, setSoTiet] = useState(1);

  const visibleClasses = useMemo(() => {
    if (filter.classId) return classes.filter((c) => c.id === filter.classId);
    if (filter.gradeId)
      return classes.filter((c) => c.gradeId === filter.gradeId);
    return classes;
  }, [classes, filter]);

  const targetClassId =
    filter.classId || (visibleClasses[0] ? visibleClasses[0].id : "");

  function add() {
    if (!targetClassId || !subjectId) return;
    setAssignments((prev) => [
      ...prev,
      newAssignment({
        classId: targetClassId,
        subjectId,
        teacherId,
        soTiet: Math.max(1, Number(soTiet) || 1),
      }),
    ]);
    setSoTiet(1);
  }
  function applyToAll() {
    if (!subjectId) return;
    setAssignments((prev) => [
      ...prev,
      ...visibleClasses.map((c) =>
        newAssignment({
          classId: c.id,
          subjectId,
          teacherId,
          soTiet: Math.max(1, Number(soTiet) || 1),
        }),
      ),
    ]);
  }

  return (
    <div className="panel">
      <PanelTitle
        title="Phân công giảng dạy"
        actions={
          <button className="btn btn-primary btn-sm" onClick={onGoToTimetable}>
            Sang bảng xếp tiết
          </button>
        }
      />
      <p className="hint">
        Đây là bản gộp của tất cả khung chương trình. Muốn chỉnh riêng một lớp
        kèm lịch nghỉ và tiết cố định, mở Khung CT của lớp đó ở Bước 6.
      </p>

      <div className="filter-bar">
        <label>
          Khối
          <select
            value={filter.gradeId || ""}
            onChange={(e) =>
              setFilter({ gradeId: e.target.value, classId: "" })
            }
          >
            <option value="">Tất cả</option>
            {grades.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Lớp
          <select
            value={filter.classId || ""}
            onChange={(e) => setFilter({ ...filter, classId: e.target.value })}
          >
            <option value="">Tất cả</option>
            {classes
              .filter((c) => !filter.gradeId || c.gradeId === filter.gradeId)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </label>
        {filter.classId && (
          <button
            className="btn btn-info btn-sm"
            onClick={() =>
              onOpenFramework({ type: "class", id: filter.classId })
            }
          >
            Mở Khung CT của lớp này
          </button>
        )}
      </div>

      <div className="assign-form">
        <select
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
        >
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          value={teacherId}
          onChange={(e) => setTeacherId(e.target.value)}
        >
          <option value="">-- Chưa phân công giáo viên --</option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.short} — {t.fullName}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={1}
          max={30}
          value={soTiet}
          onChange={(e) => setSoTiet(e.target.value)}
          title="Số tiết trong tuần"
        />
        <button
          className="btn btn-primary"
          onClick={add}
          disabled={!targetClassId}
        >
          Thêm cho{" "}
          {targetClassId
            ? classes.find((c) => c.id === targetClassId)?.name
            : "lớp"}
        </button>
        <button className="btn btn-info" onClick={applyToAll}>
          Áp dụng cho {visibleClasses.length} lớp đang lọc
        </button>
      </div>

      <table className="grid-table">
        <thead>
          <tr>
            <th className="w-stt">STT</th>
            <th>Lớp</th>
            <th>Môn học</th>
            <th>Giáo viên</th>
            <th className="w-act">Số tiết/tuần</th>
            <th className="w-act">Cố định</th>
            <th className="w-act">Hành động</th>
          </tr>
        </thead>
        <tbody>
          {assignments.filter((a) =>
            visibleClasses.some((c) => c.id === a.classId),
          ).length === 0 && (
            <tr>
              <td colSpan={7} className="empty">
                Chưa có phân công nào cho phạm vi đang lọc.
              </td>
            </tr>
          )}
          {assignments
            .filter((a) => visibleClasses.some((c) => c.id === a.classId))
            .map((a, i) => {
              const klass = classes.find((c) => c.id === a.classId);
              return (
                <tr key={a.id}>
                  <td className="stt">{i + 1}</td>
                  <td>{klass ? klass.name : "?"}</td>
                  <td>
                    <select
                      value={a.subjectId}
                      onChange={(e) =>
                        setAssignments((prev) =>
                          prev.map((x) =>
                            x.id === a.id
                              ? { ...x, subjectId: e.target.value }
                              : x,
                          ),
                        )
                      }
                    >
                      <option value="">Mời chọn môn</option>
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      value={a.teacherId}
                      onChange={(e) =>
                        setAssignments((prev) =>
                          prev.map((x) =>
                            x.id === a.id
                              ? { ...x, teacherId: e.target.value }
                              : x,
                          ),
                        )
                      }
                    >
                      <option value="">-- Chưa phân công --</option>
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.short}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={a.soTiet}
                      onChange={(e) =>
                        setAssignments((prev) =>
                          prev.map((x) =>
                            x.id === a.id
                              ? { ...x, soTiet: e.target.value }
                              : x,
                          ),
                        )
                      }
                    />
                  </td>
                  <td className="center">
                    {(a.fixed || []).length ? (
                      `${a.fixed.length} tiết`
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td className="center">
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() =>
                        setAssignments((prev) =>
                          prev.filter((x) => x.id !== a.id),
                        )
                      }
                    >
                      Xóa
                    </button>
                  </td>
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  );
}
