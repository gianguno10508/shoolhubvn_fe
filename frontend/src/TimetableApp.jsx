import { useState, useMemo } from "react";
import {
  exportTimetableToExcel,
  exportPerClassExcel,
  exportPerTeacherExcel,
} from "./utils/excelExport";
import { slotLabel, allSlots } from "./utils/helpers";
import {
  SEED_SUBJECTS,
  SEED_DEPARTMENTS,
  SEED_TEACHERS,
  SEED_GRADES,
  SEED_CLASSES,
} from "./constants/seedData";
import StatusBar from "./components/layout/StatusBar";
import Sidebar from "./components/layout/Sidebar";
import ConfigStep from "./components/steps/ConfigStep";
import SubjectsStep from "./components/steps/SubjectsStep";
import DepartmentsStep from "./components/steps/DepartmentsStep";
import TeachersStep from "./components/steps/TeachersStep";
import GradesStep from "./components/steps/GradesStep";
import CampusesStep from "./components/steps/CampusesStep";
import ClassesStep from "./components/steps/ClassesStep";
import AssignmentsStep from "./components/steps/AssignmentsStep";
import ConstraintsStep from "./components/steps/ConstraintsStep";
import FrameworkView from "./components/framework/FrameworkView";
import TimetableView from "./components/timetable/TimetableView";

