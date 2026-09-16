import { useState, useRef, useEffect, useMemo } from "react";

/* ================= helpers ================= */

let uidCounter = 100;
function nextId(prefix) {
  uidCounter += 1;
  return prefix + uidCounter;
}

function abbreviateName(fullName) {
  const parts = String(fullName || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  const last = parts[parts.length - 1];
  const initials = parts
    .slice(0, -1)
    .map((p) => p.charAt(0).toLocaleUpperCase("vi-VN"))
    .join(".");
  return initials + "." + last;
}

const ALL_DAY_LABELS = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ Nhật"];
function getDays(soNgay) {
  const n = Math.min(Math.max(Number(soNgay) || 1, 1), 7);
  return ALL_DAY_LABELS.slice(0, n);
}
function getSessions(soBuoi) {
  return Number(soBuoi) === 2 ? ["Sáng", "Chiều"] : ["Cả ngày"];
}
function getTiets(soTiet) {
  const n = Math.min(Math.max(Number(soTiet) || 1, 1), 10);
  return Array.from({ length: n }, (_, i) => i + 1);
}

/* slot = một ô thời gian trong tuần, chưa gắn với lớp */
function slotKey(day, session, tiet) {
  return `${day}|${session}|${tiet}`;
}
/* cell = slot + lớp */
function cellKey(day, session, tiet, classId) {
  return `${day}|${session}|${tiet}|${classId}`;
}
function parseCell(key) {
  const [day, session, tiet, classId] = key.split("|");
  return { day, session, tiet, classId, slot: slotKey(day, session, tiet) };
}
function parseSlot(key) {
  const [day, session, tiet] = key.split("|");
  return { day, session, tiet };
}
function slotLabel(key) {
  const { day, session, tiet } = parseSlot(key);
  return `${day} - ${session} - tiết ${tiet}`;
}

function allSlots(config) {
  const out = [];
  getDays(config.soNgay).forEach((d) =>
    getSessions(config.soBuoi).forEach((s) =>
      getTiets(config.soTiet).forEach((t) => out.push(slotKey(d, s, t)))
    )
  );
  return out;
}

/* ================= dữ liệu mẫu ================= */

const SEED_SUBJECTS = [
  { name: "Chào cờ", tietLienTiep: 1 },
  { name: "SHL", tietLienTiep: 1 },
  { name: "Toán", tietLienTiep: 2 },
  { name: "Vật lí", tietLienTiep: 2 },
  { name: "Hóa học", tietLienTiep: 2 },
  { name: "Sinh học", tietLienTiep: 1 },
  { name: "Ngữ văn", tietLienTiep: 2 },
  { name: "Lịch sử", tietLienTiep: 2 },
  { name: "Địa lí", tietLienTiep: 2 },
  { name: "Tiếng Anh", tietLienTiep: 2 },
  { name: "GDKTPL", tietLienTiep: 1 },
  { name: "HĐTN & HN", tietLienTiep: 1 },
].map((s) => ({
  id: nextId("su"),
  name: s.name,
  short: "",
  gioiHan: "",
  tietLienTiep: s.tietLienTiep,
  buoiToiDa: "",
  tietTranh: 0,
}));

const SEED_DEPARTMENTS = ["KHTN", "KHXH"].map((name) => ({ id: nextId("d"), name }));

const SEED_TEACHERS = [
  { fullName: "Đặng Thị Chuyên", dept: 0 },
  { fullName: "La Mỹ Duyên", dept: 0 },
  { fullName: "Hoàng Thị Hà", dept: 1 },
  { fullName: "Ngô Thị Hiền", dept: 1 },
  { fullName: "Nông Thị Hồng", dept: 0 },
  { fullName: "Nguyễn Quang Hùng", dept: 0 },
  { fullName: "Chu Thị Hường", dept: 1 },
  { fullName: "Lăng Thị Yến", dept: 1 },
  { fullName: "Bàn Thị Mận", dept: 1 },
].map((t) => ({
  id: nextId("t"),
  fullName: t.fullName,
  short: abbreviateName(t.fullName),
  departmentIds: [SEED_DEPARTMENTS[t.dept].id],
}));

const SEED_GRADES = ["KHỐI 10", "KHỐI 11", "KHỐI 12"].map((name) => ({
  id: nextId("g"),
  name,
  laDiemTruong: false,
}));

const SEED_CLASSES = ["10A1", "10A2", "10A3", "10A4", "10A5", "10A6"].map((name) => ({
  id: nextId("c"),
  name,
  gradeId: SEED_GRADES[0].id,
  campusId: "",
  offSlots: [],
}));

const DEFAULT_CONFIG = {
  tenTKB: "TUẦN 01 NH 2025-2026",
  tenTruong: "",
  namHoc: "2025-2026",
  soNgay: 6,
  soBuoi: 2,
  soTiet: 5,
  phuongSai: 1,
  thuatToan: "Thuật toán 4 (tối ưu)",
};

const DEFAULT_CONSTRAINTS = {
  khongTietTrong: true,
  gvToiDaTrenNgay: 5,
  uuTienMonChinhBuoiSang: false,
  chaoCoTiet1Thu2: true,
};

const STATUS_STAGES = ["Khởi tạo", "Chỉnh sửa", "Khóa dữ liệu", "Thủ công", "Đang chạy", "Đã có kết quả"];

const NAV_GROUPS = [
  {
    title: "Cài đặt",
    items: [
      { key: "config", label: "Bước 1: Cấu hình chung" },
      { key: "subjects", label: "Bước 2: Danh sách môn học" },
    ],
  },
  {
    title: "Tổ chuyên môn / Giáo viên",
    items: [
      { key: "departments", label: "Bước 3: Danh sách tổ chuyên môn" },
      { key: "teachers", label: "Bước 4: Danh sách giáo viên" },
    ],
  },
  {
    title: "Khối / lớp",
    items: [
      { key: "grades", label: "Bước 5: Danh sách khối (nhóm lớp)" },
      { key: "campuses", label: "Bước 5.1: Danh sách điểm trường", small: true },
      { key: "classes", label: "Bước 6: Danh sách lớp học" },
      { key: "assignments", label: "Bước 7: Thiết lập phân công giảng dạy" },
    ],
  },
  {
    title: "Nâng cao",
    items: [{ key: "constraints", label: "Bước 8: Cài đặt ràng buộc" }],
  },
];

function newAssignment(extra) {
  return {
    id: nextId("a"),
    classId: "",
    gradeId: "",
    subjectId: "",
    teacherId: "",
    soTiet: 1,
    tietLienTiep: 1,
    fixed: [],
    avoid: [],
    ...extra,
  };
}

/* ================= thanh trạng thái ================= */

function StatusBar({ stage, onChangeStage, shareUrl }) {
  return (
    <div className="statusbar">
      <div className="share-row">
        <span className="share-label">Link chia sẻ:</span>
        <span className="share-url">{shareUrl}</span>
        <button
          className="btn btn-danger btn-sm"
          onClick={() => { if (navigator.clipboard) navigator.clipboard.writeText(shareUrl); }}
        >
          Copy Url
        </button>
      </div>
      <div className="stage-row">
        <span className="stage-label">Trạng thái Thời khóa biểu:</span>
        <div className="stage-track">
          {STATUS_STAGES.map((s) => (
            <button key={s} className={"stage" + (stage === s ? " active" : "")} onClick={() => onChangeStage(s)}>
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ================= sidebar ================= */

function Sidebar({ activeStep, onSelect, checkResult, onCheck, onViewResult }) {
  return (
    <aside className="sidebar">
      {NAV_GROUPS.map((group) => (
        <div className="nav-group" key={group.title}>
          <h3>{group.title}</h3>
          <div className="nav-card">
            {group.items.map((item) => (
              <button
                key={item.key}
                className={"nav-item" + (activeStep === item.key ? " active" : "") + (item.small ? " small" : "")}
                onClick={() => onSelect(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className="nav-card check-card">
        <button className="btn btn-check" onClick={onCheck}>Kiểm tra dữ liệu</button>
        {!checkResult && <p className="check-empty">Chưa kiểm tra lần nào</p>}
        {checkResult && checkResult.errors.length === 0 && (
          <p className="check-ok">Dữ liệu hợp lệ. Có thể xếp thời khóa biểu.</p>
        )}
        {checkResult && checkResult.errors.length > 0 && (
          <ul className="check-errors">
            {checkResult.errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        )}
      </div>

      <button className="btn btn-result" onClick={onViewResult}>Xem kết quả</button>
    </aside>
  );
}

/* ================= tiện ích dùng chung ================= */

function Field({ label, warn, children }) {
  return (
    <label className={"field" + (warn ? " warn" : "")}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function PanelTitle({ title, actions }) {
  return (
    <div className="panel-title">
      <h2>{title}</h2>
      <button className="btn btn-info btn-sm guide">Hướng dẫn</button>
      <div className="spacer" />
      {actions}
    </div>
  );
}

/* ================= Bước 1 ================= */

function ConfigStep({ config, setConfig, onSaved, onOpenConstraints, onResetData }) {
  const days = getDays(config.soNgay);
  const sessions = getSessions(config.soBuoi);
  const tiets = getTiets(config.soTiet);
  const set = (field, value) => setConfig((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="panel">
      <PanelTitle title="Cài đặt" />
      <div className="config-grid">
        <Field label="Tên thời khóa biểu">
          <input value={config.tenTKB} onChange={(e) => set("tenTKB", e.target.value)} />
        </Field>
        <Field label="Tên trường học">
          <input value={config.tenTruong} onChange={(e) => set("tenTruong", e.target.value)} placeholder="Nhập tên trường học" />
        </Field>
        <Field label="Năm học">
          <input value={config.namHoc} onChange={(e) => set("namHoc", e.target.value)} placeholder="Nhập năm học" />
        </Field>
        <Field label="Số ngày trong tuần (không nên sửa)" warn>
          <select value={config.soNgay} onChange={(e) => set("soNgay", Number(e.target.value))}>
            {[1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </Field>
        <Field label="Số buổi trong ngày (không nên sửa)" warn>
          <select value={config.soBuoi} onChange={(e) => set("soBuoi", Number(e.target.value))}>
            <option value={1}>1</option>
            <option value={2}>2</option>
          </select>
        </Field>
        <Field label="Số tiết trong buổi (không nên sửa)" warn>
          <select value={config.soTiet} onChange={(e) => set("soTiet", Number(e.target.value))}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </Field>
        <Field label="Phương sai">
          <div className="with-addon">
            <input type="number" min={0} value={config.phuongSai} onChange={(e) => set("phuongSai", e.target.value)} />
            <button className="addon-btn" title="Đặt lại phương sai" onClick={() => set("phuongSai", 1)}>⟳</button>
          </div>
        </Field>
        <Field label="Thuật toán">
          <select value={config.thuatToan} onChange={(e) => set("thuatToan", e.target.value)}>
            <option>Thuật toán 1 (nhanh)</option>
            <option>Thuật toán 2</option>
            <option>Thuật toán 3</option>
            <option>Thuật toán 4 (tối ưu)</option>
          </select>
        </Field>
        <div />
      </div>

      <div className="row-right">
        <button className="btn btn-primary" onClick={onSaved}>Lưu cài đặt</button>
      </div>

      <PanelTitle title="Chức năng nâng cao" />
      <div className="btn-row">
        <button className="btn btn-info" onClick={onOpenConstraints}>Cài đặt ràng buộc thời khóa biểu</button>
        <button className="btn btn-info" onClick={onOpenConstraints}>Cài đặt ràng buộc mới (thử nghiệm)</button>
      </div>
      <div className="btn-row">
        <button className="btn btn-danger" onClick={onResetData}>Xóa dữ liệu của thời khóa biểu</button>
      </div>

      <PanelTitle title="Giao diện" />
      <div className="preview-wrap">
        <table className="preview-grid">
          <thead>
            <tr>
              <th colSpan={2} />
              {days.map((d) => <th key={d}>{d}</th>)}
            </tr>
          </thead>
          <tbody>
            {sessions.map((session) =>
              tiets.map((tiet, i) => (
                <tr key={session + tiet}>
                  {i === 0 && <td className="prev-session" rowSpan={tiets.length}>{session}</td>}
                  <td className="prev-tiet">Tiết {tiet}</td>
                  {days.map((d) => <td key={d + tiet} />)}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ================= Bước 2 ================= */

function SubjectsStep({ subjects, setSubjects }) {
  const [draft, setDraft] = useState("");
  const update = (id, patch) => setSubjects((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  function add() {
    const v = draft.trim();
    if (!v) return;
    setSubjects((prev) => [...prev, { id: nextId("su"), name: v, short: "", gioiHan: "", tietLienTiep: 1, buoiToiDa: "", tietTranh: 0 }]);
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
            <button className="btn btn-primary btn-sm">Nhập danh sách môn</button>
          </div>
        }
      />
      <table className="grid-table">
        <thead>
          <tr>
            <th className="w-stt">STT</th>
            <th>Tên môn</th>
            <th>Rút gọn</th>
            <th>Giới hạn <small>Giới hạn cùng thời điểm</small></th>
            <th>Tiết liên tiếp <small>Số tiết liên tiếp tối đa</small></th>
            <th>Buổi tối đa <small>Số buổi tối đa trong một ngày</small></th>
            <th className="w-act">Tiết tránh</th>
            <th className="w-act" />
          </tr>
        </thead>
        <tbody>
          {subjects.map((s, i) => (
            <tr key={s.id}>
              <td className="stt">{i + 1}</td>
              <td><input value={s.name} onChange={(e) => update(s.id, { name: e.target.value })} /></td>
              <td><input value={s.short} placeholder="Tên môn rút gọn (nếu cần)" onChange={(e) => update(s.id, { short: e.target.value })} /></td>
              <td><input value={s.gioiHan} placeholder="Không giới hạn" onChange={(e) => update(s.id, { gioiHan: e.target.value })} /></td>
              <td><input type="number" min={1} value={s.tietLienTiep} onChange={(e) => update(s.id, { tietLienTiep: e.target.value })} /></td>
              <td><input value={s.buoiToiDa} placeholder="Không giới hạn" onChange={(e) => update(s.id, { buoiToiDa: e.target.value })} /></td>
              <td><button className="btn btn-primary btn-sm block">{s.tietTranh} tiết</button></td>
              <td><button className="btn btn-danger btn-sm" onClick={() => setSubjects((prev) => prev.filter((x) => x.id !== s.id))}>Xóa</button></td>
            </tr>
          ))}
          <tr className="add-row">
            <td className="stt">{subjects.length + 1}</td>
            <td>
              <input value={draft} placeholder="Mời nhập tên môn học" onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
            </td>
            <td colSpan={5} />
            <td><button className="btn btn-add" onClick={add}>+</button></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/* ================= Bước 3 ================= */

function DepartmentsStep({ departments, setDepartments, teachers, onOpenTeachers }) {
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
                <input value={d.name} onChange={(e) => setDepartments((prev) => prev.map((x) => (x.id === d.id ? { ...x, name: e.target.value } : x)))} />
              </td>
              <td className="actions">
                <button className="btn btn-primary btn-sm" onClick={onOpenTeachers}>
                  Chi tiết ({teachers.filter((t) => t.departmentIds.includes(d.id)).length})
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => setDepartments((prev) => prev.filter((x) => x.id !== d.id))}>Xóa</button>
              </td>
            </tr>
          ))}
          <tr className="add-row">
            <td className="stt">{departments.length + 1}</td>
            <td><input value={draft} placeholder="Mời nhập nhóm giáo viên (tổ bộ môn)" onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} /></td>
            <td><button className="btn btn-add" onClick={add}>+</button></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/* ================= Bước 4 ================= */

function TeachersStep({ teachers, setTeachers, departments, assignments }) {
  const [draft, setDraft] = useState("");
  const update = (id, patch) => setTeachers((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  function add() {
    const v = draft.trim();
    if (!v) return;
    setTeachers((prev) => [...prev, { id: nextId("t"), fullName: v, short: abbreviateName(v), departmentIds: [] }]);
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
            <button className="btn btn-primary btn-sm">Nhập danh sách giáo viên</button>
          </div>
        }
      />
      <p className="hint">Tên rút gọn tự sinh từ họ tên: viết tắt họ và chữ đệm, giữ nguyên tên cuối. Ví dụ Nguyễn Văn An → N.V.An. Bạn vẫn sửa lại được.</p>
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
            const soTiet = assignments.filter((a) => a.teacherId === t.id).reduce((s, a) => s + Number(a.soTiet || 0), 0);
            return (
              <tr key={t.id}>
                <td className="stt">{i + 1}</td>
                <td>
                  <input value={t.fullName} onChange={(e) => update(t.id, { fullName: e.target.value, short: abbreviateName(e.target.value) })} />
                </td>
                <td><input value={t.short} onChange={(e) => update(t.id, { short: e.target.value })} /></td>
                <td>
                  <div className="chip-cell">
                    {t.departmentIds.map((id) => {
                      const d = departments.find((x) => x.id === id);
                      if (!d) return null;
                      return (
                        <span className="tag" key={id}>
                          <button onClick={() => update(t.id, { departmentIds: t.departmentIds.filter((x) => x !== id) })} aria-label={`Bỏ ${d.name}`}>×</button>
                          {d.name}
                        </span>
                      );
                    })}
                    <select
                      value=""
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v && !t.departmentIds.includes(v)) update(t.id, { departmentIds: [...t.departmentIds, v] });
                      }}
                    >
                      <option value="">+ tổ</option>
                      {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                </td>
                <td className="actions">
                  <button className="btn btn-primary btn-sm">Chi tiết ({soTiet} tiết)</button>
                  <button className="btn btn-danger btn-sm" onClick={() => setTeachers((prev) => prev.filter((x) => x.id !== t.id))}>Xóa</button>
                </td>
              </tr>
            );
          })}
          <tr className="add-row">
            <td className="stt">{teachers.length + 1}</td>
            <td><input value={draft} placeholder="Mời nhập họ tên giáo viên" onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} /></td>
            <td className="muted">{draft.trim() ? abbreviateName(draft) : ""}</td>
            <td />
            <td><button className="btn btn-add" onClick={add}>+</button></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/* ================= Bước 5 ================= */

function GradesStep({ grades, setGrades, classes, gradeAssignments, onOpenFramework }) {
  const [draft, setDraft] = useState("");
  function add() {
    const v = draft.trim();
    if (!v) return;
    setGrades((prev) => [...prev, { id: nextId("g"), name: v, laDiemTruong: false }]);
    setDraft("");
  }
  return (
    <div className="panel">
      <PanelTitle title="Nhóm lớp (Khối)" />
      <p className="hint">Khung CT của khối là bản mẫu. Mỗi lớp có thể đồng bộ từ bản mẫu này rồi chỉnh riêng.</p>
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
                <input value={g.name} onChange={(e) => setGrades((prev) => prev.map((x) => (x.id === g.id ? { ...x, name: e.target.value } : x)))} />
              </td>
              <td className="center">
                <button
                  className={"toggle" + (g.laDiemTruong ? " on" : "")}
                  onClick={() => setGrades((prev) => prev.map((x) => (x.id === g.id ? { ...x, laDiemTruong: !x.laDiemTruong } : x)))}
                  aria-pressed={g.laDiemTruong}
                ><span /></button>
              </td>
              <td className="center">
                <button className="btn btn-primary btn-sm" onClick={() => onOpenFramework({ type: "grade", id: g.id })}>
                  Khung CT
                </button>
              </td>
              <td className="center">
                <button
                  className="btn btn-danger btn-sm"
                  disabled={classes.some((c) => c.gradeId === g.id)}
                  title={classes.some((c) => c.gradeId === g.id) ? "Còn lớp thuộc khối này" : ""}
                  onClick={() => setGrades((prev) => prev.filter((x) => x.id !== g.id))}
                >Xóa</button>
              </td>
            </tr>
          ))}
          <tr className="add-row">
            <td className="stt">{grades.length + 1}</td>
            <td><input value={draft} placeholder="Mời nhập tên Nhóm lớp (Khối)" onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} /></td>
            <td colSpan={3} className="center"><button className="btn btn-add" onClick={add}>+</button></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/* ================= Bước 5.1 ================= */

function CampusesStep({ campuses, setCampuses, classes }) {
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
          {campuses.length === 0 && <tr><td colSpan={4} className="empty">Chưa khai báo điểm trường nào.</td></tr>}
          {campuses.map((p, i) => (
            <tr key={p.id}>
              <td className="stt">{i + 1}</td>
              <td><input value={p.name} onChange={(e) => setCampuses((prev) => prev.map((x) => (x.id === p.id ? { ...x, name: e.target.value } : x)))} /></td>
              <td className="center">{classes.filter((c) => c.campusId === p.id).length}</td>
              <td className="center"><button className="btn btn-danger btn-sm" onClick={() => setCampuses((prev) => prev.filter((x) => x.id !== p.id))}>Xóa</button></td>
            </tr>
          ))}
          <tr className="add-row">
            <td className="stt">{campuses.length + 1}</td>
            <td><input value={draft} placeholder="Mời nhập tên điểm trường" onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} /></td>
            <td colSpan={2} className="center"><button className="btn btn-add" onClick={add}>+</button></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/* ================= Bước 6 ================= */

function ClassesStep({ classes, setClasses, grades, campuses, assignments, config, onOpenFramework }) {
  const [draft, setDraft] = useState("");
  const [draftGrade, setDraftGrade] = useState(grades[0] ? grades[0].id : "");
  const update = (id, patch) => setClasses((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  function add() {
    const v = draft.trim();
    if (!v) return;
    setClasses((prev) => [...prev, { id: nextId("c"), name: v, gradeId: draftGrade, campusId: "", offSlots: [] }]);
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
            <button className="btn btn-primary btn-sm">Nhập danh sách lớp</button>
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
                <td><input value={c.name} onChange={(e) => update(c.id, { name: e.target.value })} /></td>
                <td>
                  <select value={c.gradeId} onChange={(e) => update(c.id, { gradeId: e.target.value })}>
                    <option value="">-- Chọn khối --</option>
                    {grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </td>
                <td>
                  {campuses.length === 0 ? (
                    <span className="muted">Không có điểm trường</span>
                  ) : (
                    <select value={c.campusId} onChange={(e) => update(c.id, { campusId: e.target.value })}>
                      <option value="">Không có điểm trường</option>
                      {campuses.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  )}
                </td>
                <td className="center">
                  <button className="btn btn-primary btn-sm" onClick={() => onOpenFramework({ type: "class", id: c.id })}>
                    Khung CT
                  </button>
                </td>
                <td className="center">
                  <button className="btn btn-danger btn-sm" onClick={() => setClasses((prev) => prev.filter((x) => x.id !== c.id))}>Xóa</button>
                </td>
              </tr>
            );
          })}
          <tr className="add-row">
            <td className="stt">{classes.length + 1}</td>
            <td><input value={draft} placeholder="Mời nhập tên lớp học" onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} /></td>
            <td>
              <select value={draftGrade} onChange={(e) => setDraftGrade(e.target.value)}>
                <option value="">-- Chọn khối --</option>
                {grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </td>
            <td colSpan={2} />
            <td className="center"><button className="btn btn-add" onClick={add}>+</button></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/* ================= Khung chương trình (Bước 6.1 + 6.2) ================= */

function FrameworkView({
  scope, classes, grades, subjects, teachers, config,
  items, setItems, setClasses, effectiveSchedule, lessonById,
  gradeAssignments, onClose, onNext, onSaved,
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

  const offSlots = useMemo(() => new Set(klass ? klass.offSlots || [] : []), [klass]);
  const rows = items;

  const totalKhungCT = rows.reduce((s, a) => s + Number(a.soTiet || 0), 0);
  const totalSlots = days.length * sessions.length * tiets.length - (isClass ? offSlots.size : 0);

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
    setClasses((prev) =>
      prev.map((c) => {
        if (c.id !== scope.id) return c;
        const list = c.offSlots || [];
        return { ...c, offSlots: list.includes(slot) ? list.filter((s) => s !== slot) : [...list, slot] };
      })
    );
  }

  /* Ô chỉ hiện tiết của chính lớp này; lớp khác trong khối chỉ hiện tên lớp đang bận. */
  function cellInfo(slot) {
    const own = isClass ? lessonById[effectiveSchedule[`${slot}|${scope.id}`]] : null;
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
        <span className="fw-name">{isClass ? (klass ? klass.name : "Lớp") : (grade ? grade.name : "Khối")}</span>
        {isClass && <button className="btn btn-danger btn-sm" onClick={onNext}>⏩ Kế tiếp</button>}
        <div className="spacer" />
        <button className="btn btn-primary btn-sm" onClick={onClose}>Đóng</button>
        <button className="btn btn-warn btn-sm" onClick={onSaved}>Lưu</button>
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
              <input type="radio" checked={busyScope === "khoi"} onChange={() => setBusyScope("khoi")} />
              Xem tiết bận của cả lớp và khối
            </label>
            <label>
              <input type="radio" checked={busyScope === "lop"} onChange={() => setBusyScope("lop")} />
              Xem tiết bận của riêng lớp
            </label>
          </div>

          <div className="fw-guide">
            <strong>Hướng dẫn:</strong> nhấn vào những vị trí mà lớp không phải học
          </div>
          <div className="fw-legend-bar">Nghỉ</div>

          <div className="fw-grid-wrap">
            <table className="fw-grid">
              <thead>
                <tr>
                  <th colSpan={2} />
                  {days.map((d) => <th key={d}>{d}</th>)}
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) =>
                  tiets.map((tiet, i) => (
                    <tr key={session + tiet}>
                      {i === 0 && <td className="fw-session" rowSpan={tiets.length}>{session}</td>}
                      <td className="fw-tiet">Tiết {tiet}</td>
                      {days.map((d) => {
                        const slot = slotKey(d, session, tiet);
                        const off = offSlots.has(slot);
                        const { own, locked, others } = cellInfo(slot);
                        let cls = "fw-cell ";
                        let text = "Trống";
                        if (off) { cls += "off"; text = "Nghỉ"; }
                        else if (locked) { cls += "locked"; text = own.subjectName; }
                        else if (own) { cls += "busy"; text = own.subjectName; }
                        else if (others.length) { cls += "other"; text = others.join(", "); }
                        else cls += "free";
                        return (
                          <td
                            key={slot}
                            className={cls}
                            onClick={() => { if (!locked) toggleOff(slot); }}
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
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="fw-sub-head">
        <h3>{isClass ? "Bước 6.2: Khung chương trình" : "Khung chương trình của khối"}</h3>
        <div className="spacer" />
        {isClass && (
          <div className="fw-sync">
            <span>Đồng bộ với khung chương trình của khối:</span>
            <select value={syncGradeId} onChange={(e) => setSyncGradeId(e.target.value)}>
              {grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <button
              className="btn btn-danger btn-sm"
              onClick={() => {
                const src = gradeAssignments.filter((a) => a.gradeId === syncGradeId);
                if (src.length === 0) return;
                if (!window.confirm("Thay thế khung chương trình hiện tại của lớp bằng khung của khối?")) return;
                setItems((prev) => [
                  ...prev.filter((a) => a.classId !== scope.id),
                  ...src.map((a) => newAssignment({
                    classId: scope.id,
                    subjectId: a.subjectId,
                    teacherId: a.teacherId,
                    soTiet: a.soTiet,
                    tietLienTiep: a.tietLienTiep,
                    fixed: [...(a.fixed || [])],
                    avoid: [...(a.avoid || [])],
                  })),
                ]);
              }}
            >Đồng bộ</button>
          </div>
        )}
      </div>

      <div className="fw-note">
        Cột <strong>Cố định - Tránh</strong>: tiết cố định sẽ được khóa đúng vị trí đã chọn và không thể gỡ hay đổi chỗ trong thời khóa biểu. Tiết tránh là vị trí không được phép xếp.
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
          {rows.length === 0 && <tr><td colSpan={7} className="empty">Chưa có môn nào trong khung chương trình.</td></tr>}
          {rows.map((a, i) => {
            const subject = subjects.find((s) => s.id === a.subjectId);
            const over = (a.fixed || []).length > Number(a.soTiet || 0);
            return (
              <tr key={a.id}>
                <td className="stt center">{i + 1}</td>
                <td className="center">
                  <select value={a.subjectId} onChange={(e) => update(a.id, { subjectId: e.target.value })}>
                    <option value="">Mời chọn môn</option>
                    {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </td>
                <td>
                  <select value={a.teacherId} onChange={(e) => update(a.id, { teacherId: e.target.value })}>
                    <option value="">Mời chọn giáo viên</option>
                    {teachers.map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}
                  </select>
                </td>
                <td>
                  <input type="number" min={1} max={30} value={a.soTiet} onChange={(e) => update(a.id, { soTiet: e.target.value })} className={over ? "bad" : ""} />
                </td>
                <td>
                  <input type="number" min={1} max={5} value={a.tietLienTiep} onChange={(e) => update(a.id, { tietLienTiep: e.target.value })} />
                </td>
                <td className="center">
                  <button className="btn btn-info btn-sm" onClick={() => setPicker(a.id)}>
                    {(a.fixed || []).length} - {(a.avoid || []).length} tiết
                  </button>
                </td>
                <td className="center">
                  <button className="btn btn-danger btn-sm" onClick={() => setItems((prev) => prev.filter((x) => x.id !== a.id))}>Xóa</button>
                </td>
              </tr>
            );
          })}
          <tr className="add-row">
            <td className="stt center">{rows.length + 1}</td>
            <td>
              <select value={draftSubject} onChange={(e) => setDraftSubject(e.target.value)}>
                <option value="">Mời chọn môn</option>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </td>
            <td>
              <select value={draftTeacher} onChange={(e) => setDraftTeacher(e.target.value)}>
                <option value="">Mời chọn giáo viên</option>
                {teachers.map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}
              </select>
            </td>
            <td><input type="number" min={1} value={draftSoTiet} onChange={(e) => setDraftSoTiet(e.target.value)} /></td>
            <td><input type="number" min={1} value={draftLienTiep} onChange={(e) => setDraftLienTiep(e.target.value)} /></td>
            <td colSpan={2} className="center"><button className="btn btn-add" onClick={addRow}>+</button></td>
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

/* bảng chọn tiết cố định / tiết tránh */
function SlotPicker({ item, subject, config, offSlots, onClose, onChange }) {
  const days = getDays(config.soNgay);
  const sessions = getSessions(config.soBuoi);
  const tiets = getTiets(config.soTiet);
  const fixed = item.fixed || [];
  const avoid = item.avoid || [];
  const maxFixed = Math.max(1, Number(item.soTiet) || 1);

  function cycle(slot) {
    if (offSlots.has(slot)) return;
    if (fixed.includes(slot)) {
      onChange({ fixed: fixed.filter((s) => s !== slot), avoid: [...avoid, slot] });
    } else if (avoid.includes(slot)) {
      onChange({ avoid: avoid.filter((s) => s !== slot) });
    } else {
      if (fixed.length >= maxFixed) {
        onChange({ avoid: [...avoid, slot] });
        return;
      }
      onChange({ fixed: [...fixed, slot] });
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Cố định - Tránh: {subject ? subject.name : "môn chưa chọn"}</h3>
          <button className="btn btn-primary btn-sm" onClick={onClose}>Xong</button>
        </div>
        <p className="hint">
          Bấm một ô để chuyển lần lượt: trống → <strong className="ok-text">cố định</strong> → <strong className="bad-text">tránh</strong> → trống.
          Đã cố định {fixed.length}/{maxFixed} tiết, tránh {avoid.length} tiết.
        </p>
        <div className="fw-grid-wrap">
          <table className="fw-grid">
            <thead>
              <tr>
                <th colSpan={2} />
                {days.map((d) => <th key={d}>{d}</th>)}
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) =>
                tiets.map((tiet, i) => (
                  <tr key={session + tiet}>
                    {i === 0 && <td className="fw-session" rowSpan={tiets.length}>{session}</td>}
                    <td className="fw-tiet">Tiết {tiet}</td>
                    {days.map((d) => {
                      const slot = slotKey(d, session, tiet);
                      const off = offSlots.has(slot);
                      let cls = "fw-cell pick";
                      let text = "";
                      if (off) { cls += " off"; text = "Nghỉ"; }
                      else if (fixed.includes(slot)) { cls += " fixed"; text = "Cố định"; }
                      else if (avoid.includes(slot)) { cls += " avoid"; text = "Tránh"; }
                      return (
                        <td key={slot} className={cls} onClick={() => cycle(slot)}>{text}</td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {fixed.length > 0 && (
          <p className="hint">Cố định tại: {fixed.map(slotLabel).join("; ")}</p>
        )}
      </div>
    </div>
  );
}

/* ================= Bước 7 ================= */

function AssignmentsStep({
  assignments, setAssignments, classes, subjects, teachers, grades,
  filter, setFilter, onGoToTimetable, onOpenFramework,
}) {
  const [subjectId, setSubjectId] = useState(subjects[0] ? subjects[0].id : "");
  const [teacherId, setTeacherId] = useState("");
  const [soTiet, setSoTiet] = useState(1);

  const visibleClasses = useMemo(() => {
    if (filter.classId) return classes.filter((c) => c.id === filter.classId);
    if (filter.gradeId) return classes.filter((c) => c.gradeId === filter.gradeId);
    return classes;
  }, [classes, filter]);

  const targetClassId = filter.classId || (visibleClasses[0] ? visibleClasses[0].id : "");

  function add() {
    if (!targetClassId || !subjectId) return;
    setAssignments((prev) => [
      ...prev,
      newAssignment({ classId: targetClassId, subjectId, teacherId, soTiet: Math.max(1, Number(soTiet) || 1) }),
    ]);
    setSoTiet(1);
  }
  function applyToAll() {
    if (!subjectId) return;
    setAssignments((prev) => [
      ...prev,
      ...visibleClasses.map((c) => newAssignment({ classId: c.id, subjectId, teacherId, soTiet: Math.max(1, Number(soTiet) || 1) })),
    ]);
  }

  return (
    <div className="panel">
      <PanelTitle
        title="Phân công giảng dạy"
        actions={<button className="btn btn-primary btn-sm" onClick={onGoToTimetable}>Sang bảng xếp tiết</button>}
      />
      <p className="hint">
        Đây là bản gộp của tất cả khung chương trình. Muốn chỉnh riêng một lớp kèm lịch nghỉ và tiết cố định, mở Khung CT của lớp đó ở Bước 6.
      </p>

      <div className="filter-bar">
        <label>
          Khối
          <select value={filter.gradeId || ""} onChange={(e) => setFilter({ gradeId: e.target.value, classId: "" })}>
            <option value="">Tất cả</option>
            {grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </label>
        <label>
          Lớp
          <select value={filter.classId || ""} onChange={(e) => setFilter({ ...filter, classId: e.target.value })}>
            <option value="">Tất cả</option>
            {classes.filter((c) => !filter.gradeId || c.gradeId === filter.gradeId).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        {filter.classId && (
          <button className="btn btn-info btn-sm" onClick={() => onOpenFramework({ type: "class", id: filter.classId })}>
            Mở Khung CT của lớp này
          </button>
        )}
      </div>

      <div className="assign-form">
        <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
          <option value="">-- Chưa phân công giáo viên --</option>
          {teachers.map((t) => <option key={t.id} value={t.id}>{t.short} — {t.fullName}</option>)}
        </select>
        <input type="number" min={1} max={30} value={soTiet} onChange={(e) => setSoTiet(e.target.value)} title="Số tiết trong tuần" />
        <button className="btn btn-primary" onClick={add} disabled={!targetClassId}>
          Thêm cho {targetClassId ? classes.find((c) => c.id === targetClassId)?.name : "lớp"}
        </button>
        <button className="btn btn-info" onClick={applyToAll}>Áp dụng cho {visibleClasses.length} lớp đang lọc</button>
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
          {assignments.filter((a) => visibleClasses.some((c) => c.id === a.classId)).length === 0 && (
            <tr><td colSpan={7} className="empty">Chưa có phân công nào cho phạm vi đang lọc.</td></tr>
          )}
          {assignments.filter((a) => visibleClasses.some((c) => c.id === a.classId)).map((a, i) => {
            const klass = classes.find((c) => c.id === a.classId);
            return (
              <tr key={a.id}>
                <td className="stt">{i + 1}</td>
                <td>{klass ? klass.name : "?"}</td>
                <td>
                  <select value={a.subjectId} onChange={(e) => setAssignments((prev) => prev.map((x) => (x.id === a.id ? { ...x, subjectId: e.target.value } : x)))}>
                    <option value="">Mời chọn môn</option>
                    {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </td>
                <td>
                  <select value={a.teacherId} onChange={(e) => setAssignments((prev) => prev.map((x) => (x.id === a.id ? { ...x, teacherId: e.target.value } : x)))}>
                    <option value="">-- Chưa phân công --</option>
                    {teachers.map((t) => <option key={t.id} value={t.id}>{t.short}</option>)}
                  </select>
                </td>
                <td>
                  <input type="number" min={1} max={30} value={a.soTiet} onChange={(e) => setAssignments((prev) => prev.map((x) => (x.id === a.id ? { ...x, soTiet: e.target.value } : x)))} />
                </td>
                <td className="center">{(a.fixed || []).length ? `${a.fixed.length} tiết` : <span className="muted">—</span>}</td>
                <td className="center">
                  <button className="btn btn-danger btn-sm" onClick={() => setAssignments((prev) => prev.filter((x) => x.id !== a.id))}>Xóa</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ================= Bước 8 ================= */

function ConstraintsStep({ constraints, setConstraints }) {
  const set = (field, value) => setConstraints((prev) => ({ ...prev, [field]: value }));
  return (
    <div className="panel">
      <PanelTitle title="Cài đặt ràng buộc" />
      <p className="hint">Các ràng buộc này áp dụng khi kiểm tra dữ liệu và khi xếp tiết.</p>
      <div className="constraint-list">
        <label className="switch-row">
          <input type="checkbox" checked={constraints.khongTietTrong} onChange={(e) => set("khongTietTrong", e.target.checked)} />
          Không để tiết trống xen giữa các tiết trong cùng một buổi
        </label>
        <label className="switch-row">
          <input type="checkbox" checked={constraints.chaoCoTiet1Thu2} onChange={(e) => set("chaoCoTiet1Thu2", e.target.checked)} />
          Chào cờ luôn ở tiết 1 sáng thứ 2
        </label>
        <label className="switch-row">
          <input type="checkbox" checked={constraints.uuTienMonChinhBuoiSang} onChange={(e) => set("uuTienMonChinhBuoiSang", e.target.checked)} />
          Ưu tiên xếp môn chính vào buổi sáng
        </label>
        <label className="switch-row number">
          Số tiết tối đa một giáo viên dạy trong một ngày
          <input type="number" min={1} max={12} value={constraints.gvToiDaTrenNgay} onChange={(e) => set("gvToiDaTrenNgay", e.target.value)} />
        </label>
      </div>
    </div>
  );
}

/* ================= Thời khóa biểu ================= */

function TimetableView({
  config, classes, teachers, schedule, setSchedule,
  lessons, lessonById, effectiveSchedule, pinnedKeys, pinnedLessonIds,
  focusClassId, onClearFocus, onBack, constraints,
}) {
  const days = useMemo(() => getDays(config.soNgay), [config.soNgay]);
  const sessions = useMemo(() => getSessions(config.soBuoi), [config.soBuoi]);
  const tiets = useMemo(() => getTiets(config.soTiet), [config.soTiet]);
  const rowsPerDay = sessions.length * tiets.length;

  const [selectedId, setSelectedId] = useState(null);
  const [flash, setFlash] = useState("");
  const [flashType, setFlashType] = useState("ok");
  const [filterClass, setFilterClass] = useState("");
  const [filterTeacher, setFilterTeacher] = useState("");
  const [highlightClassId, setHighlightClassId] = useState(null);
  const thRefs = useRef({});

  const offByClass = useMemo(() => {
    const m = {};
    classes.forEach((c) => { m[c.id] = new Set(c.offSlots || []); });
    return m;
  }, [classes]);

  const placedIds = useMemo(() => new Set(Object.values(effectiveSchedule)), [effectiveSchedule]);
  const unscheduled = useMemo(() => lessons.filter((l) => !placedIds.has(l.id)), [lessons, placedIds]);

  const filteredUnscheduled = useMemo(
    () => unscheduled.filter((l) => (!filterClass || l.classId === filterClass) && (!filterTeacher || l.teacherId === filterTeacher)),
    [unscheduled, filterClass, filterTeacher]
  );

  const selectedItem = selectedId ? lessonById[selectedId] || null : null;

  useEffect(() => {
    if (focusClassId && thRefs.current[focusClassId]) {
      thRefs.current[focusClassId].scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      setFilterClass(focusClassId);
      setHighlightClassId(focusClassId);
      const t = setTimeout(() => { setHighlightClassId(null); onClearFocus(); }, 1600);
      return () => clearTimeout(t);
    }
  }, [focusClassId]); // eslint-disable-line

  function showFlash(msg, type = "ok") {
    setFlash(msg);
    setFlashType(type);
    window.clearTimeout(showFlash._t);
    showFlash._t = window.setTimeout(() => setFlash(""), 2800);
  }

  function teacherBusy(day, session, tiet, tId, excludeKey) {
    if (!tId) return null;
    for (const [key, lessonId] of Object.entries(effectiveSchedule)) {
      if (key === excludeKey) continue;
      const pos = parseCell(key);
      const lesson = lessonById[lessonId];
      if (!lesson) continue;
      if (pos.day === day && pos.session === session && pos.tiet === String(tiet) && lesson.teacherId === tId) {
        const klass = classes.find((c) => c.id === pos.classId);
        return { klass: klass ? klass.name : "?" };
      }
    }
    return null;
  }

  function teacherDayLoad(day, tId) {
    if (!tId) return 0;
    return Object.entries(effectiveSchedule).filter(([key, lessonId]) => {
      const lesson = lessonById[lessonId];
      return lesson && lesson.teacherId === tId && parseCell(key).day === day;
    }).length;
  }

  function handleCellClick(day, session, tiet, klass) {
    const slot = slotKey(day, session, tiet);
    const key = cellKey(day, session, tiet, klass.id);

    if (offByClass[klass.id] && offByClass[klass.id].has(slot)) {
      showFlash(`${klass.name} nghỉ tiết này theo khung chương trình.`, "error");
      return;
    }
    if (pinnedKeys.has(key)) {
      showFlash("Tiết cố định, không thể gỡ hay đổi chỗ. Muốn sửa hãy vào Khung CT của lớp.", "error");
      return;
    }

    const occupantId = schedule[key];

    if (selectedItem) {
      if (selectedItem.classId !== klass.id) {
        showFlash("Tiết này thuộc lớp khác, chỉ xếp được vào cột lớp của nó.", "error");
        return;
      }
      if ((selectedItem.avoid || []).includes(slot)) {
        showFlash(`Vị trí này nằm trong danh sách tiết tránh của ${selectedItem.subjectName}.`, "error");
        return;
      }
      const busy = teacherBusy(day, session, tiet, selectedItem.teacherId, key);
      if (busy) {
        showFlash(`Không xếp được: ${selectedItem.teacherName} đang dạy lớp ${busy.klass} vào tiết ${tiet} ${session} ${day}.`, "error");
        return;
      }
      const max = Number(constraints.gvToiDaTrenNgay) || 99;
      if (selectedItem.teacherId && teacherDayLoad(day, selectedItem.teacherId) >= max) {
        showFlash(`${selectedItem.teacherName} đã đạt ${max} tiết trong ${day}.`, "error");
        return;
      }
      setSchedule((prev) => ({ ...prev, [key]: selectedItem.id }));
      setSelectedId(null);
      showFlash(`Đã xếp ${selectedItem.subjectName} vào ${klass.name} — ${day}, tiết ${tiet} ${session}.`);
      return;
    }

    if (occupantId) {
      const lesson = lessonById[occupantId];
      setSchedule((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      showFlash(`Đã gỡ ${lesson ? lesson.subjectName : "tiết"} khỏi ${klass.name} — ${day}, tiết ${tiet}.`);
    }
  }

  function clearAll() {
    if (Object.keys(schedule).length === 0) {
      showFlash("Chỉ còn các tiết cố định, không gỡ được.", "error");
      return;
    }
    setSchedule({});
    setSelectedId(null);
    showFlash("Đã gỡ các tiết xếp tay. Tiết cố định vẫn giữ nguyên.");
  }

  function autoFill() {
    const next = { ...schedule };
    const working = { ...effectiveSchedule };
    let placed = 0;
    const max = Number(constraints.gvToiDaTrenNgay) || 99;

    unscheduled.forEach((lesson) => {
      outer: for (const day of days) {
        for (const session of sessions) {
          for (const tiet of tiets) {
            const slot = slotKey(day, session, tiet);
            const key = cellKey(day, session, tiet, lesson.classId);
            if (working[key]) continue;
            if (offByClass[lesson.classId] && offByClass[lesson.classId].has(slot)) continue;
            if ((lesson.avoid || []).includes(slot)) continue;
            if (lesson.teacherId) {
              const busy = Object.entries(working).some(([k, id]) => {
                const pos = parseCell(k);
                const l = lessonById[id];
                return l && l.teacherId === lesson.teacherId && pos.slot === slot;
              });
              if (busy) continue;
              const load = Object.entries(working).filter(([k, id]) => {
                const l = lessonById[id];
                return l && l.teacherId === lesson.teacherId && parseCell(k).day === day;
              }).length;
              if (load >= max) continue;
            }
            working[key] = lesson.id;
            next[key] = lesson.id;
            placed += 1;
            break outer;
          }
        }
      }
    });

    setSchedule(next);
    showFlash(placed > 0 ? `Đã xếp tự động ${placed} tiết.` : "Không còn chỗ trống phù hợp.", placed > 0 ? "ok" : "error");
  }

  if (classes.length === 0 || lessons.length === 0) {
    return (
      <div className="panel">
        <PanelTitle title="Thời khóa biểu" />
        <p className="hint">
          {classes.length === 0 ? "Chưa có lớp học. Hãy khai báo ở Bước 6." : "Chưa có tiết nào trong khung chương trình. Hãy mở Khung CT của lớp ở Bước 6 hoặc dùng Bước 7."}
        </p>
        <button className="btn btn-primary" onClick={onBack}>Quay lại các bước</button>
      </div>
    );
  }

  return (
    <div className="panel tt-panel">
      <div className="tt-head">
        <div>
          <h2>{config.tenTKB || "Thời khóa biểu"}</h2>
          <p className="tt-sub">
            {[config.tenTruong, config.namHoc].filter(Boolean).join(" - ")} — {placedIds.size} tiết đã xếp
            ({pinnedLessonIds.size} tiết cố định), {unscheduled.length} tiết chưa xếp.
          </p>
        </div>
        <div className="tt-tools">
          <span className={"flash " + flashType}>{flash}</span>
          <button className="btn btn-info btn-sm" onClick={autoFill}>Xếp tự động</button>
          <button className="btn btn-danger btn-sm" onClick={clearAll}>Gỡ tiết xếp tay</button>
          <button className="btn btn-primary btn-sm" onClick={onBack}>Về các bước</button>
        </div>
      </div>

      <div className="tt-layout">
        <div className="tt-scroll">
          <table className="tt-grid">
            <thead>
              <tr>
                <th className="col-thu">Thứ</th>
                <th className="col-buoi">Buổi</th>
                <th className="col-tiet">Tiết</th>
                {classes.map((c) => (
                  <th key={c.id} ref={(el) => { thRefs.current[c.id] = el; }} className={highlightClassId === c.id ? "hl" : ""}>
                    {c.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {days.map((day, di) => {
                let dayDone = false;
                return sessions.map((session) =>
                  tiets.map((tiet, ti) => {
                    const firstOfDay = !dayDone;
                    if (firstOfDay) dayDone = true;
                    const slot = slotKey(day, session, tiet);
                    return (
                      <tr key={`${day}-${session}-${tiet}`} className={ti === 0 ? "sess-start" : ""}>
                        {firstOfDay && <td className="cell-thu" rowSpan={rowsPerDay}>{di === 6 ? "CN" : di + 2}</td>}
                        {ti === 0 && <td className="cell-buoi" rowSpan={tiets.length}>{session}</td>}
                        <td className="cell-tiet">{tiet}</td>
                        {classes.map((c) => {
                          const key = cellKey(day, session, tiet, c.id);
                          const lesson = lessonById[effectiveSchedule[key]];
                          const isPinned = pinnedKeys.has(key);
                          const isOff = offByClass[c.id] && offByClass[c.id].has(slot);
                          let cls = "cell";
                          if (isOff) cls += " off";
                          else if (isPinned) cls += " pinned";
                          else if (selectedItem && !lesson) {
                            if (selectedItem.classId !== c.id) cls += " blocked";
                            else if ((selectedItem.avoid || []).includes(slot) || teacherBusy(day, session, tiet, selectedItem.teacherId, key)) cls += " conflict";
                            else cls += " can-drop";
                          }
                          return (
                            <td key={key} className={cls} onClick={() => handleCellClick(day, session, tiet, c)}>
                              {isOff ? (
                                <span className="lesson muted">Nghỉ</span>
                              ) : lesson ? (
                                <span className="lesson">
                                  {isPinned && <span className="lock">🔒</span>}
                                  {lesson.subjectName}{lesson.teacherName ? ` - ${lesson.teacherName}` : ""}
                                </span>
                              ) : null}
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
          <h3>CÁC TIẾT CHƯA ĐƯỢC XẾP ({unscheduled.length})</h3>
          <p className="side-note">Chọn một tiết rồi bấm vào ô trống trong bảng để xếp. Ô có 🔒 là tiết cố định.</p>
          <div className="side-filters">
            <label>
              Lớp
              <select value={filterClass} onChange={(e) => setFilterClass(e.target.value)}>
                <option value="">Tất cả</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label>
              Giáo viên
              <select value={filterTeacher} onChange={(e) => setFilterTeacher(e.target.value)}>
                <option value="">Tất cả</option>
                {teachers.map((t) => <option key={t.id} value={t.id}>{t.short}</option>)}
              </select>
            </label>
          </div>
          <div className="side-list">
            {filteredUnscheduled.length === 0 && <div className="empty">Không còn tiết nào chưa xếp trong bộ lọc này.</div>}
            {filteredUnscheduled.map((l) => {
              const klass = classes.find((c) => c.id === l.classId);
              return (
                <button
                  key={l.id}
                  className={"side-pill" + (selectedId === l.id ? " selected" : "")}
                  onClick={() => setSelectedId((prev) => (prev === l.id ? null : l.id))}
                >
                  {l.subjectName}{l.teacherName ? ` - ${l.teacherName}` : ""} - {klass ? klass.name : "?"}
                </button>
              );
            })}
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ================= App ================= */

export default function App() {
  const [stage, setStage] = useState("Thủ công");
  const [step, setStep] = useState("config");
  const [view, setView] = useState("steps"); // steps | framework | timetable
  const [frameworkScope, setFrameworkScope] = useState(null);

  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [constraints, setConstraints] = useState(DEFAULT_CONSTRAINTS);
  const [subjects, setSubjects] = useState(SEED_SUBJECTS);
  const [departments, setDepartments] = useState(SEED_DEPARTMENTS);
  const [teachers, setTeachers] = useState(SEED_TEACHERS);
  const [grades, setGrades] = useState(SEED_GRADES);
  const [campuses, setCampuses] = useState([]);
  const [classes, setClasses] = useState(SEED_CLASSES);
  const [assignments, setAssignments] = useState([]);
  const [gradeAssignments, setGradeAssignments] = useState([]);
  const [schedule, setSchedule] = useState({});
  const [assignFilter, setAssignFilter] = useState({ gradeId: "", classId: "" });
  const [focusClassId, setFocusClassId] = useState(null);
  const [checkResult, setCheckResult] = useState(null);
  const [toast, setToast] = useState("");

  const shareUrl = "https://tkb.olm.vn/tkb/6aaa8bc6268089e5bf02e6e0";

  function notify(msg) {
    setToast(msg);
    window.clearTimeout(notify._t);
    notify._t = window.setTimeout(() => setToast(""), 2400);
  }

  /* ---- sinh tiết từ khung chương trình ---- */
  const lessons = useMemo(() => {
    const out = [];
    assignments.forEach((a) => {
      const subject = subjects.find((s) => s.id === a.subjectId);
      const teacher = teachers.find((t) => t.id === a.teacherId);
      const n = Math.max(1, Number(a.soTiet) || 1);
      const fixed = a.fixed || [];
      for (let i = 0; i < n; i += 1) {
        out.push({
          id: `${a.id}#${i}`,
          assignmentId: a.id,
          classId: a.classId,
          subjectId: a.subjectId,
          subjectName: subject ? subject.short || subject.name : "?",
          teacherId: a.teacherId,
          teacherName: teacher ? teacher.short : "",
          avoid: a.avoid || [],
          pinnedSlot: i < fixed.length ? fixed[i] : null,
        });
      }
    });
    return out;
  }, [assignments, subjects, teachers]);

  const lessonById = useMemo(() => {
    const m = {};
    lessons.forEach((l) => { m[l.id] = l; });
    return m;
  }, [lessons]);

  /* ---- các tiết cố định luôn nằm đúng vị trí ---- */
  const { pinned, pinnedKeys, pinnedLessonIds } = useMemo(() => {
    const p = {};
    const keys = new Set();
    const ids = new Set();
    lessons.forEach((l) => {
      if (!l.pinnedSlot) return;
      const key = `${l.pinnedSlot}|${l.classId}`;
      p[key] = l.id;
      keys.add(key);
      ids.add(l.id);
    });
    return { pinned: p, pinnedKeys: keys, pinnedLessonIds: ids };
  }, [lessons]);

  const effectiveSchedule = useMemo(() => {
    const out = {};
    Object.entries(schedule).forEach(([key, id]) => {
      if (pinnedKeys.has(key)) return;
      if (pinnedLessonIds.has(id)) return;
      if (!lessonById[id]) return;
      out[key] = id;
    });
    return { ...out, ...pinned };
  }, [schedule, pinned, pinnedKeys, pinnedLessonIds, lessonById]);

  /* ---- kiểm tra dữ liệu ---- */
  function runCheck() {
    const errors = [];
    if (subjects.length === 0) errors.push("Bước 2: chưa có môn học nào.");
    if (teachers.length === 0) errors.push("Bước 4: chưa có giáo viên nào.");
    if (classes.length === 0) errors.push("Bước 6: chưa có lớp học nào.");

    const noGrade = classes.filter((c) => !c.gradeId);
    if (noGrade.length) errors.push(`Bước 6: ${noGrade.length} lớp chưa chọn khối.`);
    const noDept = teachers.filter((t) => t.departmentIds.length === 0);
    if (noDept.length) errors.push(`Bước 4: ${noDept.length} giáo viên chưa thuộc tổ nào.`);

    const slotCount = allSlots(config).length;
    classes.forEach((c) => {
      const total = assignments.filter((a) => a.classId === c.id).reduce((s, a) => s + Number(a.soTiet || 0), 0);
      const free = slotCount - (c.offSlots || []).length;
      if (total > free) errors.push(`Lớp ${c.name}: ${total} tiết vượt quá ${free} ô khả dụng.`);
    });

    assignments.forEach((a) => {
      const klass = classes.find((c) => c.id === a.classId);
      const subject = subjects.find((s) => s.id === a.subjectId);
      const label = `${klass ? klass.name : "?"} - ${subject ? subject.name : "môn chưa chọn"}`;
      if ((a.fixed || []).length > Number(a.soTiet || 0)) {
        errors.push(`${label}: số tiết cố định nhiều hơn số tiết/tuần.`);
      }
      (a.fixed || []).forEach((slot) => {
        if (klass && (klass.offSlots || []).includes(slot)) {
          errors.push(`${label}: cố định vào ${slotLabel(slot)} nhưng lớp nghỉ tiết đó.`);
        }
      });
    });

    /* trùng tiết cố định của cùng một giáo viên */
    const seen = {};
    lessons.forEach((l) => {
      if (!l.pinnedSlot || !l.teacherId) return;
      const k = `${l.pinnedSlot}|${l.teacherId}`;
      if (seen[k]) {
        const t = teachers.find((x) => x.id === l.teacherId);
        errors.push(`${t ? t.short : "GV"} bị cố định 2 lớp cùng lúc tại ${slotLabel(l.pinnedSlot)}.`);
      }
      seen[k] = true;
    });

    if (assignments.length === 0) errors.push("Chưa có khung chương trình cho lớp nào.");
    setCheckResult({ errors, at: Date.now() });
  }

  function resetData() {
    if (!window.confirm("Xóa toàn bộ dữ liệu của thời khóa biểu này?")) return;
    setSubjects([]); setDepartments([]); setTeachers([]); setGrades([]);
    setCampuses([]); setClasses([]); setAssignments([]); setGradeAssignments([]);
    setSchedule({}); setCheckResult(null);
    notify("Đã xóa dữ liệu của thời khóa biểu.");
  }

  function openFramework(scope) {
    setFrameworkScope(scope);
    setView("framework");
  }

  function nextClass() {
    if (!frameworkScope || frameworkScope.type !== "class") return;
    const i = classes.findIndex((c) => c.id === frameworkScope.id);
    const next = classes[(i + 1) % classes.length];
    if (next) setFrameworkScope({ type: "class", id: next.id });
  }

  const frameworkItems = useMemo(() => {
    if (!frameworkScope) return [];
    return frameworkScope.type === "class"
      ? assignments.filter((a) => a.classId === frameworkScope.id)
      : gradeAssignments.filter((a) => a.gradeId === frameworkScope.id);
  }, [frameworkScope, assignments, gradeAssignments]);

  const setFrameworkItems = (updater) => {
    const setter = frameworkScope.type === "class" ? setAssignments : setGradeAssignments;
    setter((prev) => {
      const mine = frameworkScope.type === "class"
        ? prev.filter((a) => a.classId === frameworkScope.id)
        : prev.filter((a) => a.gradeId === frameworkScope.id);
      const others = prev.filter((a) => !mine.includes(a));
      const nextMine = typeof updater === "function" ? updater(mine) : updater;
      return [...others, ...nextMine];
    });
  };

  return (
    <div className="tkb-root">
      <style>{STYLES}</style>

      <StatusBar stage={stage} onChangeStage={setStage} shareUrl={shareUrl} />

      <div className="layout">
        <Sidebar
          activeStep={view === "steps" ? step : ""}
          onSelect={(k) => { setView("steps"); setStep(k); }}
          checkResult={checkResult}
          onCheck={runCheck}
          onViewResult={() => setView("timetable")}
        />

        <main className="content">
          {toast && <div className="toast">{toast}</div>}

          {view === "timetable" && (
            <TimetableView
              config={config}
              classes={classes}
              teachers={teachers}
              schedule={schedule}
              setSchedule={setSchedule}
              lessons={lessons}
              lessonById={lessonById}
              effectiveSchedule={effectiveSchedule}
              pinnedKeys={pinnedKeys}
              pinnedLessonIds={pinnedLessonIds}
              constraints={constraints}
              focusClassId={focusClassId}
              onClearFocus={() => setFocusClassId(null)}
              onBack={() => setView("steps")}
            />
          )}

          {view === "framework" && frameworkScope && (
            <FrameworkView
              scope={frameworkScope}
              classes={classes}
              grades={grades}
              subjects={subjects}
              teachers={teachers}
              config={config}
              items={frameworkItems}
              setItems={setFrameworkItems}
              setClasses={setClasses}
              effectiveSchedule={effectiveSchedule}
              lessonById={lessonById}
              gradeAssignments={gradeAssignments}
              onClose={() => setView("steps")}
              onNext={nextClass}
              onSaved={() => notify("Đã lưu khung chương trình.")}
            />
          )}

          {view === "steps" && (
            <>
              {step === "config" && (
                <ConfigStep
                  config={config}
                  setConfig={setConfig}
                  onSaved={() => notify("Đã lưu cài đặt.")}
                  onOpenConstraints={() => setStep("constraints")}
                  onResetData={resetData}
                />
              )}
              {step === "subjects" && <SubjectsStep subjects={subjects} setSubjects={setSubjects} />}
              {step === "departments" && (
                <DepartmentsStep departments={departments} setDepartments={setDepartments} teachers={teachers} onOpenTeachers={() => setStep("teachers")} />
              )}
              {step === "teachers" && (
                <TeachersStep teachers={teachers} setTeachers={setTeachers} departments={departments} assignments={assignments} />
              )}
              {step === "grades" && (
                <GradesStep grades={grades} setGrades={setGrades} classes={classes} gradeAssignments={gradeAssignments} onOpenFramework={openFramework} />
              )}
              {step === "campuses" && <CampusesStep campuses={campuses} setCampuses={setCampuses} classes={classes} />}
              {step === "classes" && (
                <ClassesStep
                  classes={classes}
                  setClasses={setClasses}
                  grades={grades}
                  campuses={campuses}
                  assignments={assignments}
                  config={config}
                  onOpenFramework={openFramework}
                />
              )}
              {step === "assignments" && (
                <AssignmentsStep
                  assignments={assignments}
                  setAssignments={setAssignments}
                  classes={classes}
                  subjects={subjects}
                  teachers={teachers}
                  grades={grades}
                  filter={assignFilter}
                  setFilter={setAssignFilter}
                  onGoToTimetable={() => { setFocusClassId(assignFilter.classId || null); setView("timetable"); }}
                  onOpenFramework={openFramework}
                />
              )}
              {step === "constraints" && <ConstraintsStep constraints={constraints} setConstraints={setConstraints} />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

/* ================= CSS ================= */

const STYLES = `
.tkb-root {
  --bg: #f4f5fb;
  --card: #ffffff;
  --line: #e3e6f0;
  --ink: #2f3443;
  --muted: #8a90a6;
  --primary: #4f46e5;
  --info: #5b8def;
  --danger: #ef4444;
  --danger-dark: #dc2626;
  --green: #22c55e;
  --green-dark: #16a34a;
  --warn: #f59e0b;
  --stage: #6c63b5;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background: var(--bg);
  color: var(--ink);
  min-height: 100%;
  font-size: 14px;
}
.tkb-root *, .tkb-root *::before, .tkb-root *::after { box-sizing: border-box; }
.tkb-root h2, .tkb-root h3 { margin: 0; }

.statusbar { padding: 12px 20px 0; }
.share-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
.share-label { font-weight: 600; }
.share-url { color: var(--primary); font-weight: 600; word-break: break-all; }
.stage-row { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.stage-label { font-weight: 600; white-space: nowrap; }
.stage-track { display: flex; align-items: center; flex: 1; flex-wrap: wrap; }
.stage {
  flex: 1; min-width: 110px; background: #fff; border: 1px solid var(--line);
  color: var(--muted); padding: 10px 8px; font-size: 13px; cursor: pointer;
  position: relative; margin-right: 12px; border-radius: 4px; font-family: inherit;
}
.stage::after { content: ""; position: absolute; right: -12px; top: 50%; width: 12px; height: 1px; background: var(--line); }
.stage:last-child { margin-right: 0; }
.stage:last-child::after { display: none; }
.stage.active { background: var(--stage); border-color: var(--stage); color: #fff; font-weight: 600; }

.layout { display: grid; grid-template-columns: 280px 1fr; gap: 20px; padding: 18px 20px 40px; align-items: start; }
@media (max-width: 1000px) { .layout { grid-template-columns: 1fr; } }

.sidebar { position: sticky; top: 12px; }
.nav-group { margin-bottom: 16px; }
.nav-group h3 { font-size: 15px; margin: 0 0 8px; }
.nav-card { background: var(--card); border: 1px solid var(--line); border-radius: 6px; padding: 6px; }
.nav-item { display: block; width: 100%; text-align: left; background: none; border: none; padding: 8px 10px; font-size: 14px; color: var(--ink); cursor: pointer; border-radius: 4px; font-family: inherit; }
.nav-item.small { font-size: 13px; }
.nav-item:hover { background: #f1f2fa; }
.nav-item.active { color: var(--primary); font-weight: 700; }
.check-card { margin-bottom: 14px; padding: 12px; }
.check-empty { margin: 10px 0 0; font-size: 13px; color: var(--muted); }
.check-ok { margin: 10px 0 0; font-size: 13px; color: #15803d; }
.check-errors { margin: 10px 0 0; padding-left: 18px; font-size: 12.5px; color: var(--danger); }
.check-errors li { margin-bottom: 4px; }
.btn-check { width: 100%; background: #7aa2f7; }
.btn-result { width: 100%; background: #4338ca; padding: 12px; font-size: 15px; }

.btn { border: none; border-radius: 5px; padding: 9px 14px; font-size: 14px; cursor: pointer; font-family: inherit; color: #fff; background: var(--primary); white-space: nowrap; }
.btn:hover { filter: brightness(0.94); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-sm { padding: 6px 10px; font-size: 13px; }
.btn-primary { background: var(--primary); }
.btn-info { background: var(--info); }
.btn-danger { background: var(--danger); }
.btn-warn { background: var(--warn); }
.btn-add { background: var(--green); padding: 6px 12px; font-size: 16px; line-height: 1; }
.btn.block { width: 100%; }
.btn-row { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
.btn-row.tight { margin-bottom: 0; }
.row-right { display: flex; justify-content: flex-end; margin: 4px 0 20px; }

.content { min-width: 0; }
.panel { background: var(--card); border: 1px solid var(--line); border-radius: 8px; padding: 18px 20px 24px; }
.panel-title { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin: 22px 0 14px; padding-bottom: 8px; border-bottom: 1px solid var(--line); }
.panel-title:first-child { margin-top: 0; }
.panel-title h2 { font-size: 22px; font-weight: 700; }
.panel-title .spacer, .fw-head .spacer, .fw-sub-head .spacer { flex: 1; }
.hint { font-size: 13px; color: var(--muted); margin: 0 0 14px; line-height: 1.55; max-width: 80ch; }
.muted { color: var(--muted); }
.center { text-align: center; }
.empty { color: var(--muted); text-align: center; padding: 18px 0; }
.ok-text { color: var(--green-dark); }
.bad-text { color: var(--danger); }

input, select { border: 1px solid var(--line); border-radius: 5px; padding: 9px 10px; font-size: 14px; background: #fff; color: var(--ink); font-family: inherit; width: 100%; }
input::placeholder { color: #aab0c4; }
input:focus, select:focus { outline: 2px solid rgba(79,70,229,0.35); border-color: var(--primary); }
input.bad { border-color: var(--danger); background: #fff5f5; }
.config-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px 24px; }
@media (max-width: 900px) { .config-grid { grid-template-columns: 1fr; } }
.field { display: flex; flex-direction: column; gap: 6px; font-size: 14px; }
.field.warn > span { color: var(--danger); }
.with-addon { display: flex; }
.with-addon input { border-radius: 5px 0 0 5px; }
.addon-btn { border: 1px solid var(--line); border-left: none; background: #eef0f8; border-radius: 0 5px 5px 0; padding: 0 14px; cursor: pointer; font-size: 16px; }

.grid-table { width: 100%; border-collapse: collapse; }
.grid-table th { text-align: left; font-size: 13.5px; font-weight: 700; padding: 10px 8px; border-bottom: 1px solid var(--line); vertical-align: top; }
.grid-table th small { display: block; font-weight: 400; font-size: 11.5px; color: var(--danger); margin-top: 2px; }
.grid-table td { padding: 7px 8px; border-bottom: 1px solid #f0f1f7; vertical-align: middle; }
.grid-table tr:hover td { background: #fafbff; }
.grid-table .stt { color: var(--muted); width: 46px; }
.w-stt { width: 60px; } .w-act { width: 130px; } .w-act2 { width: 180px; }
.grid-table .actions { display: flex; gap: 8px; }
.add-row td { background: #fbfcff; }
.chip-cell { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.chip-cell select { width: auto; min-width: 90px; }
.tag { display: inline-flex; align-items: center; gap: 4px; background: #eef0fb; border: 1px solid var(--line); border-radius: 4px; padding: 3px 8px; font-size: 13px; }
.tag button { border: none; background: none; cursor: pointer; color: var(--muted); font-size: 14px; padding: 0; }
.tag button:hover { color: var(--danger); }

.toggle { width: 38px; height: 20px; border-radius: 999px; background: #d5d8e6; border: none; cursor: pointer; padding: 2px; display: inline-flex; }
.toggle span { width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: transform 0.15s ease; }
.toggle.on { background: var(--primary); }
.toggle.on span { transform: translateX(18px); }

.preview-wrap, .fw-grid-wrap { overflow-x: auto; }
.preview-grid { width: 100%; border-collapse: collapse; min-width: 720px; }
.preview-grid th, .preview-grid td { border: 1px solid var(--line); padding: 10px 8px; text-align: center; font-size: 13.5px; height: 40px; }
.prev-session { font-weight: 700; width: 70px; }
.prev-tiet { width: 110px; font-weight: 600; }

/* khung chương trình */
.fw-panel { padding-top: 14px; }
.fw-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; border-bottom: 1px solid var(--line); padding-bottom: 10px; margin-bottom: 12px; }
.fw-name { font-size: 20px; font-weight: 700; color: var(--primary); }
.fw-warn { text-align: center; color: var(--warn); font-weight: 600; font-size: 13.5px; margin: 0 0 12px; }
.fw-warn.over { color: var(--danger); }
.fw-radio { display: flex; flex-direction: column; gap: 4px; font-size: 13px; margin-bottom: 10px; }
.fw-radio label { display: flex; align-items: center; gap: 8px; }
.fw-radio input { width: auto; }
.fw-guide { background: #fdeaea; color: var(--danger-dark); border-radius: 4px; padding: 10px 12px; font-size: 13px; margin-bottom: 10px; }
.fw-legend-bar { border: 1px solid var(--line); border-radius: 4px; text-align: center; color: var(--danger); padding: 6px; font-size: 13px; margin-bottom: 10px; }
.fw-grid { width: 100%; border-collapse: collapse; min-width: 760px; }
.fw-grid th, .fw-grid td { border: 1px solid var(--line); padding: 8px 6px; text-align: center; font-size: 13px; }
.fw-grid th { font-weight: 700; }
.fw-session { width: 64px; font-weight: 700; }
.fw-tiet { width: 110px; font-weight: 600; }
.fw-cell { cursor: pointer; height: 34px; }
.fw-cell.free { background: var(--green); color: #fff; }
.fw-cell.busy { background: #e8edff; color: var(--ink); font-size: 12px; }
.fw-cell.locked { background: var(--danger); color: #fff; font-weight: 600; font-size: 12px; cursor: not-allowed; }
.fw-cell.other { background: #f7f8fc; color: var(--muted); font-size: 12px; }
.fw-cell.off { background: #f1f2f7; color: var(--danger); font-weight: 600; }
.fw-cell.pick { background: #fff; }
.fw-cell.pick.fixed { background: var(--green-dark); color: #fff; font-weight: 600; }
.fw-cell.pick.avoid { background: var(--danger); color: #fff; font-weight: 600; }
.fw-sub-head { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin: 24px 0 10px; }
.fw-sub-head h3 { font-size: 18px; font-weight: 600; }
.fw-sync { display: flex; align-items: center; gap: 8px; font-size: 13px; }
.fw-sync select { width: auto; min-width: 130px; }
.fw-note { background: #fff8e6; border-radius: 4px; padding: 10px 12px; font-size: 13px; margin-bottom: 12px; line-height: 1.5; }

.filter-bar { display: flex; gap: 14px; flex-wrap: wrap; align-items: center; margin-bottom: 14px; }
.filter-bar label { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--muted); }
.filter-bar select { width: auto; min-width: 140px; }
.assign-form { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 18px; }
.assign-form select { width: auto; min-width: 180px; }
.assign-form input { width: 90px; }

.constraint-list { display: flex; flex-direction: column; gap: 12px; max-width: 640px; }
.switch-row { display: flex; align-items: center; gap: 10px; font-size: 14px; }
.switch-row input[type="checkbox"] { width: 18px; height: 18px; }
.switch-row.number { justify-content: space-between; }
.switch-row.number input { width: 90px; }

/* modal */
.modal-backdrop { position: fixed; inset: 0; background: rgba(20,22,35,0.45); display: flex; align-items: center; justify-content: center; padding: 20px; z-index: 50; }
.modal { background: #fff; border-radius: 8px; padding: 18px; max-width: 1000px; width: 100%; max-height: 88vh; overflow: auto; }
.modal-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.modal-head h3 { font-size: 17px; }

/* thời khóa biểu */
.tt-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; flex-wrap: wrap; border-bottom: 1px solid var(--line); padding-bottom: 12px; margin-bottom: 14px; }
.tt-head h2 { font-size: 20px; }
.tt-sub { margin: 4px 0 0; font-size: 13px; color: var(--muted); }
.tt-tools { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.flash { font-size: 13px; max-width: 380px; }
.flash.ok { color: #15803d; }
.flash.error { color: var(--danger); font-weight: 600; }
.tt-layout { display: grid; grid-template-columns: 1fr 300px; gap: 16px; align-items: start; }
@media (max-width: 1100px) { .tt-layout { grid-template-columns: 1fr; } }
.tt-scroll { overflow: auto; max-height: 72vh; border: 1px solid var(--line); border-radius: 6px; }
.tt-grid { border-collapse: collapse; width: 100%; min-width: 760px; }
.tt-grid th, .tt-grid td { border: 1px solid var(--line); font-size: 13px; }
.tt-grid thead th { background: #fff; padding: 10px 8px; position: sticky; top: 0; z-index: 3; font-weight: 700; }
.tt-grid thead th.hl { background: var(--primary); color: #fff; }
.col-thu { width: 54px; } .col-buoi { width: 64px; } .col-tiet { width: 46px; }
.cell-thu { text-align: center; font-size: 20px; font-weight: 700; background: #fff; position: sticky; left: 0; z-index: 2; }
.cell-buoi { text-align: center; font-weight: 600; background: #fff; position: sticky; left: 54px; z-index: 2; }
.cell-tiet { text-align: center; color: var(--muted); background: #fafbff; position: sticky; left: 118px; z-index: 2; }
.tt-grid tbody tr.sess-start td { border-top: 2px solid #c9cde0; }
td.cell { height: 38px; min-width: 150px; padding: 4px 8px; cursor: pointer; background: #fcfcff; }
td.cell:hover { background: #f1f3ff; }
td.cell.can-drop { box-shadow: inset 0 0 0 2px var(--green); }
td.cell.conflict { box-shadow: inset 0 0 0 2px var(--danger); background: #fdeaea; cursor: not-allowed; }
td.cell.blocked { background: #f4f5f9; cursor: not-allowed; }
td.cell.off { background: #eceef5; cursor: not-allowed; }
td.cell.pinned { background: #eef7ee; cursor: not-allowed; }
.lesson { display: block; font-size: 12.5px; line-height: 1.3; }
.lock { margin-right: 3px; }

.tt-side { border: 1px solid var(--line); border-radius: 6px; padding: 12px; background: #fff; }
.tt-side h3 { font-size: 14px; font-weight: 700; margin-bottom: 4px; }
.side-note { font-size: 12px; color: var(--muted); margin: 0 0 10px; }
.side-filters { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px; }
.side-filters label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--muted); }
.side-list { display: flex; flex-direction: column; gap: 6px; max-height: 58vh; overflow: auto; }
.side-pill { border: 1px solid #f3b6b6; border-radius: 5px; background: #fff; color: var(--danger-dark); padding: 8px 10px; font-size: 12.5px; cursor: pointer; text-align: left; font-family: inherit; }
.side-pill:hover { background: #fff5f5; }
.side-pill.selected { background: var(--danger); border-color: var(--danger); color: #fff; font-weight: 600; }

.toast { background: #1f2937; color: #fff; padding: 10px 14px; border-radius: 6px; font-size: 13px; margin-bottom: 12px; display: inline-block; }
`;
