const express = require("express");
const Assignment = require("../models/Assignment");
const Submission = require("../models/Submission");
const Class = require("../models/Class");
const User = require("../models/User");
const auth = require("../middleware/auth");
const loadUser = require("../middleware/loadUser");
const requirePermission = require("../middleware/requirePermission");
const requireSchoolVip = require("../middleware/requireSchoolVip");
const { PERMISSIONS: P, ROLES } = require("../config/roles");

const router = express.Router();

const LETTERS = ["A", "B", "C", "D"];
const GRACE_MS = 15 * 1000; // bù độ trễ mạng khi hết giờ

router.use(auth, loadUser, (req, res, next) => {
  const school = req.currentUser.school;
  if (!school) return res.status(400).json({ error: "Tài khoản này không thuộc trường nào." });
  if (school.modules && school.modules.assignments === false) {
    return res.status(403).json({ error: "Trường chưa bật mục Bài tập & Tự chấm." });
  }
  req.school = school;
  next();
});

// Trường chưa có / hết hạn VIP: khóa toàn bộ chức năng (admin hệ thống luôn qua)
router.use(requireSchoolVip);

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

function fail(res, err, fallback) {
  if (err.status) return res.status(err.status).json({ error: err.message });
  if (err.name === "CastError" || err.name === "BSONError") {
    return res.status(400).json({ error: "Mã không hợp lệ." });
  }
  if (err.name === "ValidationError") return res.status(400).json({ error: err.message });
  console.error(err);
  return res.status(500).json({ error: fallback });
}