export default function TimetableApp({
  initialData,
  timetableId,
  onSave,
  onBack,
}) {
  const [stage, setStage] = useState("Thủ công");
  const [step, setStep] = useState("config");
  const [view, setView] = useState("steps"); // steps | framework | timetable
  const [frameworkScope, setFrameworkScope] = useState(null);

  const [config, setConfig] = useState(initialData.config);
  const [constraints, setConstraints] = useState(initialData.constraints);
  const [subjects, setSubjects] = useState(initialData.subjects);
  const [departments, setDepartments] = useState(initialData.departments);
  const [teachers, setTeachers] = useState(initialData.teachers);
  const [grades, setGrades] = useState(initialData.grades);
  const [campuses, setCampuses] = useState(initialData.campuses);
  const [classes, setClasses] = useState(initialData.classes);
  const [assignments, setAssignments] = useState(initialData.assignments);
  const [gradeAssignments, setGradeAssignments] = useState(
    initialData.gradeAssignments,
  );
  const [schedule, setSchedule] = useState(initialData.schedule);
  const [assignFilter, setAssignFilter] = useState({
    gradeId: "",
    classId: "",
  });
  const [focusClassId, setFocusClassId] = useState(null);
  const [checkResult, setCheckResult] = useState(null);
  const [toast, setToast] = useState("");

  const shareUrl = `${window.location.origin}/tkb/${timetableId}`;
  const [saving, setSaving] = useState(false);

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
          tietLienTiep: Math.max(1, Number(a.tietLienTiep) || 1),
          pinnedSlot: i < fixed.length ? fixed[i] : null,
        });
      }
    });
    return out;
  }, [assignments, subjects, teachers]);

  const lessonById = useMemo(() => {
    const m = {};
    lessons.forEach((l) => {
      m[l.id] = l;
    });
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

  /* ---- xuất Excel ---- */
  function doExport() {
    return exportTimetableToExcel({
      config,
      classes,
      teachers,
      lessonById,
      effectiveSchedule,
    });
  }
  function doExportPerClass() {
    return exportPerClassExcel({
      config,
      classes,
      lessonById,
      effectiveSchedule,
    });
  }
  function doExportPerTeacher() {
    return exportPerTeacherExcel({
      config,
      classes,
      teachers,
      lessonById,
      effectiveSchedule,
    });
  }

  async function exportFromSidebar() {
    if (classes.length === 0) {
      notify("Chưa có lớp học nào để xuất.");
      return;
    }
    try {
      const name = await doExport();
      notify(`Đã xuất file ${name}.`);
    } catch (err) {
      notify(
        "Không xuất được file Excel: " + (err?.message || "lỗi không xác định"),
      );
    }
  }

  /* ---- kiểm tra dữ liệu ---- */
  function runCheck() {
    const errors = [];
    if (subjects.length === 0) errors.push("Bước 2: chưa có môn học nào.");
    if (teachers.length === 0) errors.push("Bước 4: chưa có giáo viên nào.");
    if (classes.length === 0) errors.push("Bước 6: chưa có lớp học nào.");

    const noGrade = classes.filter((c) => !c.gradeId);
    if (noGrade.length)
      errors.push(`Bước 6: ${noGrade.length} lớp chưa chọn khối.`);
    const noDept = teachers.filter((t) => t.departmentIds.length === 0);
    if (noDept.length)
      errors.push(`Bước 4: ${noDept.length} giáo viên chưa thuộc tổ nào.`);

    const slotCount = allSlots(config).length;
    classes.forEach((c) => {
      const total = assignments
        .filter((a) => a.classId === c.id)
        .reduce((s, a) => s + Number(a.soTiet || 0), 0);
      const free = slotCount - (c.offSlots || []).length;
      if (total > free)
        errors.push(
          `Lớp ${c.name}: ${total} tiết vượt quá ${free} ô khả dụng.`,
        );
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
          errors.push(
            `${label}: cố định vào ${slotLabel(slot)} nhưng lớp nghỉ tiết đó.`,
          );
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
        errors.push(
          `${t ? t.short : "GV"} bị cố định 2 lớp cùng lúc tại ${slotLabel(l.pinnedSlot)}.`,
        );
      }
      seen[k] = true;
    });

    if (assignments.length === 0)
      errors.push("Chưa có khung chương trình cho lớp nào.");
    setCheckResult({ errors, at: Date.now() });
  }

  /* ---- lưu lên server ---- */
  async function saveNow() {
    if (saving) return;
    setSaving(true);
    try {
      await onSave({
        config,
        constraints,
        subjects,
        departments,
        teachers,
        grades,
        campuses,
        classes,
        assignments,
        gradeAssignments,
        schedule,
      });
      notify("Đã lưu dữ liệu lên máy chủ.");
    } catch (err) {
      notify("Không lưu được: " + (err?.message || "lỗi không xác định"));
    } finally {
      setSaving(false);
    }
  }

  /* ---- nạp bộ dữ liệu mẫu (tùy chọn, ghi đè dữ liệu hiện có) ---- */
  function loadSeedData() {
    if (
      !window.confirm(
        "Nạp dữ liệu mẫu sẽ thay thế dữ liệu hiện tại trên màn hình. Tiếp tục?",
      )
    )
      return;
    setSubjects(SEED_SUBJECTS);
    setDepartments(SEED_DEPARTMENTS);
    setTeachers(SEED_TEACHERS);
    setGrades(SEED_GRADES);
    setClasses(SEED_CLASSES);
    setCampuses([]);
    setAssignments([]);
    setGradeAssignments([]);
    setSchedule({});
    notify("Đã nạp dữ liệu mẫu. Bấm Lưu dữ liệu để ghi lên máy chủ.");
  }

  function resetData() {
    if (!window.confirm("Xóa toàn bộ dữ liệu của thời khóa biểu này?")) return;
    setSubjects([]);
    setDepartments([]);
    setTeachers([]);
    setGrades([]);
    setCampuses([]);
    setClasses([]);
    setAssignments([]);
    setGradeAssignments([]);
    setSchedule({});
    setCheckResult(null);
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
    const setter =
      frameworkScope.type === "class" ? setAssignments : setGradeAssignments;
    setter((prev) => {
      const mine =
        frameworkScope.type === "class"
          ? prev.filter((a) => a.classId === frameworkScope.id)
          : prev.filter((a) => a.gradeId === frameworkScope.id);
      const others = prev.filter((a) => !mine.includes(a));
      const nextMine = typeof updater === "function" ? updater(mine) : updater;
      return [...others, ...nextMine];
    });
  };

  return (
    <div className="tkb-root">
      <StatusBar stage={stage} onChangeStage={setStage} shareUrl={shareUrl} />

      <div className="layout">
        <Sidebar
          activeStep={view === "steps" ? step : ""}
          onSelect={(k) => {
            setView("steps");
            setStep(k);
          }}
          checkResult={checkResult}
          onCheck={runCheck}
          onViewResult={() => setView("timetable")}
          onExport={exportFromSidebar}
          onSave={saveNow}
          saving={saving}
          onBack={onBack}
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
              onExport={doExport}
              onExportPerClass={doExportPerClass}
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
              schedule={schedule}
              setSchedule={setSchedule}
              notify={notify}
              onClose={() => setView("steps")}
              onNext={nextClass}
              onSaved={saveNow}
            />
          )}

          {view === "steps" && (
            <>
              {step === "config" && (
                <ConfigStep
                  config={config}
                  setConfig={setConfig}
                  onSaved={saveNow}
                  onLoadSeed={loadSeedData}
                  onOpenConstraints={() => setStep("constraints")}
                  onResetData={resetData}
                />
              )}
              {step === "subjects" && (
                <SubjectsStep subjects={subjects} setSubjects={setSubjects} />
              )}
              {step === "departments" && (
                <DepartmentsStep
                  departments={departments}
                  setDepartments={setDepartments}
                  teachers={teachers}
                  onOpenTeachers={() => setStep("teachers")}
                />
              )}
              {step === "teachers" && (
                <TeachersStep
                  teachers={teachers}
                  setTeachers={setTeachers}
                  departments={departments}
                  assignments={assignments}
                />
              )}
              {step === "grades" && (
                <GradesStep
                  grades={grades}
                  setGrades={setGrades}
                  classes={classes}
                  gradeAssignments={gradeAssignments}
                  onOpenFramework={openFramework}
                />
              )}
              {step === "campuses" && (
                <CampusesStep
                  campuses={campuses}
                  setCampuses={setCampuses}
                  classes={classes}
                />
              )}
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
                  onGoToTimetable={() => {
                    setFocusClassId(assignFilter.classId || null);
                    setView("timetable");
                  }}
                  onOpenFramework={openFramework}
                />
              )}
              {step === "constraints" && (
                <ConstraintsStep
                  constraints={constraints}
                  setConstraints={setConstraints}
                />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
