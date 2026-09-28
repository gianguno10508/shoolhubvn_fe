import { useMemo, useState } from "react";
import {
  getDays,
  getSessions,
  getTiets,
  slotKey,
  slotLabel,
} from "../../utils/timeHelpers";
import { newAssignment } from "../../utils/newAssignment";
import { SlotPicker } from "./SlotPicker";

export function FrameworkView({
  scope,
  classes,
  grades,
  subjects,
  teachers,
  config,
  items,
  setItems,
  setClasses,
  effectiveSchedule,
  lessonById,
  gradeAssignments,
  schedule,
  setSchedule,
  notify,
  onClose,
  onNext,
  onSaved,
}) {
  const isClass = scope.type === "class";
  const klass = isClass ? classes.find((c) => c.id === scope.id) : null;
  const grade = isClass
    ? grades.find((g) => g.id === (klass ? klass.gradeId : ""))
    : grades.find((g) => g.id === scope.id);

  const days = getDays(config.soNgay);
  const sessions = getSessions(config.soBuoi);
  const tiets = getTiets(config.soTiet);

  const [busyScope, setBusyScope] = useState("khoi");
  const [picker, setPicker] = useState(null); // assignment id đang mở bảng Cố định - Tránh
  const [syncGradeId, setSyncGradeId] = useState(grade ? grade.id : "");
  const [draftSubject, setDraftSubject] = useState("");
  const [draftTeacher, setDraftTeacher] = useState("");
  const [draftSoTiet, setDraftSoTiet] = useState(1);
  const [draftLienTiep, setDraftLienTiep] = useState(1);

  const offSlots = useMemo(
    () => new Set(klass ? klass.offSlots || [] : []),
    [klass],
  );
  const rows = items;

  const totalKhungCT = rows.reduce((s, a) => s + Number(a.soTiet || 0), 0);
  const totalSlots =
    days.length * sessions.length * tiets.length -
    (isClass ? offSlots.size : 0);

  function update(id, patch) {
    setItems((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }

  function addRow() {
    if (!draftSubject) return;
    setItems((prev) => [
      ...prev,
      newAssignment({
        classId: isClass ? scope.id : "",
        gradeId: isClass ? "" : scope.id,
        subjectId: draftSubject,
        teacherId: draftTeacher,
        soTiet: Math.max(1, Number(draftSoTiet) || 1),
        tietLienTiep: Math.max(1, Number(draftLienTiep) || 1),
      }),
    ]);
    setDraftSubject("");
    setDraftTeacher("");
    setDraftSoTiet(1);
    setDraftLienTiep(1);
  }

  function toggleOff(slot) {
    if (!isClass) return;
    const turningOn = !offSlots.has(slot);
    setClasses((prev) =>
      prev.map((c) => {
        if (c.id !== scope.id) return c;
        const list = c.offSlots || [];
        return {
          ...c,
          offSlots: list.includes(slot)
            ? list.filter((s) => s !== slot)
            : [...list, slot],
        };
      }),
    );
    if (turningOn) {
      const key = `${slot}|${scope.id}`;
      let hadLesson = false;
      setSchedule((prev) => {
        if (!prev[key]) return prev;
        hadLesson = true;
        const next = { ...prev };
        delete next[key];
        return next;
      });
      if (hadLesson && notify) {
        notify(
          `Đã gỡ tiết đang xếp ở ${slotLabel(slot)} về danh sách chưa xếp vì lớp nghỉ tiết này.`,
        );
      }
    }
  }

  /* Ô chỉ hiện tiết của chính lớp này; lớp khác trong khối chỉ hiện tên lớp đang bận. */
  function cellInfo(slot) {
    const own = isClass
      ? lessonById[effectiveSchedule[`${slot}|${scope.id}`]]
      : null;
    const locked = !!(own && own.pinnedSlot === slot);
    let others = [];
    if (busyScope === "khoi") {
      const gradeId = isClass ? (klass ? klass.gradeId : "") : scope.id;
      others = classes
        .filter((c) => c.gradeId === gradeId && c.id !== scope.id)
        .filter((c) => effectiveSchedule[`${slot}|${c.id}`])
        .map((c) => c.name);
    }
    return { own, locked, others };
  }

  const pickerItem = picker ? rows.find((a) => a.id === picker) : null;

  return (
    <div className="panel fw-panel">
      <div className="fw-head">
        <span className="fw-name">
          {isClass ? (klass ? klass.name : "Lớp") : grade ? grade.name : "Khối"}
        </span>
        {isClass && (
          <button className="btn btn-danger btn-sm" onClick={onNext}>
            ⏩ Kế tiếp
          </button>
        )}
        <div className="spacer" />
        <button className="btn btn-primary btn-sm" onClick={onClose}>
          Đóng
        </button>
        <button className="btn btn-warn btn-sm" onClick={onSaved}>
          Lưu
        </button>
      </div>

      {isClass && (
        <>
          <p className={"fw-warn " + (totalKhungCT > totalSlots ? "over" : "")}>
            {totalKhungCT > totalSlots
              ? `Số tiết trong Khung CT (${totalKhungCT} tiết) lớn hơn số ô còn lại trong TKB (${totalSlots} tiết), sẽ không xếp hết được.`
              : `Số tiết trong Khung CT (${totalKhungCT} tiết) nhỏ hơn số tiết trong TKB (${totalSlots} tiết), TKB khi xếp sẽ có tiết trống giữa buổi.`}
          </p>

          <div className="fw-radio">
            <label>
              <input
                type="radio"
                checked={busyScope === "khoi"}
                onChange={() => setBusyScope("khoi")}
              />
              Xem tiết bận của cả lớp và khối
            </label>
            <label>
              <input
                type="radio"
                checked={busyScope === "lop"}
                onChange={() => setBusyScope("lop")}
              />
              Xem tiết bận của riêng lớp
            </label>
          </div>

          <div className="fw-guide">
            <strong>Hướng dẫn:</strong> nhấn vào những vị trí mà lớp không phải
            học
          </div>
          <div className="fw-legend-bar">Nghỉ</div>

          <div className="fw-grid-wrap">
            <table className="fw-grid">
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
                        <td className="fw-session" rowSpan={tiets.length}>
                          {session}
                        </td>
                      )}
                      <td className="fw-tiet">Tiết {tiet}</td>
                      {days.map((d) => {
                        const slot = slotKey(d, session, tiet);
                        const off = offSlots.has(slot);
                        const { own, locked, others } = cellInfo(slot);
                        let cls = "fw-cell ";
                        let text = "Trống";
                        if (off) {
                          cls += "off";
                          text = "Nghỉ";
                        } else if (locked) {
                          cls += "locked";
                          text = own.subjectName;
                        } else if (own) {
                          cls += "busy";
                          text = own.subjectName;
                        } else if (others.length) {
                          cls += "other";
                          text = others.join(", ");
                        } else cls += "free";
                        return (
                          <td
                            key={slot}
                            className={cls}
                            onClick={() => {
                              if (!locked) toggleOff(slot);
                            }}
                            title={
                              locked
                                ? "Tiết cố định, không đổi được"
                                : off
                                  ? "Bấm để bỏ nghỉ"
                                  : others.length
                                    ? `Lớp đang bận: ${others.join(", ")}`
                                    : "Bấm để đánh dấu lớp nghỉ tiết này"
                            }
                          >
                            {text}
                          </td>
                        );
                      })}
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="fw-sub-head">
        <h3>
          {isClass
            ? "Bước 6.2: Khung chương trình"
            : "Khung chương trình của khối"}
        </h3>
        <div className="spacer" />
        {isClass && (
          <div className="fw-sync">
            <span>Đồng bộ với khung chương trình của khối:</span>
            <select
              value={syncGradeId}
              onChange={(e) => setSyncGradeId(e.target.value)}
            >
              {grades.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            <button
              className="btn btn-danger btn-sm"
              onClick={() => {
                const src = gradeAssignments.filter(
                  (a) => a.gradeId === syncGradeId,
                );
                if (src.length === 0) return;
                if (
                  !window.confirm(
                    "Thay thế khung chương trình hiện tại của lớp bằng khung của khối?",
                  )
                )
                  return;
                setItems((prev) => [
                  ...prev.filter((a) => a.classId !== scope.id),
                  ...src.map((a) =>
                    newAssignment({
                      classId: scope.id,
                      subjectId: a.subjectId,
                      teacherId: a.teacherId,
                      soTiet: a.soTiet,
                      tietLienTiep: a.tietLienTiep,
                      fixed: [...(a.fixed || [])],
                      avoid: [...(a.avoid || [])],
                    }),
                  ),
                ]);
              }}
            >
              Đồng bộ
            </button>
          </div>
        )}
      </div>

      <div className="fw-note">
        Cột <strong>Cố định - Tránh</strong>: tiết cố định sẽ được khóa đúng vị
        trí đã chọn và không thể gỡ hay đổi chỗ trong thời khóa biểu. Tiết tránh
        là vị trí không được phép xếp.
      </div>

      <table className="grid-table">
        <thead>
          <tr>
            <th className="w-stt">STT</th>
            <th>Môn</th>
            <th>Giáo viên</th>
            <th className="w-act">Số tiết / tuần</th>
            <th className="w-act">Cấu hình tiết liên tiếp</th>
            <th className="w-act">Cố định - Tránh</th>
            <th className="w-act">Hành động</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="empty">
                Chưa có môn nào trong khung chương trình.
              </td>
            </tr>
          )}
          {rows.map((a, i) => {
            const subject = subjects.find((s) => s.id === a.subjectId);
            const over = (a.fixed || []).length > Number(a.soTiet || 0);
            return (
              <tr key={a.id}>
                <td className="stt center">{i + 1}</td>
                <td className="center">
                  <select
                    value={a.subjectId}
                    onChange={(e) =>
                      update(a.id, { subjectId: e.target.value })
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
                      update(a.id, { teacherId: e.target.value })
                    }
                  >
                    <option value="">Mời chọn giáo viên</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.fullName}
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
                    onChange={(e) => update(a.id, { soTiet: e.target.value })}
                    className={over ? "bad" : ""}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={a.tietLienTiep}
                    onChange={(e) =>
                      update(a.id, { tietLienTiep: e.target.value })
                    }
                  />
                </td>
                <td className="center">
                  <button
                    className="btn btn-info btn-sm"
                    onClick={() => setPicker(a.id)}
                  >
                    {(a.fixed || []).length} - {(a.avoid || []).length} tiết
                  </button>
                </td>
                <td className="center">
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() =>
                      setItems((prev) => prev.filter((x) => x.id !== a.id))
                    }
                  >
                    Xóa
                  </button>
                </td>
              </tr>
            );
          })}
          <tr className="add-row">
            <td className="stt center">{rows.length + 1}</td>
            <td>
              <select
                value={draftSubject}
                onChange={(e) => setDraftSubject(e.target.value)}
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
                value={draftTeacher}
                onChange={(e) => setDraftTeacher(e.target.value)}
              >
                <option value="">Mời chọn giáo viên</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.fullName}
                  </option>
                ))}
              </select>
            </td>
            <td>
              <input
                type="number"
                min={1}
                value={draftSoTiet}
                onChange={(e) => setDraftSoTiet(e.target.value)}
              />
            </td>
            <td>
              <input
                type="number"
                min={1}
                value={draftLienTiep}
                onChange={(e) => setDraftLienTiep(e.target.value)}
              />
            </td>
            <td colSpan={2} className="center">
              <button className="btn btn-add" onClick={addRow}>
                +
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      {pickerItem && (
        <SlotPicker
          item={pickerItem}
          subject={subjects.find((s) => s.id === pickerItem.subjectId)}
          config={config}
          offSlots={offSlots}
          onClose={() => setPicker(null)}
          onChange={(patch) => update(pickerItem.id, patch)}
        />
      )}
    </div>
  );
}

export default FrameworkView;