function shuffle(array) {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const round2 = (n) => Math.round(n * 100) / 100;

/* =========================================
   CHẤM BÀI
========================================= */

function grade(submission, assignment, { auto = false } = {}) {
  const byNumber = new Map(submission.answers.map((a) => [a.questionNumber, a.answer]));
  const correct = assignment.questions.filter((q) => byNumber.get(q.number) === q.correctAnswer).length;
  const total = assignment.questions.length;
  submission.correctCount = correct;
  submission.totalQuestions = total;
  submission.score = round2((correct / total) * assignment.totalPoints);
  submission.status = "submitted";
  submission.autoSubmitted = auto;
  submission.submittedAt = auto ? submission.expiresAt : new Date();
}

/** Bài đang làm mà đã quá giờ: tự nộp với các đáp án đã lưu */
async function finalizeIfExpired(submission, assignment) {
  if (submission.status === "in_progress" && Date.now() > submission.expiresAt.getTime() + GRACE_MS) {
    grade(submission, assignment, { auto: true });
    await submission.save();
  }
  return submission;
}

async function finalizeExpiredOf(assignment) {
  const stale = await Submission.find({
    assignment: assignment._id,
    status: "in_progress",
    expiresAt: { $lt: new Date(Date.now() - GRACE_MS) },
  });
  for (const s of stale) {
    grade(s, assignment, { auto: true });
    await s.save();
  }
}

/** Đề theo thứ tự riêng của học sinh, không kèm đáp án.
 * Mỗi phương án có `key` = chữ cái gốc (dùng khi nộp) và `letter` = chữ cái hiển thị. */
function buildPaper(assignment, submission) {
  const byNumber = new Map(assignment.questions.map((q) => [q.number, q]));
  return submission.questionOrder.map((number, index) => {
    const q = byNumber.get(number);
    const order = submission.optionOrder.get(String(number)) || q.options.map((o) => o.letter);
    const options = order.map((key, i) => ({
      key,
      letter: LETTERS[i],
      text: (q.options.find((o) => o.letter === key) || {}).text || "",
    }));
    return { number, displayNumber: index + 1, text: q.text, options };
  });
}

function reviewOf(assignment, submission) {
  const chosen = new Map(submission.answers.map((a) => [a.questionNumber, a.answer]));
  return buildPaper(assignment, submission).map((q) => {
    const correctKey = assignment.questions.find((x) => x.number === q.number).correctAnswer;
    return { ...q, chosen: chosen.get(q.number) || null, correct: correctKey };
  });
}

/* =========================================
   QUYỀN TRUY CẬP 1 BÀI TẬP (phía giáo viên)
========================================= */

const canSeeAll = (user) => user.hasPermission(P.USERS_VIEW); // tài khoản trường, BGH
const canEditAny = (user) => user.hasPermission(P.USERS_MANAGE); // tài khoản trường

async function loadManagedAssignment(req, { edit = false } = {}) {
  const a = await Assignment.findOne({ _id: req.params.id, school: req.school._id, deletedAt: null });
  const user = req.currentUser;
  const mine = a && String(a.createdBy) === String(user._id);
  if (!a || !(mine || canSeeAll(user))) throw httpError(404, "Không tìm thấy bài tập.");
  if (edit && !(mine || canEditAny(user))) throw httpError(403, "Chỉ người giao bài mới được sửa bài này.");
  return a;
}

/* =========================================
   KIỂM TRA DỮ LIỆU KHI TẠO / SỬA
========================================= */

function cleanQuestions(raw) {
  if (!Array.isArray(raw) || raw.length === 0) throw httpError(400, "Chưa có câu hỏi nào.");
  if (raw.length > 200) throw httpError(400, "Tối đa 200 câu hỏi mỗi bài.");
  return raw.map((q, i) => {
    const options = (q.options || []).slice(0, 4).map((o, j) => ({
      letter: LETTERS[j],
      text: String(o.text || "").trim(),
    }));
    if (options.length !== 4) throw httpError(400, `Câu ${i + 1} cần đủ 4 phương án.`);
    if (!LETTERS.includes(q.correctAnswer)) throw httpError(400, `Câu ${i + 1} chưa có đáp án đúng.`);
    if (!String(q.text || "").trim()) throw httpError(400, `Câu ${i + 1} chưa có nội dung.`);
    return { number: i + 1, text: String(q.text).trim(), options, correctAnswer: q.correctAnswer };
  });
}

async function cleanClassIds(raw, schoolId) {
  const ids = [...new Set((raw || []).map(String))];
  if (!ids.length) throw httpError(400, "Vui lòng chọn ít nhất 1 lớp được giao bài.");
  const found = await Class.countDocuments({ _id: { $in: ids }, school: schoolId, deletedAt: null });
  if (found !== ids.length) throw httpError(400, "Có lớp không thuộc trường của bạn.");
  return ids;
}

const CONFIG_FIELDS = [
  "title",
  "description",
  "totalPoints",
  "durationMinutes",
  "openAt",
  "dueAt",
  "maxAttempts",
  "shuffleQuestions",
  "shuffleOptions",
  "showAnswers",
];

function pickConfig(body) {
  const out = {};
  for (const f of CONFIG_FIELDS) if (body[f] !== undefined && body[f] !== "") out[f] = body[f];
  return out;
}

/** Danh sách học sinh (kể cả cờ đỏ) thuộc các lớp được giao */
function targetStudents(assignment) {
  return User.find({
    school: assignment.school,
    classId: { $in: assignment.classIds },
    role: { $in: [ROLES.STUDENT, ROLES.RED_FLAG] },
  })
    .populate("classId")
    .sort({ name: 1 });
}

/* =========================================
   PHÍA HỌC SINH
========================================= */

const submit = requirePermission(P.ASSIGNMENT_SUBMIT);

// Danh sách bài được giao cho lớp mình + trạng thái của mình
router.get("/my", submit, async (req, res) => {
  try {
    const user = req.currentUser;
    if (!user.classId) return res.json([]);
    const list = await Assignment.find({
      school: req.school._id,
      classIds: user.classId._id,
      deletedAt: null,
      openAt: { $lte: new Date() },
    }).sort({ dueAt: 1 });

    const subs = await Submission.find({ student: user._id, assignment: { $in: list.map((a) => a._id) } });
    const result = [];
    for (const a of list) {
      const mine = subs.filter((s) => String(s.assignment) === String(a._id));
      for (const s of mine) await finalizeIfExpired(s, a);
      const done = mine.filter((s) => s.status === "submitted");
      const best = done.reduce((b, s) => (!b || s.score > b.score ? s : b), null);
      const inProgress = mine.find((s) => s.status === "in_progress");
      result.push({
        ...a.toSummaryJSON(),
        attemptsUsed: mine.length,
        bestScore: best ? best.score : null,
        lastSubmissionId: best ? best._id : null,
        inProgressId: inProgress ? inProgress._id : null,
        canStart: a.isOpen() && (!!inProgress || mine.length < a.maxAttempts),
      });
    }
    res.json(result);
  } catch (err) {
    fail(res, err, "Lỗi máy chủ khi lấy danh sách bài tập.");
  }
});

// Bắt đầu làm (hoặc làm tiếp lượt đang dở)
router.post("/:id/start", submit, async (req, res) => {
  try {
    const user = req.currentUser;
    const a = await Assignment.findOne({ _id: req.params.id, school: req.school._id, deletedAt: null });
    if (!a || !user.classId || !a.classIds.some((c) => String(c) === String(user.classId._id))) {
      throw httpError(404, "Không tìm thấy bài tập.");
    }

    const mine = await Submission.find({ assignment: a._id, student: user._id }).sort({ attempt: 1 });
    for (const s of mine) await finalizeIfExpired(s, a);
    let sub = mine.find((s) => s.status === "in_progress");

    if (!sub) {
      if (!a.isOpen()) {
        const reason =
          a.status === "closed" ? "Bài tập đã đóng." : a.dueAt < new Date() ? "Đã quá hạn nộp bài." : "Bài tập chưa mở.";
        throw httpError(403, reason);
      }
      if (mine.length >= a.maxAttempts) throw httpError(403, "Bạn đã dùng hết số lượt làm bài.");

      const numbers = a.questions.map((q) => q.number);
      const optionOrder = {};
      for (const q of a.questions) {
        const keys = q.options.map((o) => o.letter);
        optionOrder[q.number] = a.shuffleOptions ? shuffle(keys) : keys;
      }
      const now = Date.now();
      const doc = {
        assignment: a._id,
        school: req.school._id,
        student: user._id,
        attempt: mine.length + 1,
        studentName: user.name,
        studentUsername: user.username,
        studentCode: user.studentCode,
        classId: user.classId._id,
        className: user.classId.name,
        questionOrder: a.shuffleQuestions ? shuffle(numbers) : numbers,
        optionOrder,
        startedAt: new Date(now),
        expiresAt: new Date(Math.min(now + a.durationMinutes * 60 * 1000, a.dueAt.getTime())),
        totalQuestions: a.questions.length,
      };
      try {
        sub = await Submission.create(doc);
      } catch (err) {
        // Hai request "bắt đầu" cùng lúc (bấm đúp, 2 tab): dùng lại lượt vừa được tạo
        if (err.code !== 11000) throw err;
        sub = await Submission.findOne({ assignment: a._id, student: user._id, attempt: doc.attempt });
      }
    }

    res.json({
      assignment: a.toSummaryJSON(),
      submission: sub.toResultJSON(),
      answers: sub.answers,
      questions: buildPaper(a, sub),
      serverTime: new Date(),
    });
  } catch (err) {
    fail(res, err, "Lỗi máy chủ khi bắt đầu làm bài.");
  }
});

async function loadOwnSubmission(req) {
  const sub = await Submission.findOne({ _id: req.params.sid, student: req.currentUser._id });
  if (!sub) throw httpError(404, "Không tìm thấy bài làm.");
  const a = await Assignment.findById(sub.assignment);
  if (!a) throw httpError(404, "Bài tập không còn tồn tại.");
  await finalizeIfExpired(sub, a);
  return { sub, a };
}

function cleanAnswers(raw, assignment) {
  const valid = new Set(assignment.questions.map((q) => q.number));
  const map = new Map();
  for (const x of Array.isArray(raw) ? raw : []) {
    const n = Number(x.questionNumber);
    if (valid.has(n) && LETTERS.includes(x.answer)) map.set(n, x.answer);
  }
  return [...map].map(([questionNumber, answer]) => ({ questionNumber, answer }));
}

// Lưu nháp đáp án (tự lưu khi học sinh chọn)
router.put("/submissions/:sid/answers", submit, async (req, res) => {
  try {
    const { sub, a } = await loadOwnSubmission(req);
    if (sub.status !== "in_progress") throw httpError(409, "Bài đã được nộp.");
    sub.answers = cleanAnswers(req.body.answers, a);
    await sub.save();
    res.json({ ok: true, savedAt: new Date() });
  } catch (err) {
    fail(res, err, "Lỗi máy chủ khi lưu bài.");
  }
});

router.post("/submissions/:sid/submit", submit, async (req, res) => {
  try {
    const { sub, a } = await loadOwnSubmission(req);
    if (sub.status === "in_progress") {
      if (req.body.answers) sub.answers = cleanAnswers(req.body.answers, a);
      grade(sub, a);
      await sub.save();
    }
    res.json({
      submission: sub.toResultJSON(),
      review: a.showAnswers ? reviewOf(a, sub) : null,
    });
  } catch (err) {
    fail(res, err, "Lỗi máy chủ khi nộp bài.");
  }
});

router.get("/submissions/:sid", submit, async (req, res) => {
  try {
    const { sub, a } = await loadOwnSubmission(req);
    res.json({
      assignment: a.toSummaryJSON(),
      submission: sub.toResultJSON(),
      review: sub.status === "submitted" && a.showAnswers ? reviewOf(a, sub) : null,
    });
  } catch (err) {
    fail(res, err, "Lỗi máy chủ khi tải kết quả.");
  }
});

/* =========================================
   PHÍA NGƯỜI GIAO BÀI
========================================= */

const manage = requirePermission(P.ASSIGNMENT_MANAGE);

router.get("/", manage, async (req, res) => {
  try {
    const user = req.currentUser;
    const filter = { school: req.school._id, deletedAt: null };
    if (!(canSeeAll(user) && req.query.scope === "all")) filter.createdBy = user._id;

    const list = await Assignment.find(filter).sort({ createdAt: -1 }).populate("createdBy", "name username");
    const ids = list.map((a) => a._id);
    const [submitted, classes, studentCounts] = await Promise.all([
      Submission.aggregate([
        { $match: { assignment: { $in: ids }, status: "submitted" } },
        { $group: { _id: "$assignment", students: { $addToSet: "$student" }, avg: { $avg: "$score" } } },
      ]),
      Class.find({ school: req.school._id }).select("name"),
      User.aggregate([
        { $match: { school: req.school._id, role: { $in: [ROLES.STUDENT, ROLES.RED_FLAG] }, classId: { $ne: null } } },
        { $group: { _id: "$classId", n: { $sum: 1 } } },
      ]),
    ]);
    const subBy = new Map(submitted.map((s) => [String(s._id), s]));
    const classBy = new Map(classes.map((c) => [String(c._id), c.name]));
    const countBy = new Map(studentCounts.map((c) => [String(c._id), c.n]));

    res.json(
      list.map((a) => {
        const s = subBy.get(String(a._id));
        return {
          ...a.toSummaryJSON(),
          createdBy: a.createdBy ? { id: a.createdBy._id, name: a.createdBy.name, username: a.createdBy.username } : null,
          classNames: a.classIds.map((c) => classBy.get(String(c))).filter(Boolean),
          studentCount: a.classIds.reduce((n, c) => n + (countBy.get(String(c)) || 0), 0),
          submittedCount: s ? s.students.length : 0,
          averageScore: s ? round2(s.avg) : null,
        };
      }),
    );
  } catch (err) {
    fail(res, err, "Lỗi máy chủ khi lấy danh sách bài tập.");
  }
});

router.post("/", manage, requireSchoolVip, async (req, res) => {
  try {
    const config = pickConfig(req.body);
    if (!(config.title || "").trim()) throw httpError(400, "Vui lòng nhập tên bài.");
    if (!config.dueAt || new Date(config.dueAt) <= new Date()) throw httpError(400, "Hạn nộp phải ở tương lai.");
    const a = await Assignment.create({
      ...config,
      school: req.school._id,
      createdBy: req.currentUser._id,
      sourceFileName: req.body.sourceFileName || "",
      questions: cleanQuestions(req.body.questions),
      classIds: await cleanClassIds(req.body.classIds, req.school._id),
    });
    res.json(a.toSummaryJSON());
  } catch (err) {
    fail(res, err, "Lỗi máy chủ khi giao bài.");
  }
});

router.get("/:id", manage, async (req, res) => {
  try {
    const a = await loadManagedAssignment(req);
    const classes = await Class.find({ _id: { $in: a.classIds } }).select("name");
    res.json({
      ...a.toSummaryJSON(),
      classes: classes.map((c) => ({ id: c._id, name: c.name })),
      questions: a.questions,
      hasSubmissions: (await Submission.countDocuments({ assignment: a._id })) > 0,
    });
  } catch (err) {
    fail(res, err, "Lỗi máy chủ khi tải bài tập.");
  }
});

router.patch("/:id", manage, requireSchoolVip, async (req, res) => {
  try {
    const a = await loadManagedAssignment(req, { edit: true });
    Object.assign(a, pickConfig(req.body));
    if (req.body.status && ["published", "closed"].includes(req.body.status)) a.status = req.body.status;
    if (req.body.classIds) a.classIds = await cleanClassIds(req.body.classIds, req.school._id);
    if (req.body.questions) {
      if (await Submission.exists({ assignment: a._id })) {
        throw httpError(409, "Đã có học sinh làm bài, không thể đổi câu hỏi.");
      }
      a.questions = cleanQuestions(req.body.questions);
    }
    await a.save();
    res.json(a.toSummaryJSON());
  } catch (err) {
    fail(res, err, "Lỗi máy chủ khi cập nhật bài tập.");
  }
});

router.delete("/:id", manage, async (req, res) => {
  try {
    const a = await loadManagedAssignment(req, { edit: true });
    a.deletedAt = new Date();
    await a.save();
    res.json({ ok: true });
  } catch (err) {
    fail(res, err, "Lỗi máy chủ khi xóa bài tập.");
  }
});

// Kết quả: mỗi học sinh 1 dòng (lượt điểm cao nhất), kèm học sinh chưa làm
router.get("/:id/submissions", manage, async (req, res) => {
  try {
    const a = await loadManagedAssignment(req);
    await finalizeExpiredOf(a);
    const [subs, students] = await Promise.all([
      Submission.find({ assignment: a._id }).sort({ attempt: 1 }),
      targetStudents(a),
    ]);

    const byStudent = new Map();
    for (const s of subs) {
      const key = String(s.student);
      if (!byStudent.has(key)) byStudent.set(key, []);
      byStudent.get(key).push(s);
    }

    const rows = students.map((u) => {
      const mine = byStudent.get(String(u._id)) || [];
      byStudent.delete(String(u._id));
      const done = mine.filter((s) => s.status === "submitted");
      const best = done.reduce((b, s) => (!b || s.score > b.score ? s : b), null);
      const doing = mine.find((s) => s.status === "in_progress");
      return {
        studentId: u._id,
        studentName: u.name,
        studentUsername: u.username,
        studentCode: u.studentCode,
        className: u.classId ? u.classId.name : "",
        attempts: mine.length,
        status: best ? "submitted" : doing ? "in_progress" : "not_started",
        best: best ? best.toResultJSON() : null,
      };
    });
    // Học sinh đã làm nhưng nay không còn trong lớp (chuyển lớp / xóa tài khoản)
    for (const mine of byStudent.values()) {
      const best = mine.filter((s) => s.status === "submitted").sort((x, y) => y.score - x.score)[0];
      const s = best || mine[0];
      rows.push({
        studentId: s.student,
        studentName: s.studentName,
        studentUsername: s.studentUsername,
        studentCode: s.studentCode,
        className: s.className,
        attempts: mine.length,
        status: best ? "submitted" : "in_progress",
        best: best ? best.toResultJSON() : null,
        leftClass: true,
      });
    }

    const scores = rows.filter((r) => r.best).map((r) => r.best.score);
    res.json({
      assignment: a.toSummaryJSON(),
      stats: {
        students: rows.length,
        submitted: scores.length,
        average: scores.length ? round2(scores.reduce((x, y) => x + y, 0) / scores.length) : null,
        highest: scores.length ? Math.max(...scores) : null,
        lowest: scores.length ? Math.min(...scores) : null,
      },
      rows,
    });
  } catch (err) {
    fail(res, err, "Lỗi máy chủ khi tải kết quả.");
  }
});

module.exports = router;
