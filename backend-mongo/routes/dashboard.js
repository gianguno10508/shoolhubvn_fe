const express = require("express");
const User = require("../models/User");
const Class = require("../models/Class");
const Assignment = require("../models/Assignment");
const Submission = require("../models/Submission");
const DisciplineRecord = require("../models/DisciplineRecord");
const auth = require("../middleware/auth");
const loadUser = require("../middleware/loadUser");
const requireSchoolVip = require("../middleware/requireSchoolVip");
const { PERMISSIONS: P, ROLES } = require("../config/roles");
const { helpers } = require("./discipline");

const router = express.Router();

const STUDENT_ROLES = [ROLES.STUDENT, ROLES.RED_FLAG];

/* Số liệu cho trang Giáo viên (/giao-vien), theo phạm vi của từng chức danh */
router.get("/", auth, loadUser, requireSchoolVip, async (req, res) => {
  try {
    const user = req.currentUser;
    const school = user.school;
    if (!school) return res.status(400).json({ error: "Tài khoản này không thuộc trường nào." });

    const ownClass = user.role === ROLES.HOMEROOM_TEACHER && user.classId ? user.classId : null;
    const seeSchool = user.hasPermission(P.USERS_VIEW);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const weekAgo = new Date(Date.now() - 7 * 86400e3);

    /* ----- Học sinh ----- */
    const studentFilter = { school: school._id, role: { $in: STUDENT_ROLES } };
    if (ownClass) studentFilter.classId = ownClass._id;
    const [studentCount, newStudents, classCount] = await Promise.all([
      User.countDocuments(studentFilter),
      User.countDocuments({ ...studentFilter, createdAt: { $gte: monthStart } }),
      Class.countDocuments({ school: school._id, deletedAt: null }),
    ]);

    /* ----- Bài tập (của mình; tài khoản trường / BGH: cả trường) ----- */
    const assignmentFilter = { school: school._id, deletedAt: null };
    if (!seeSchool) assignmentFilter.createdBy = user._id;
    const assignments = await Assignment.find(assignmentFilter).select("title classIds dueAt openAt status createdAt");
    const assignmentIds = assignments.map((a) => a._id);
    const activeAssignments = assignments.filter((a) => a.isOpen()).length;
    const [weekSubmissions, recentSubs] = await Promise.all([
      Submission.countDocuments({ assignment: { $in: assignmentIds }, status: "submitted", submittedAt: { $gte: weekAgo } }),
      Submission.find({ assignment: { $in: assignmentIds }, status: "submitted" })
        .sort({ submittedAt: -1 })
        .limit(6)
        .populate("assignment", "title totalPoints"),
    ]);

    /* ----- Thi đua tuần này ----- */
    const config = school.settings.discipline;
    const today = helpers.todayVN();
    const weekStart = helpers.weekStartOf(today, config.weekStartDay);
    const weekRecords = await DisciplineRecord.find({ school: school._id, weekStart });
    const classes = await Class.find({ school: school._id, deletedAt: null }).select("name");
    const scores = classes
      .map((c) => {
        const mine = weekRecords.filter((r) => String(r.classId) === String(c._id));
        return {
          classId: String(c._id),
          className: c.name,
          score: config.basePoints - mine.reduce((n, r) => n + r.totalPenalty - r.totalBonus, 0),
        };
      })
      .sort((a, b) => b.score - a.score);
    let myClass = null;
    if (ownClass) {
      const idx = scores.findIndex((s) => s.classId === String(ownClass._id));
      if (idx >= 0) {
        const penalty = weekRecords
          .filter((r) => String(r.classId) === String(ownClass._id))
          .reduce((n, r) => n + r.totalPenalty, 0);
        const rank = scores.filter((s) => s.score > scores[idx].score).length + 1;
        myClass = { ...scores[idx], rank, totalClasses: scores.length, penalty };
      }
    }
    const recordedToday = weekRecords.filter((r) => r.date === today).length;

    /* ----- Hoạt động gần đây ----- */
    const disciplineFilter = { school: school._id };
    if (ownClass) disciplineFilter.classId = ownClass._id;
    const canSeeDiscipline =
      user.hasPermission(P.DISCIPLINE_VIEW) || user.hasPermission(P.DISCIPLINE_SCORE) || user.hasPermission(P.DISCIPLINE_CONFIG);
    const recentDiscipline = canSeeDiscipline
      ? await DisciplineRecord.find(disciplineFilter).sort({ updatedAt: -1 }).limit(5)
      : [];

    const activities = [
      ...assignments
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 4)
        .map((a) => ({ type: "blue", icon: "📝", title: `Giao bài: ${a.title}`, description: `${a.classIds.length} lớp`, time: a.createdAt })),
      ...recentSubs.map((s) => ({
        type: "green",
        icon: "✅",
        title: `${s.studentName || s.studentUsername} nộp bài`,
        description: `${s.assignment ? s.assignment.title : "Bài tập"} · ${s.score}/${s.assignment ? s.assignment.totalPoints : "?"} điểm`,
        time: s.submittedAt,
      })),
      ...recentDiscipline.map((r) => ({
        type: "orange",
        icon: "🏆",
        title: `Chấm thi đua lớp ${r.className}`,
        description: `Ngày ${r.date.split("-").reverse().join("/")} · ${r.totalPenalty ? `trừ ${r.totalPenalty} điểm` : "không vi phạm"}${r.totalBonus ? ` · cộng ${r.totalBonus}` : ""}`,
        time: r.updatedAt,
      })),
    ]
      .sort((a, b) => new Date(b.time) - new Date(a.time))
      .slice(0, 8);

    res.json({
      school: { name: school.name, academicYear: school.academicYear, isVip: school.isVipActive() },
      user: { name: user.name, role: user.role, className: user.classId ? user.classId.name : "" },
      students: { count: studentCount, newThisMonth: newStudents, scope: ownClass ? "class" : "school" },
      classes: { count: classCount },
      assignments: { total: assignments.length, active: activeAssignments, submissionsThisWeek: weekSubmissions, scope: seeSchool ? "school" : "mine" },
      discipline: { weekStart, basePoints: config.basePoints, recordedToday, classesTracked: classes.length, myClass },
      activities,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi máy chủ khi tải trang tổng quan." });
  }
});

module.exports = router;
