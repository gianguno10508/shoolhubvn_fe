const express = require("express");
const Timetable = require("../models/Timetable");
const auth = require("../middleware/auth");
const loadUser = require("../middleware/loadUser");
const requirePermission = require("../middleware/requirePermission");
const requireSchoolVip = require("../middleware/requireSchoolVip");
const { PERMISSIONS: P, ROLES } = require("../config/roles");

/* Thời khóa biểu của tôi (app di động): lấy TKB nhà trường đang áp dụng,
 *  - giáo viên / GVCN: lịch dạy của mình (khớp họ tên tài khoản với tên giáo viên trong TKB, hoặc tự chọn)
 *  - học sinh / cờ đỏ: TKB lớp mình (khớp tên lớp)
 *  - tài khoản trường, BGH, Đoàn TN: chọn xem theo lớp (?classId) hoặc theo giáo viên (?teacherId)
 * Mỗi tiết kèm giờ học (cài ở web: Thông tin chung → Giờ học). */

const router = express.Router();

router.use(auth, loadUser, (req, res, next) => {
  if (!req.currentUser.school) return res.status(400).json({ error: "Tài khoản này không thuộc trường nào." });
  next();
});
router.use(requireSchoolVip, requirePermission(P.TIMETABLE_VIEW));

const DAY_LABELS = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ Nhật"];
const clamp = (v, min, max, def) => Math.min(Math.max(Number(v) || def, min), max);
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Giờ mặc định (giống frontend/src/utils/periodTimes.js): sáng từ 07:15, chiều từ 13:30, tiết 45', nghỉ 5', ra chơi 15' sau tiết 2 */
function defaultTimes(session, count) {
  let t = session === "Chiều" ? 13 * 60 + 30 : 7 * 60 + 15;
  const fmt = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push({ start: fmt(t), end: fmt(t + 45) });
    t += 45 + (i === 1 ? 15 : 5);
  }
  return out;
}

function periodTimes(config, sessions, count) {
  const saved = config.periodTimes || {};
  const out = {};
  for (const s of sessions) {
    const def = defaultTimes(s, count);
    out[s] = def.map((d, i) => {
      const x = (saved[s] || [])[i] || {};
      return TIME_RE.test(x.start || "") && TIME_RE.test(x.end || "") ? { start: x.start, end: x.end } : d;
    });
  }
  return out;
}
const norm = (s) =>
  String(s || "")
    .normalize("NFC")
    .toLocaleLowerCase("vi")
    .replace(/\s+/g, " ")
    .trim();

/** Ô đã xếp thực tế: tiết cố định trong khung CT + các ô xếp (tay / tự động) còn hợp lệ — giống TimetableApp.jsx */
function effectiveSchedule(data) {
  const assignments = data.assignments || [];
  const lessons = new Map();
  const pinned = {};
  for (const a of assignments) {
    const n = Math.max(1, Number(a.soTiet) || 1);
    const fixed = a.fixed || [];
    for (let i = 0; i < n; i++) {
      const id = `${a.id}#${i}`;
      lessons.set(id, a);
      if (i < fixed.length && fixed[i]) pinned[`${fixed[i]}|${a.classId}`] = id;
    }
  }
  const pinnedIds = new Set(Object.values(pinned));
  const out = {};
  for (const [key, id] of Object.entries(data.schedule || {})) {
    if (pinned[key] || pinnedIds.has(id) || !lessons.has(id)) continue;
    out[key] = id;
  }
  Object.assign(out, pinned);
  return { cells: out, lessons };
}

router.get("/", async (req, res) => {
  try {
    const user = req.currentUser;
    const doc = await Timetable.findOne({ school: user.school._id, published: true, deletedAt: null });
    if (!doc) {
      return res.json({ published: false, timetable: null, kind: null, target: null, canBrowse: false, options: [], classOptions: [], times: {}, days: [], sessions: [], periods: [], cells: [] });
    }

    const data = doc.data || {};
    const config = data.config || {};
    const days = DAY_LABELS.slice(0, clamp(config.soNgay, 1, 7, 6));
    const sessions = Number(config.soBuoi) === 2 ? ["Sáng", "Chiều"] : ["Cả ngày"];
    const periods = Array.from({ length: clamp(config.soTiet, 1, 10, 5) }, (_, i) => i + 1);

    const subjects = new Map((data.subjects || []).map((s) => [s.id, s]));
    const teachers = data.teachers || [];
    const teacherById = new Map(teachers.map((t) => [t.id, t]));
    const classes = data.classes || [];
    const classById = new Map(classes.map((c) => [c.id, c]));

    const isLearner = [ROLES.STUDENT, ROLES.RED_FLAG].includes(user.role);
    const isTeacher = [ROLES.TEACHER, ROLES.HOMEROOM_TEACHER].includes(user.role);
    const canBrowse = !isLearner && !isTeacher; // tài khoản trường, BGH, Đoàn TN
    const options = teachers
      .map((t) => ({ id: t.id, name: t.fullName || t.short || "?" }))
      .sort((a, b) => a.name.localeCompare(b.name, "vi"));
    const classOptions = classes
      .map((c) => ({ id: c.id, name: c.name }))
      .sort((a, b) => a.name.localeCompare(b.name, "vi", { numeric: true }));

    let kind = isLearner ? "class" : "teacher";
    let target = null;
    if (canBrowse && req.query.classId) kind = "class";

    if (kind === "class") {
      const wanted = canBrowse ? classById.get(String(req.query.classId)) : null;
      const myClass = user.classId ? norm(user.classId.name).replace(/\s/g, "") : "";
      const found = wanted || classes.find((c) => norm(c.name).replace(/\s/g, "") === myClass);
      if (found) target = { id: found.id, name: found.name };
    } else {
      const chosen = req.query.teacherId && teacherById.get(String(req.query.teacherId));
      const found = chosen || (isTeacher && teachers.find((t) => norm(t.fullName) && norm(t.fullName) === norm(user.name)));
      if (found) target = { id: found.id, name: found.fullName || found.short };
    }
    const times = periodTimes(config, sessions, periods.length);

    const cells = [];
    if (target) {
      const { cells: placed, lessons } = effectiveSchedule(data);
      for (const [key, lessonId] of Object.entries(placed)) {
        const [day, session, period, classId] = key.split("|");
        const a = lessons.get(lessonId);
        if (kind === "class" ? classId !== target.id : a.teacherId !== target.id) continue;
        const subject = subjects.get(a.subjectId);
        const teacher = teacherById.get(a.teacherId);
        const time = (times[session] || [])[Number(period) - 1] || {};
        cells.push({
          day,
          session,
          period: Number(period),
          start: time.start || "",
          end: time.end || "",
          subject: subject ? subject.name : "",
          teacher: teacher ? teacher.fullName || teacher.short : "",
          className: classById.get(classId)?.name || "",
        });
      }
      const order = (c) => days.indexOf(c.day) * 100 + sessions.indexOf(c.session) * 20 + c.period;
      cells.sort((x, y) => order(x) - order(y));
    }

    res.json({
      published: true,
      timetable: { id: doc._id, name: doc.name, updatedAt: doc.updatedAt },
      kind,
      target,
      canBrowse,
      options,
      classOptions: canBrowse ? classOptions : [],
      times,
      days,
      sessions,
      periods,
      cells,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi máy chủ khi tải thời khóa biểu." });
  }
});

module.exports = router;
