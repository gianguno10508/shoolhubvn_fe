import { useState, useRef, useEffect, useMemo } from "react";

/* ---------- helpers ---------- */

let uidCounter = 100;
function nextId(prefix) {
  uidCounter += 1;
  return prefix + uidCounter;
}

function abbreviateName(fullName) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  const last = parts[parts.length - 1];
  const initials = parts
    .slice(0, -1)
    .map((p) => p.charAt(0).toLocaleUpperCase("vi-VN"))
    .join(".");
  return initials + "." + last;
}

const ALL_DAY_LABELS = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"];
function getDays(soNgay) {
  const n = Math.min(Math.max(Number(soNgay) || 1, 1), 7);
  return ALL_DAY_LABELS.slice(0, n);
}
function getSessions(soBuoi) {
  return Number(soBuoi) === 2 ? ["Sáng", "Chiều"] : ["Cả ngày"];
}
function getTiets(soTiet) {
  const n = Math.min(Math.max(Number(soTiet) || 1, 1), 5);
  return Array.from({ length: n }, (_, i) => i + 1);
}

function cellKey(day, session, tiet, classId) {
  return `${day}|${session}|${tiet}|${classId}`;
}
function parseKey(key) {
  const [day, session, tiet, classId] = key.split("|");
  return { day, session, tiet, classId };
}

/* ---------- seed data ---------- */

const SEED_SUBJECTS = [
  "Toán", "Ngữ văn", "Tiếng Anh", "Vật lí", "Hóa học",
  "Sinh học", "Lịch sử", "Địa lí", "GDCD", "Tin học", "Thể dục",
].map((name) => ({ id: nextId("su"), name }));

const SEED_DEPARTMENTS = [
  "Tổ Toán - Tin", "Tổ Văn - Sử - Địa", "Tổ Lý - Hóa - Sinh", "Tổ Ngoại ngữ", "Tổ GDTC - QP",
].map((name) => ({ id: nextId("d"), name }));

const SEED_TEACHERS = [
  { fullName: "Nguyễn Văn Long", dept: 0 },
  { fullName: "Trần Thị Kim Thoa", dept: 1 },
  { fullName: "Lê Thị Mai", dept: 3 },
].map((t) => ({ id: nextId("t"), fullName: t.fullName, departmentId: SEED_DEPARTMENTS[t.dept].id }));

const SEED_GRADES = ["Khối 10", "Khối 11", "Khối 12"].map((name) => ({ id: nextId("g"), name }));

const SEED_CLASSES = ["10A1", "10A2", "10A3"].map((name) => ({
  id: nextId("c"),
  name,
  gradeId: SEED_GRADES[0].id,
}));

const DEFAULT_CONFIG = {
  tenTKB: "Thời khóa biểu năm học",
  tenTruong: "",
  namHoc: "2025-2026",
  soNgay: 6,
  soBuoi: 2,
  soTiet: 5,
};

const TABS = [
  { key: "config", label: "1. Cấu hình chung" },
  { key: "subjects", label: "2. Môn học" },
  { key: "departments", label: "3. Tổ chuyên môn" },
  { key: "teachers", label: "4. Giáo viên" },
  { key: "grades", label: "5. Khối" },
  { key: "classes", label: "6. Lớp học" },
  { key: "timetable", label: "Thời khóa biểu" },
];

/* ---------- generic list editor (subjects / departments / grades) ---------- */

