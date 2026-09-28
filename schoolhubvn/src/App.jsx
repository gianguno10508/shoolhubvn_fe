import { useMemo, useState } from "react";
import {
  exportTimetableToExcel,
  exportPerClassExcel,
  exportPerTeacherExcel,
} from "./excelExport";

import { allSlots, slotLabel } from "./utils/timeHelpers";
import {
  DEFAULT_CONFIG,
  DEFAULT_CONSTRAINTS,
} from "./constants/appConstants";
import {
  SEED_SUBJECTS,
  SEED_DEPARTMENTS,
  SEED_TEACHERS,
  SEED_GRADES,
  SEED_CLASSES,
} from "./data/seedData";
import { STYLES } from "./styles/appStyles";

import { StatusBar } from "./components/StatusBar";
import { Sidebar } from "./components/Sidebar";
import { ConfigStep } from "./components/steps/ConfigStep";
import { SubjectsStep } from "./components/steps/SubjectsStep";
import { DepartmentsStep } from "./components/steps/DepartmentsStep";
import { TeachersStep } from "./components/steps/TeachersStep";
import { GradesStep } from "./components/steps/GradesStep";
import { CampusesStep } from "./components/steps/CampusesStep";
import { ClassesStep } from "./components/steps/ClassesStep";
import { AssignmentsStep } from "./components/steps/AssignmentsStep";
import { ConstraintsStep } from "./components/steps/ConstraintsStep";
import { FrameworkView } from "./components/framework/FrameworkView";
import { TimetableView } from "./components/timetable/TimetableView";

/* =================================================================
 * App.jsx chỉ còn nhiệm vụ:
 *   1. Giữ toàn bộ state (dữ liệu dùng chung giữa các bước).
 *   2. Tính toán các dữ liệu phái sinh (lessons, pinned, effectiveSchedule).
 *   3. Ghép các component con lại với nhau qua STEP_COMPONENTS.
 *
 * ---- Cách thêm 1 bước (step) mới trong tương lai ----
 *   1. Thêm { key: "myStep", label: "..." } vào NAV_GROUPS
 *      (constants/appConstants.js).
 *   2. Tạo component src/components/steps/MyStepStep.jsx theo khuôn các
 *      step hiện có (nhận props cần thiết, có <PanelTitle />...).
 *   3. Import component đó vào đây, thêm vào STEP_COMPONENTS bên dưới
 *      với key trùng với bước 1, và thêm props cho nó trong stepProps().
 *   Không cần sửa Sidebar hay phần render chính.
 * ================================================================= */

const STEP_COMPONENTS = {
  config: ConfigStep,
  subjects: SubjectsStep,
  departments: DepartmentsStep,
  teachers: TeachersStep,
  grades: GradesStep,
  campuses: CampusesStep,
  classes: ClassesStep,
  assignments: AssignmentsStep,
  constraints: ConstraintsStep,
};

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
  const [assignFilter, setAssignFilter] = useState({
    gradeId: "",
    classId: "",
  });
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
  // Sẵn có cho tính năng tương lai (export theo giáo viên), chưa gắn nút riêng.
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

  /* Props cho từng bước — thêm bước mới thì thêm 1 case ở đây. */
  const stepPropsByKey = {
    config: {
      config,
      setConfig,
      onSaved: () => notify("Đã lưu cài đặt."),
      onOpenConstraints: () => setStep("constraints"),
      onResetData: resetData,
    },
    subjects: { subjects, setSubjects },
    departments: {
      departments,
      setDepartments,
      teachers,
      onOpenTeachers: () => setStep("teachers"),
    },
    teachers: { teachers, setTeachers, departments, assignments },
    grades: {
      grades,
      setGrades,
      classes,
      gradeAssignments,
      onOpenFramework: openFramework,
    },
    campuses: { campuses, setCampuses, classes },
    classes: {
      classes,
      setClasses,
      grades,
      campuses,
      assignments,
      config,
      onOpenFramework: openFramework,
    },
    assignments: {
      assignments,
      setAssignments,
      classes,
      subjects,
      teachers,
      grades,
      filter: assignFilter,
      setFilter: setAssignFilter,
      onGoToTimetable: () => {
        setFocusClassId(assignFilter.classId || null);
        setView("timetable");
      },
      onOpenFramework: openFramework,
    },
    constraints: { constraints, setConstraints },
  };

  const ActiveStepComponent = STEP_COMPONENTS[step];

  return (
    <div className="tkb-root">
      <style>{STYLES}</style>

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
              onSaved={() => notify("Đã lưu khung chương trình.")}
            />
          )}

          {view === "steps" && ActiveStepComponent && (
            <ActiveStepComponent {...stepPropsByKey[step]} />
          )}
        </main>
      </div>
    </div>
  );
}