function NameListEditor({ title, hint, items, onAdd, onRemove, placeholder, emptyText }) {
  const [value, setValue] = useState("");
  function submit(e) {
    e.preventDefault();
    const v = value.trim();
    if (!v) return;
    onAdd(v);
    setValue("");
  }
  return (
    <div className="step-panel">
      <h2>{title}</h2>
      {hint && <p className="hint">{hint}</p>}
      <form className="inline-form" onSubmit={submit}>
        <input value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} />
        <button type="submit">Thêm</button>
      </form>
      <div className="chip-list">
        {items.length === 0 && <div className="empty">{emptyText}</div>}
        {items.map((it) => (
          <span className="chip" key={it.id}>
            {it.name}
            <button onClick={() => onRemove(it.id)} aria-label={`Xoá ${it.name}`}>×</button>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------- Step 1: Config ---------- */

function ConfigStep({ config, setConfig }) {
  function set(field, value) {
    setConfig((prev) => ({ ...prev, [field]: value }));
  }
  return (
    <div className="step-panel">
      <h2>Cấu hình chung</h2>
      <p className="hint">Thiết lập này quyết định cấu trúc bảng thời khóa biểu ở bước cuối.</p>
      <div className="form-grid">
        <label>
          Tên thời khóa biểu
          <input value={config.tenTKB} onChange={(e) => set("tenTKB", e.target.value)} />
        </label>
        <label>
          Tên trường
          <input value={config.tenTruong} onChange={(e) => set("tenTruong", e.target.value)} placeholder="VD: THPT Nguyễn Huệ" />
        </label>
        <label>
          Năm học
          <input value={config.namHoc} onChange={(e) => set("namHoc", e.target.value)} placeholder="VD: 2025-2026" />
        </label>
        <label>
          Số ngày trong tuần
          <select value={config.soNgay} onChange={(e) => set("soNgay", Number(e.target.value))}>
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <option key={n} value={n}>{n} ngày ({getDays(n).join(", ")})</option>
            ))}
          </select>
        </label>
        <label>
          Số buổi trên ngày
          <select value={config.soBuoi} onChange={(e) => set("soBuoi", Number(e.target.value))}>
            <option value={1}>1 buổi</option>
            <option value={2}>2 buổi (Sáng, Chiều)</option>
          </select>
        </label>
        <label>
          Số tiết trong buổi (tối đa 5)
          <select value={config.soTiet} onChange={(e) => set("soTiet", Number(e.target.value))}>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>{n} tiết</option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

/* ---------- Step 4: Teachers ---------- */

function TeachersStep({ teachers, departments, onAdd, onRemove }) {
  const [fullName, setFullName] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const preview = fullName.trim() ? abbreviateName(fullName.trim()) : "";

  function submit(e) {
    e.preventDefault();
    const v = fullName.trim();
    if (!v) return;
    onAdd(v, departmentId);
    setFullName("");
  }

  return (
    <div className="step-panel">
      <h2>Danh sách giáo viên</h2>
      <p className="hint">Tên rút gọn được tự sinh: các chữ đệm/tên lót viết tắt, giữ nguyên tên cuối. VD: Nguyễn Văn An → N.V.An</p>
      <form className="inline-form wrap" onSubmit={submit}>
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Họ và tên (VD: Nguyễn Văn An)"
        />
        <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
          <option value="">-- Tổ chuyên môn --</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        <button type="submit">Thêm</button>
      </form>
      {preview && <p className="preview">Tên rút gọn: <strong>{preview}</strong></p>}

      <table className="data-table">
        <thead>
          <tr>
            <th>Họ và tên</th>
            <th>Tên rút gọn</th>
            <th>Tổ chuyên môn</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {teachers.length === 0 && (
            <tr><td colSpan={4} className="empty">Chưa có giáo viên nào.</td></tr>
          )}
          {teachers.map((t) => {
            const dept = departments.find((d) => d.id === t.departmentId);
            return (
              <tr key={t.id}>
                <td>{t.fullName}</td>
                <td>{abbreviateName(t.fullName)}</td>
                <td>{dept ? dept.name : <span className="muted">Chưa phân tổ</span>}</td>
                <td className="actions">
                  <button className="link-danger" onClick={() => onRemove(t.id)}>Xoá</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Step 6: Classes ---------- */

function ClassesStep({ classes, grades, onAdd, onRemove, onOpenTimetable }) {
  const [name, setName] = useState("");
  const [gradeId, setGradeId] = useState("");

  function submit(e) {
    e.preventDefault();
    const v = name.trim();
    if (!v) return;
    onAdd(v, gradeId);
    setName("");
  }

  return (
    <div className="step-panel">
      <h2>Danh sách lớp học</h2>
      <p className="hint">Bấm "Khung chương trình" để xếp thời khóa biểu cho lớp đó.</p>
      <form className="inline-form wrap" onSubmit={submit}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên lớp (VD: 10A1)" />
        <select value={gradeId} onChange={(e) => setGradeId(e.target.value)}>
          <option value="">-- Khối --</option>
          {grades.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
        <button type="submit">Thêm lớp</button>
      </form>

      <table className="data-table">
        <thead>
          <tr>
            <th>Tên lớp</th>
            <th>Khối</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {classes.length === 0 && (
            <tr><td colSpan={3} className="empty">Chưa có lớp nào.</td></tr>
          )}
          {classes.map((c) => {
            const grade = grades.find((g) => g.id === c.gradeId);
            return (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{grade ? grade.name : <span className="muted">Chưa phân khối</span>}</td>
                <td className="actions">
                  <button className="btn-small" onClick={() => onOpenTimetable(c.id)}>Khung chương trình</button>
                  <button className="link-danger" onClick={() => onRemove(c.id)}>Xoá</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Timetable screen ---------- */

function TimetableStep({
  config, subjects, teachers, classes,
  schedule, setSchedule, unscheduled, setUnscheduled,
  focusClassId, onClearFocus, onGoToClasses, onGoToSubjects,
}) {
  const days = useMemo(() => getDays(config.soNgay), [config.soNgay]);
  const sessions = useMemo(() => getSessions(config.soBuoi), [config.soBuoi]);
  const tiets = useMemo(() => getTiets(config.soTiet), [config.soTiet]);
  const rowsPerDay = sessions.length * tiets.length;

  const [subjectId, setSubjectId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [count, setCount] = useState(1);
  const [selectedId, setSelectedId] = useState(null);
  const [flash, setFlash] = useState("");
  const [flashType, setFlashType] = useState("ok");
  const [highlightClassId, setHighlightClassId] = useState(null);
  const thRefs = useRef({});

  useEffect(() => {
    if (subjects.length && !subjectId) setSubjectId(subjects[0].id);
  }, [subjects, subjectId]);

  useEffect(() => {
    if (focusClassId && thRefs.current[focusClassId]) {
      thRefs.current[focusClassId].scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      setHighlightClassId(focusClassId);
      const t = setTimeout(() => {
        setHighlightClassId(null);
        onClearFocus();
      }, 1600);
      return () => clearTimeout(t);
    }
  }, [focusClassId]); // eslint-disable-line

  const selectedItem = useMemo(
    () => unscheduled.find((i) => i.id === selectedId) || null,
    [unscheduled, selectedId]
  );

  function showFlash(msg, type = "ok") {
    setFlash(msg);
    setFlashType(type);
    window.clearTimeout(showFlash._t);
    showFlash._t = window.setTimeout(() => setFlash(""), 2400);
  }

  function findTeacherConflict(day, session, tiet, tId, excludeKey) {
    if (!tId) return null;
    for (const [key, item] of Object.entries(schedule)) {
      if (key === excludeKey) continue;
      const pos = parseKey(key);
      if (pos.day === day && pos.session === session && pos.tiet === String(tiet) && item.teacherId === tId) {
        const klass = classes.find((c) => c.id === pos.classId);
        return { key, item, klass: klass ? klass.name : "?", ...pos };
      }
    }
    return null;
  }

  function handleAddToQueue(e) {
    e.preventDefault();
    const subject = subjects.find((s) => s.id === subjectId);
    if (!subject) return;
    const teacher = teachers.find((t) => t.id === teacherId) || null;
    const n = Math.min(Math.max(Number(count) || 1, 1), 20);
    const newItems = Array.from({ length: n }, () => ({
      id: nextId("u"),
      subjectId: subject.id,
      subjectName: subject.name,
      teacherId: teacher ? teacher.id : "",
      teacherName: teacher ? abbreviateName(teacher.fullName) : "",
    }));
    setUnscheduled((prev) => [...prev, ...newItems]);
    setCount(1);
  }

  function handleDeleteUnscheduled(id) {
    setUnscheduled((prev) => prev.filter((i) => i.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  function handleSelectItem(id) {
    setSelectedId((prev) => (prev === id ? null : id));
  }

  function handleCellClick(day, session, tiet, classId, klassName) {
    const key = cellKey(day, session, tiet, classId);
    const occupant = schedule[key];

    if (selectedItem) {
      const conflict = findTeacherConflict(day, session, tiet, selectedItem.teacherId, key);
      if (conflict) {
        showFlash(
          `Không thể xếp: ${selectedItem.teacherName} đã dạy lớp ${conflict.klass} vào đúng tiết ${tiet} (${session}, ${day}).`,
          "error"
        );
        return;
      }
      setSchedule((prev) => ({ ...prev, [key]: selectedItem }));
      setUnscheduled((prev) => {
        const without = prev.filter((i) => i.id !== selectedItem.id);
        return occupant ? [...without, occupant] : without;
      });
      setSelectedId(null);
      showFlash(`Đã xếp "${selectedItem.subjectName}" vào ${klassName} - ${day}, tiết ${tiet} (${session})`);
      return;
    }

    if (occupant) {
      setSchedule((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      setUnscheduled((prev) => [...prev, occupant]);
      showFlash(`Đã gỡ "${occupant.subjectName}" khỏi ${klassName} - ${day}, tiết ${tiet}`);
    }
  }

  function handleClearSchedule() {
    const placed = Object.values(schedule);
    if (placed.length === 0) return;
    setSchedule({});
    setUnscheduled((prev) => [...prev, ...placed]);
    setSelectedId(null);
    showFlash("Đã gỡ toàn bộ tiết đã xếp");
  }

  if (classes.length === 0) {
    return (
      <div className="step-panel">
        <h2>Thời khóa biểu</h2>
        <p className="hint">Chưa có lớp nào để xếp lịch.</p>
        <button className="btn-primary" onClick={onGoToClasses}>Đến Bước 6: Lớp học</button>
      </div>
    );
  }

  if (subjects.length === 0) {
    return (
      <div className="step-panel">
        <h2>Thời khóa biểu</h2>
        <p className="hint">Chưa có môn học nào để tạo tiết dạy.</p>
        <button className="btn-primary" onClick={onGoToSubjects}>Đến Bước 2: Môn học</button>
      </div>
    );
  }

  const placedCount = Object.keys(schedule).length;

  return (
    <div className="timetable-wrap">
      <header className="tt-header">
        <div>
          <h2 className="tt-title">{config.tenTKB || "Thời khóa biểu"}</h2>
          <p className="tt-sub">
            {[config.tenTruong, config.namHoc].filter(Boolean).join(" · ")}
            {" — "}{placedCount} tiết đã xếp, {unscheduled.length} tiết chưa xếp.
          </p>
        </div>
        <div className="tt-actions">
          <span className={"tt-flash " + flashType}>{flash}</span>
          <button className="tkb-btn" onClick={handleClearSchedule}>Gỡ hết tiết</button>
        </div>
      </header>

      <div className="tt-layout">
        <div className="tt-table-wrap">
          <table className="tt-grid">
            <thead>
              <tr>
                <th colSpan={3}>Thứ / Tiết</th>
                {classes.map((c) => (
                  <th
                    key={c.id}
                    ref={(el) => { thRefs.current[c.id] = el; }}
                    className={highlightClassId === c.id ? "th-highlight" : ""}
                  >
                    {c.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {days.map((day) => {
                let dayRendered = false;
                return sessions.map((session) =>
                  tiets.map((tiet, idx) => {
                    const isFirstOfDay = !dayRendered;
                    if (isFirstOfDay) dayRendered = true;
                    return (
                      <tr key={`${day}-${session}-${tiet}`}>
                        {isFirstOfDay && (
                          <td className="tt-day" rowSpan={rowsPerDay}>{day}</td>
                        )}
                        {idx === 0 && (
                          <td className="tt-session" rowSpan={tiets.length}>{session}</td>
                        )}
                        <td className="tt-tiet">{tiet}</td>
                        {classes.map((c) => {
                          const key = cellKey(day, session, tiet, c.id);
                          const item = schedule[key];
                          const conflict =
                            selectedItem &&
                            !item &&
                            findTeacherConflict(day, session, tiet, selectedItem.teacherId, key);
                          let cls = "tt-cell";
                          if (conflict) cls += " conflict";
                          else if (selectedItem) cls += " can-drop";
                          return (
                            <td
                              key={key}
                              className={cls}
                              onClick={() => handleCellClick(day, session, tiet, c.id, c.name)}
                              title={
                                conflict
                                  ? `${selectedItem.teacherName} đã dạy lớp ${conflict.klass} vào tiết này`
                                  : selectedItem
                                  ? `Xếp "${selectedItem.subjectName}" vào đây`
                                  : item
                                  ? "Bấm để gỡ tiết này"
                                  : "Chọn một tiết ở bên phải trước"
                              }
                            >
                              {item && (
                                <div className="tt-chip">
                                  <strong>{item.subjectName}</strong>
                                  {item.teacherName && <small>{item.teacherName}</small>}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                );
              })}
            </tbody>
          </table>
        </div>

        <aside className="tt-side">
          <h2>Thêm tiết dạy</h2>
          <form className="tt-form" onSubmit={handleAddToQueue}>
            <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
              <option value="">-- Không phân công GV --</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>{abbreviateName(t.fullName)} — {t.fullName}</option>
              ))}
            </select>
            <div className="tt-count-row">
              <label>Số tiết/tuần</label>
              <input
                type="number"
                min={1}
                max={20}
                value={count}
                onChange={(e) => setCount(e.target.value)}
              />
            </div>
            <button type="submit">Thêm vào danh sách</button>
          </form>
          <p className="hint">
            Nếu một giáo viên dạy nhiều lớp, hãy thêm nhiều thẻ cùng môn/GV — một thẻ để xếp cho mỗi lớp. Hệ thống sẽ tự chặn nếu bạn xếp trùng tiết cho cùng một giáo viên.
          </p>

          <h2>Tiết chưa xếp ({unscheduled.length})</h2>
          <div className="tt-list">
            {unscheduled.length === 0 && <div className="empty">Không còn tiết nào chưa xếp.</div>}
            {unscheduled.map((item) => (
              <div
                key={item.id}
                className={"tt-pill" + (selectedId === item.id ? " selected" : "")}
                onClick={() => handleSelectItem(item.id)}
              >
                <div className="tt-pill-text">
                  <strong>{item.subjectName}</strong>
                  {item.teacherName && <small>{item.teacherName}</small>}
                </div>
                <button
                  className="tt-pill-del"
                  onClick={(e) => { e.stopPropagation(); handleDeleteUnscheduled(item.id); }}
                  aria-label="Xoá tiết này"
                >×</button>
              </div>
            ))}
          </div>

          {selectedItem && selectedItem.teacherId && (
            <div className="tt-legend">
              <span className="swatch" /> Ô kẻ gạch đỏ = {selectedItem.teacherName} đã bận tiết đó ở lớp khác.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

/* ---------- App ---------- */

export default function App() {
  const [activeTab, setActiveTab] = useState("config");
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [subjects, setSubjects] = useState(SEED_SUBJECTS);
  const [departments, setDepartments] = useState(SEED_DEPARTMENTS);
  const [teachers, setTeachers] = useState(SEED_TEACHERS);
  const [grades, setGrades] = useState(SEED_GRADES);
  const [classes, setClasses] = useState(SEED_CLASSES);
  const [schedule, setSchedule] = useState({});
  const [unscheduled, setUnscheduled] = useState([]);
  const [focusClassId, setFocusClassId] = useState(null);

  function handleAddClass(name, gradeId) {
    setClasses((prev) => [...prev, { id: nextId("c"), name, gradeId }]);
  }
  function handleRemoveClass(classId) {
    const orphaned = [];
    setSchedule((prev) => {
      const next = {};
      Object.entries(prev).forEach(([key, item]) => {
        const pos = parseKey(key);
        if (pos.classId === classId) orphaned.push(item);
        else next[key] = item;
      });
      return next;
    });
    setClasses((prev) => prev.filter((c) => c.id !== classId));
    if (orphaned.length) setUnscheduled((prev) => [...prev, ...orphaned]);
  }
  function handleOpenTimetable(classId) {
    setFocusClassId(classId);
    setActiveTab("timetable");
  }

  return (
    <div className="app-root">
      <style>{`
        .app-root {
          --paper: #F6F3EC;
          --ink: #26304A;
          --ink-soft: #5B6478;
          --line: #DCD5C4;
          --rust: #B24C2A;
          --rust-deep: #8E3B20;
          --sage: #3F6B4C;
          --sage-soft: #E7EFE7;
          --danger: #A6303B;
          --danger-soft: #F6E4E3;
          --card: #FFFFFF;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          background: var(--paper);
          color: var(--ink);
          min-height: 100%;
          box-sizing: border-box;
        }
        .app-root * { box-sizing: border-box; }
        .app-header {
          padding: 20px 28px 0;
        }
        .app-title {
          font-family: Georgia, "Iowan Old Style", "Times New Roman", serif;
          font-size: 28px;
          margin: 0 0 4px;
        }
        .app-title span { color: var(--rust); }
        .app-tabs {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          padding: 16px 28px 0;
          border-bottom: 2px solid var(--ink);
        }
        .app-tab {
          border: 1px solid var(--line);
          border-bottom: none;
          background: #EFEAE0;
          color: var(--ink-soft);
          padding: 9px 14px;
          font-size: 13px;
          border-radius: 4px 4px 0 0;
          cursor: pointer;
        }
        .app-tab.active {
          background: var(--card);
          color: var(--ink);
          font-weight: 700;
          border-color: var(--ink);
          border-bottom: 2px solid var(--card);
          margin-bottom: -2px;
        }
        .app-main { padding: 24px 28px 40px; }

        .step-panel {
          background: var(--card);
          border: 1px solid var(--line);
          border-radius: 4px;
          padding: 20px;
          max-width: 760px;
        }
        .step-panel h2 { margin: 0 0 6px; font-size: 18px; }
        .hint { font-size: 13px; color: var(--ink-soft); margin: 0 0 16px; line-height: 1.5; }
        .preview { font-size: 13px; color: var(--sage); margin: -8px 0 14px; }

        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 20px; }
        .form-grid label { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: var(--ink-soft); font-weight: 600; }
        @media (max-width: 640px) { .form-grid { grid-template-columns: 1fr; } }

        input, select {
          border: 1px solid var(--line);
          border-radius: 3px;
          padding: 8px 10px;
          font-size: 13px;
          background: var(--paper);
          color: var(--ink);
          font-family: inherit;
        }
        input:focus, select:focus { outline: 2px solid var(--rust); outline-offset: 1px; }

        .inline-form { display: flex; gap: 8px; margin-bottom: 16px; }
        .inline-form.wrap { flex-wrap: wrap; }
        .inline-form input, .inline-form select { flex: 1; min-width: 160px; }
        .inline-form button, .btn-primary {
          border: none;
          background: var(--rust);
          color: #fff;
          padding: 9px 14px;
          font-size: 13px;
          border-radius: 3px;
          cursor: pointer;
          white-space: nowrap;
        }
        .inline-form button:hover, .btn-primary:hover { background: var(--rust-deep); }

        .chip-list { display: flex; flex-wrap: wrap; gap: 8px; }
        .chip {
          display: flex; align-items: center; gap: 6px;
          border: 1px solid var(--line); border-radius: 999px;
          padding: 6px 8px 6px 12px; font-size: 13px; background: var(--paper);
        }
        .chip button { border: none; background: none; color: var(--ink-soft); cursor: pointer; font-size: 14px; }
        .chip button:hover { color: var(--rust); }
        .empty { font-size: 13px; color: var(--ink-soft); padding: 6px 0; }

        .data-table { width: 100%; border-collapse: collapse; margin-top: 6px; }
        .data-table th, .data-table td {
          border: 1px solid var(--line); padding: 8px 10px; font-size: 13px; text-align: left;
        }
        .data-table th { background: var(--ink); color: var(--paper); font-weight: 600; }
        .data-table .actions { display: flex; gap: 10px; white-space: nowrap; }
        .muted { color: var(--ink-soft); font-style: italic; }
        .link-danger { border: none; background: none; color: var(--danger); cursor: pointer; font-size: 13px; padding: 0; }
        .link-danger:hover { text-decoration: underline; }
        .btn-small {
          border: 1px solid var(--ink); background: transparent; color: var(--ink);
          padding: 5px 10px; font-size: 12px; border-radius: 3px; cursor: pointer;
        }
        .btn-small:hover { background: var(--ink); color: var(--paper); }

        /* timetable screen */
        .timetable-wrap { max-width: 1200px; }
        .tt-header {
          display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap;
          gap: 12px; margin-bottom: 20px; padding-bottom: 14px; border-bottom: 2px solid var(--ink);
        }
        .tt-title { font-family: Georgia, serif; font-size: 24px; margin: 0; }
        .tt-sub { margin: 4px 0 0; font-size: 13px; color: var(--ink-soft); }
        .tt-actions { display: flex; gap: 10px; align-items: center; }
        .tkb-btn {
          border: 1px solid var(--ink); background: transparent; color: var(--ink);
          padding: 8px 14px; font-size: 13px; border-radius: 3px; cursor: pointer;
        }
        .tkb-btn:hover { background: var(--ink); color: var(--paper); }
        .tt-flash { font-size: 13px; min-height: 18px; max-width: 420px; }
        .tt-flash.ok { color: var(--sage); }
        .tt-flash.error { color: var(--danger); font-weight: 600; }

        .tt-layout { display: grid; grid-template-columns: 1fr 320px; gap: 24px; align-items: start; }
        @media (max-width: 900px) { .tt-layout { grid-template-columns: 1fr; } }

        .tt-table-wrap { background: var(--card); border: 1px solid var(--line); border-radius: 4px; overflow: auto; max-height: 74vh; }
        table.tt-grid { border-collapse: collapse; width: 100%; min-width: 560px; }
        table.tt-grid th, table.tt-grid td { border: 1px solid var(--line); padding: 0; text-align: center; }
        table.tt-grid thead th {
          background: var(--ink); color: var(--paper); font-weight: 600; font-size: 13px;
          padding: 10px 6px; position: sticky; top: 0; z-index: 2; transition: background 0.3s ease;
        }
        table.tt-grid thead th.th-highlight { background: var(--rust); }
        td.tt-day {
          background: #E9E2D0; font-size: 13px; font-weight: 700; color: var(--ink); width: 26px;
          writing-mode: vertical-rl; text-orientation: mixed; transform: rotate(180deg);
          position: sticky; left: 0; z-index: 1;
        }
        td.tt-session {
          background: #EFE9DC; font-size: 11px; font-weight: 600; color: var(--ink-soft); width: 24px;
          writing-mode: vertical-rl; text-orientation: mixed; transform: rotate(180deg);
          position: sticky; left: 26px; z-index: 1;
        }
        td.tt-tiet {
          background: #FAF8F3; font-size: 12px; color: var(--ink-soft); width: 30px;
          position: sticky; left: 50px; z-index: 1;
        }
        td.tt-cell { height: 50px; width: 118px; cursor: pointer; position: relative; vertical-align: middle; }
        td.tt-cell:hover { background: #FBF6EA; }
        td.tt-cell.can-drop { box-shadow: inset 0 0 0 2px var(--sage); }
        td.tt-cell.conflict {
          box-shadow: inset 0 0 0 2px var(--danger); cursor: not-allowed;
          background: repeating-linear-gradient(135deg, var(--danger-soft), var(--danger-soft) 6px, #f0d3d1 6px, #f0d3d1 12px);
        }
        .tt-chip {
          display: flex; flex-direction: column; gap: 1px; padding: 5px 7px; margin: 3px;
          border-radius: 3px; background: var(--sage-soft); border-left: 3px solid var(--sage); text-align: left;
        }
        .tt-chip strong { font-size: 12px; line-height: 1.2; }
        .tt-chip small { font-size: 10px; color: var(--ink-soft); }

        .tt-side { background: var(--card); border: 1px solid var(--line); border-radius: 4px; padding: 16px; }
        .tt-side h2 { font-size: 14px; margin: 0 0 10px; font-weight: 700; }
        .tt-form { display: flex; flex-direction: column; gap: 8px; margin-bottom: 10px; }
        .tt-form select, .tt-form input { width: 100%; }
        .tt-count-row { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--ink-soft); }
        .tt-count-row input { width: 70px; }
        .tt-form button {
          border: none; background: var(--rust); color: #fff; padding: 9px 12px; font-size: 13px;
          border-radius: 3px; cursor: pointer;
        }
        .tt-form button:hover { background: var(--rust-deep); }

        .tt-list { display: flex; flex-direction: column; gap: 8px; max-height: 320px; overflow: auto; margin-top: 8px; }
        .tt-pill {
          display: flex; align-items: center; justify-content: space-between; gap: 8px;
          border: 1px solid var(--line); border-left: 3px solid var(--ink-soft); border-radius: 3px;
          padding: 8px 10px; background: var(--paper); cursor: pointer; text-align: left;
        }
        .tt-pill.selected { border-color: var(--rust); border-left-color: var(--rust); background: #FBEDE6; }
        .tt-pill-text strong { display: block; font-size: 13px; }
        .tt-pill-text small { color: var(--ink-soft); font-size: 11px; }
        .tt-pill-del { border: none; background: none; color: var(--ink-soft); font-size: 15px; cursor: pointer; }
        .tt-pill-del:hover { color: var(--rust); }
        .tt-legend { display: flex; align-items: center; gap: 6px; font-size: 11.5px; color: var(--ink-soft); margin-top: 12px; }
        .tt-legend .swatch { width: 12px; height: 12px; border-radius: 2px; box-shadow: inset 0 0 0 2px var(--danger); background: var(--danger-soft); }
      `}</style>

      <div className="app-header">
        <h1 className="app-title">Trình tạo <span>Thời khóa biểu</span></h1>
      </div>

      <nav className="app-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={"app-tab" + (activeTab === t.key ? " active" : "")}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="app-main">
        {activeTab === "config" && <ConfigStep config={config} setConfig={setConfig} />}

        {activeTab === "subjects" && (
          <NameListEditor
            title="Danh sách môn học"
            hint="Danh sách này sẽ dùng để tạo các tiết dạy khi xếp thời khóa biểu."
            items={subjects}
            onAdd={(name) => setSubjects((prev) => [...prev, { id: nextId("su"), name }])}
            onRemove={(id) => setSubjects((prev) => prev.filter((s) => s.id !== id))}
            placeholder="Tên môn học (VD: Toán)"
            emptyText="Chưa có môn học nào."
          />
        )}

        {activeTab === "departments" && (
          <NameListEditor
            title="Tổ chuyên môn"
            hint="Mỗi giáo viên ở Bước 4 sẽ thuộc một tổ chuyên môn."
            items={departments}
            onAdd={(name) => setDepartments((prev) => [...prev, { id: nextId("d"), name }])}
            onRemove={(id) => setDepartments((prev) => prev.filter((d) => d.id !== id))}
            placeholder="Tên tổ (VD: Tổ Toán - Tin)"
            emptyText="Chưa có tổ chuyên môn nào."
          />
        )}

        {activeTab === "teachers" && (
          <TeachersStep
            teachers={teachers}
            departments={departments}
            onAdd={(fullName, departmentId) =>
              setTeachers((prev) => [...prev, { id: nextId("t"), fullName, departmentId }])
            }
            onRemove={(id) => setTeachers((prev) => prev.filter((t) => t.id !== id))}
          />
        )}

        {activeTab === "grades" && (
          <NameListEditor
            title="Danh sách khối"
            hint="Mỗi lớp học ở Bước 6 sẽ thuộc một khối."
            items={grades}
            onAdd={(name) => setGrades((prev) => [...prev, { id: nextId("g"), name }])}
            onRemove={(id) => setGrades((prev) => prev.filter((g) => g.id !== id))}
            placeholder="Tên khối (VD: Khối 10)"
            emptyText="Chưa có khối nào."
          />
        )}

        {activeTab === "classes" && (
          <ClassesStep
            classes={classes}
            grades={grades}
            onAdd={handleAddClass}
            onRemove={handleRemoveClass}
            onOpenTimetable={handleOpenTimetable}
          />
        )}

        {activeTab === "timetable" && (
          <TimetableStep
            config={config}
            subjects={subjects}
            teachers={teachers}
            classes={classes}
            schedule={schedule}
            setSchedule={setSchedule}
            unscheduled={unscheduled}
            setUnscheduled={setUnscheduled}
            focusClassId={focusClassId}
            onClearFocus={() => setFocusClassId(null)}
            onGoToClasses={() => setActiveTab("classes")}
            onGoToSubjects={() => setActiveTab("subjects")}
          />
        )}
      </main>
    </div>
  );
}
