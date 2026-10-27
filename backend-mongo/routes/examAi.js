const express = require("express");
const AiExam = require("../models/AiExam");
const AiUsage = require("../models/AiUsage");
const ExamCurriculum = require("../models/ExamCurriculum");
const auth = require("../middleware/auth");
const loadUser = require("../middleware/loadUser");
const requirePermission = require("../middleware/requirePermission");
const requireSchoolVip = require("../middleware/requireSchoolVip");
const { PERMISSIONS: P } = require("../config/roles");
const { LEVELS, CURRICULUM_SYSTEM, buildCurriculumPrompt, EXAM_SYSTEM, buildExamPrompt } = require("../config/examPrompt");
const { examCounts } = require("../utils/examCounts");
const { generateFromImages } = require("../utils/gemini");

/* Tạo đề với AI (trong Trộn đề kiểm tra): chọn khối / môn / bộ sách → chọn bài → cấu hình tỉ lệ, cấu trúc
 * → Gemini soạn bản đặc tả + đề + đáp án; ma trận tính từ câu hỏi. */

const router = express.Router();

const DAILY_LIMIT = Number(process.env.EXAM_AI_DAILY_LIMIT) || 3; // đề / tài khoản / ngày
const CURRICULUM_DAILY_LIMIT = Number(process.env.EXAM_CURRICULUM_DAILY_LIMIT) || 10; // lần AI liệt kê mục lục / tài khoản / ngày
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const LEVEL_KEYS = ["nb", "th", "vd", "vdc"];
const LETTERS = ["A", "B", "C", "D"];
const GRADE_RANGE = { primary: [1, 5], lower_secondary: [6, 9], upper_secondary: [10, 12], gdtx: [6, 12] };

router.use(auth, loadUser, (req, res, next) => {
  const school = req.currentUser.school;
  if (!school) return res.status(400).json({ error: "Tài khoản này không thuộc trường nào." });
  req.school = school;
  next();
});
router.use(requireSchoolVip);
router.use(requirePermission(P.EXAM_MANAGE));

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

function fail(res, err, fallback) {
  if (err.status) return res.status(err.status).json({ error: err.message });
  if (err.name === "CastError" || err.name === "BSONError") return res.status(400).json({ error: "Mã không hợp lệ." });
  if (err.name === "ValidationError") return res.status(400).json({ error: err.message });
  console.error(err);
  return res.status(500).json({ error: fallback });
}

const str = (v, max) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const multiline = (v, max) => (typeof v === "string" ? v.replace(/\r/g, "").trim().slice(0, max) : "");

function startOfTodayVN() {
  const now = Date.now() + VN_OFFSET_MS;
  return new Date(now - (now % 86400000) - VN_OFFSET_MS);
}

const usedToday = (user) => AiExam.countDocuments({ createdBy: user._id, createdAt: { $gte: startOfTodayVN() } });
const curriculumUsedToday = (user) =>
  AiUsage.countDocuments({ user: user._id, kind: "curriculum", createdAt: { $gte: startOfTodayVN() } });

function parseJson(text, message) {
  try {
    return JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    throw httpError(502, message);
  }
}

router.get("/quota", async (req, res) => {
  try {
    res.json({ used: await usedToday(req.currentUser), limit: DAILY_LIMIT });
  } catch (err) {
    fail(res, err, "Không kiểm tra được lượt dùng.");
  }
});

/* ---------- Mục lục SGK ---------- */

function bookInfo(body) {
  const info = { grade: str(body.grade, 4), subject: str(body.subject, 80), bookSeries: str(body.bookSeries, 80) };
  if (!/^(1[0-2]|[1-9])$/.test(info.grade)) throw httpError(400, "Chọn khối lớp.");
  if (!info.subject) throw httpError(400, "Chọn môn học.");
  if (!info.bookSeries) throw httpError(400, "Chọn bộ sách.");
  return info;
}

const curriculumKey = (i) => [i.grade, i.subject, i.bookSeries].map((x) => x.toLowerCase()).join("|");

function cleanChapters(raw) {
  const data = parseJson(raw, "AI trả về mục lục không hợp lệ, vui lòng thử lại.");
  const list = Array.isArray(data) ? data : data?.chapters;
  if (!Array.isArray(list)) throw httpError(502, "AI trả về mục lục không hợp lệ, vui lòng thử lại.");
  const chapters = list
    .slice(0, 40)
    .map((c) => ({
      title: str(c?.title, 200),
      semester: Number(c?.semester) === 2 ? 2 : 1,
      lessons: (Array.isArray(c?.lessons) ? c.lessons : [])
        .map((l) => str(typeof l === "string" ? l : l?.title, 200))
        .filter(Boolean)
        .slice(0, 40),
    }))
    .filter((c) => c.lessons.length);
  if (!chapters.length) throw httpError(502, "AI không liệt kê được bài nào, vui lòng thử lại hoặc tự nhập tên bài.");
  return chapters;
}

/** Danh sách chương / bài của 1 cuốn SGK; lấy từ bộ đệm, chưa có (hoặc refresh) thì hỏi AI */
router.post("/curriculum", async (req, res) => {
  try {
    const info = bookInfo(req.body);
    const key = curriculumKey(info);
    const cached = await ExamCurriculum.findOne({ key });
    if (cached && req.body.refresh !== true) {
      return res.json({ chapters: cached.chapters, cached: true, updatedAt: cached.updatedAt });
    }
    if ((await curriculumUsedToday(req.currentUser)) >= CURRICULUM_DAILY_LIMIT) {
      throw httpError(429, `Mỗi tài khoản được dùng AI lấy mục lục tối đa ${CURRICULUM_DAILY_LIMIT} lần mỗi ngày. Bạn có thể tự nhập tên bài.`);
    }
    const result = await generateFromImages({ system: CURRICULUM_SYSTEM, prompt: buildCurriculumPrompt(info), json: true });
    const chapters = cleanChapters(result.text);
    await AiUsage.create({ user: req.currentUser._id, kind: "curriculum" });
    const saved = await ExamCurriculum.findOneAndUpdate(
      { key },
      { $set: { ...info, chapters, model: result.model } },
      { upsert: true, new: true },
    );
    res.json({ chapters: saved.chapters, cached: false, updatedAt: saved.updatedAt });
  } catch (err) {
    fail(res, err, "Không lấy được danh sách bài.");
  }
});

/* ---------- Soạn đề ---------- */

function readConfig(body) {
  const level = LEVELS[body.level] ? body.level : null;
  if (!level) throw httpError(400, "Chọn chương trình học (tiểu học, THCS, THPT hoặc GDNN-GDTX).");
  const info = bookInfo(body);
  const [lo, hi] = GRADE_RANGE[level];
  if (Number(info.grade) < lo || Number(info.grade) > hi) throw httpError(400, `Khối ${info.grade} không thuộc ${LEVELS[level].label}.`);

  const lessons = (Array.isArray(body.lessons) ? body.lessons : [])
    .map((l) => ({ chapter: str(l?.chapter, 200), title: str(l?.title, 200) }))
    .filter((l) => l.title);
  if (!lessons.length) throw httpError(400, "Chọn ít nhất 1 bài cần ra đề.");
  if (lessons.length > 40) throw httpError(400, "Chọn tối đa 40 bài.");

  const ratios = {};
  for (const k of LEVEL_KEYS) {
    const v = Math.round(Number(body.ratios?.[k]));
    ratios[k] = Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : 0;
  }
  if (LEVEL_KEYS.reduce((s, k) => s + ratios[k], 0) !== 100) throw httpError(400, "Tổng tỉ lệ 4 mức độ phải bằng 100%.");

  const objectivePercent = Math.round(Number(body.objectivePercent) / 10) * 10;
  if (!(objectivePercent >= 30 && objectivePercent <= 100)) throw httpError(400, "Tỉ lệ trắc nghiệm phải từ 30% đến 100%.");
  const mcPercent = Math.round(Number(body.mcPercent));
  if (!(mcPercent >= 0 && mcPercent <= 100)) throw httpError(400, "Tỉ lệ câu nhiều lựa chọn không hợp lệ.");
  const mcPoints = [0.25, 0.5, 1].includes(Number(body.mcPoints)) ? Number(body.mcPoints) : 0.25;
  const essayCount = objectivePercent < 100 ? Math.min(8, Math.max(1, Math.round(Number(body.essayCount) || 2))) : 0;
  const duration = Math.min(180, Math.max(10, Math.round(Number(body.duration) || 45)));

  const config = {
    level,
    ...info,
    examName: str(body.examName, 120),
    duration,
    lessons,
    ratios,
    objectivePercent,
    mcPercent,
    mcPoints,
    essayCount,
    notes: multiline(body.notes, 1500),
  };
  const counts = examCounts(config);
  if (counts.mc + counts.tf === 0) throw httpError(400, "Đề chưa có câu trắc nghiệm nào, hãy kiểm tra lại cấu hình.");
  if (counts.mc > 60 || counts.tf > 12) throw httpError(400, "Số câu trắc nghiệm quá nhiều, hãy tăng điểm mỗi câu hoặc giảm tỉ lệ.");
  return { config, counts };
}

const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/** Chỉ số bài trong danh sách đã chọn ứng với tên bài AI ghi; -1 nếu không khớp */
function lessonMatcher(lessons) {
  const names = lessons.map((l) => norm(l.title));
  const numberOf = (s) => s.match(/^(?:bài|chủ đề|tiết)\s*(\d+)/)?.[1];
  return (raw) => {
    const n = norm(raw);
    if (!n) return -1;
    let i = names.indexOf(n);
    if (i >= 0) return i;
    i = names.findIndex((x) => x.includes(n) || n.includes(x));
    if (i >= 0) return i;
    const num = numberOf(n);
    return num ? names.findIndex((x) => numberOf(x) === num) : -1;
  };
}

const levelOf = (v, fallback = "th") => (LEVEL_KEYS.includes(v) ? v : fallback);
const stripLabel = (s) => str(s, 600).replace(/^\(?[A-Da-d][.):]\s+/, "");
const roundQuarter = (n) => Math.round(n * 4) / 4;

/** Làm sạch JSON đề AI trả về, cắt theo đúng số câu cấu hình, ghi chú các chỗ lệch */
function cleanExam(raw, config, counts) {
  const data = parseJson(raw, "AI trả về đề không hợp lệ, vui lòng thử lại.");
  const match = lessonMatcher(config.lessons);
  const warnings = [];

  const mcQuestions = (Array.isArray(data.mcQuestions) ? data.mcQuestions : [])
    .map((q) => {
      const options = (Array.isArray(q?.options) ? q.options : []).map(stripLabel).slice(0, 4);
      const answer = String(q?.answer || "").trim().toUpperCase().charAt(0);
      if (options.length !== 4 || options.some((o) => !o) || !LETTERS.includes(answer) || !str(q?.question, 10)) return null;
      return { lesson: match(q.lesson), level: levelOf(q.level), question: multiline(q.question, 2000), options, answer };
    })
    .filter(Boolean)
    .slice(0, counts.mc);

  const tfQuestions = (Array.isArray(data.tfQuestions) ? data.tfQuestions : [])
    .map((q) => {
      const statements = (Array.isArray(q?.statements) ? q.statements : [])
        .map((s) => ({ text: stripLabel(s?.text), correct: s?.correct === true || s?.correct === "true", level: levelOf(s?.level) }))
        .filter((s) => s.text)
        .slice(0, 4);
      if (statements.length !== 4 || !str(q?.stem, 10)) return null;
      return { lesson: match(q.lesson), stem: multiline(q.stem, 3000), statements };
    })
    .filter(Boolean)
    .slice(0, counts.tf);

  let essayQuestions = (Array.isArray(data.essayQuestions) ? data.essayQuestions : [])
    .map((q) => ({
      lesson: match(q?.lesson),
      level: levelOf(q?.level, "vd"),
      points: Math.max(0.25, roundQuarter(Number(q?.points) || 1)),
      question: multiline(q?.question, 3000),
      answerGuide: multiline(q?.answerGuide, 5000),
    }))
    .filter((q) => q.question)
    .slice(0, counts.essay);

  // Điểm tự luận: co giãn cho đúng tổng, làm tròn 0,25, phần dư dồn vào câu cuối
  if (essayQuestions.length) {
    const sum = essayQuestions.reduce((s, q) => s + q.points, 0);
    essayQuestions = essayQuestions.map((q) => ({ ...q, points: Math.max(0.25, roundQuarter((q.points * counts.essayPoints) / sum)) }));
    const diff = counts.essayPoints - essayQuestions.reduce((s, q) => s + q.points, 0);
    const last = essayQuestions[essayQuestions.length - 1];
    last.points = Math.max(0.25, roundQuarter(last.points + diff));
  }

  if (mcQuestions.length < counts.mc) warnings.push(`AI mới soạn được ${mcQuestions.length}/${counts.mc} câu nhiều lựa chọn.`);
  if (tfQuestions.length < counts.tf) warnings.push(`AI mới soạn được ${tfQuestions.length}/${counts.tf} câu đúng/sai.`);
  if (essayQuestions.length < counts.essay) warnings.push(`AI mới soạn được ${essayQuestions.length}/${counts.essay} câu tự luận.`);
  const oddTf = tfQuestions.filter((q) => {
    const n = q.statements.filter((s) => s.correct).length;
    return n < 2 || n > 3;
  }).length;
  if (oddTf) warnings.push(`${oddTf} câu đúng/sai có số ý đúng khác 2–3 ý, nên kiểm tra lại.`);
  const unmatched = [...mcQuestions, ...tfQuestions, ...essayQuestions].filter((q) => q.lesson < 0).length;
  if (unmatched) warnings.push(`${unmatched} câu không gắn được với bài đã chọn (xếp vào "Nội dung khác" trong ma trận).`);
  if (!mcQuestions.length && !tfQuestions.length && !essayQuestions.length) {
    throw httpError(502, "AI không soạn được câu hỏi nào, vui lòng thử lại.");
  }

  // Bản đặc tả: mỗi bài đã chọn 1 dòng
  const specs = Array.isArray(data.specification) ? data.specification : [];
  const specification = config.lessons.map((_, i) => {
    const found = specs.find((s) => match(s?.lesson) === i);
    const requirements = {};
    for (const k of LEVEL_KEYS) requirements[k] = multiline(found?.requirements?.[k], 1500);
    return { lesson: i, requirements };
  });

  const title = str(data.title, 250) || `${config.examName || "Đề kiểm tra"} – ${config.subject} ${config.grade}`;
  return { title, specification, mcQuestions, tfQuestions, essayQuestions, warnings };
}

function toSummary(e) {
  return {
    id: e._id,
    title: e.title,
    level: e.config.level,
    grade: e.config.grade,
    subject: e.config.subject,
    bookSeries: e.config.bookSeries,
    examName: e.config.examName,
    duration: e.config.duration,
    questionCount: (e.mcQuestions?.length || 0) + (e.tfQuestions?.length || 0) + (e.essayQuestions?.length || 0),
    createdAt: e.createdAt,
  };
}

function toDetail(e) {
  return {
    ...toSummary(e),
    config: e.config,
    counts: e.counts,
    specification: e.specification,
    mcQuestions: e.mcQuestions,
    tfQuestions: e.tfQuestions,
    essayQuestions: e.essayQuestions,
    warnings: e.warnings,
    model: e.model,
  };
}

router.post("/generate", async (req, res) => {
  try {
    const { config, counts } = readConfig(req.body);
    if ((await usedToday(req.currentUser)) >= DAILY_LIMIT) {
      throw httpError(429, `Mỗi tài khoản được tạo tối đa ${DAILY_LIMIT} đề bằng AI mỗi ngày. Vui lòng quay lại vào ngày mai.`);
    }
    const result = await generateFromImages({ system: EXAM_SYSTEM, prompt: buildExamPrompt({ ...config, counts }), json: true });
    const exam = cleanExam(result.text, config, counts);
    if (result.truncated) exam.warnings.push("Đề bị cắt do quá dài — hãy giảm số câu hoặc số bài rồi tạo lại.");
    const saved = await AiExam.create({
      ...exam,
      school: req.school._id,
      createdBy: req.currentUser._id,
      config,
      counts,
      model: result.model,
    });
    res.status(201).json(toDetail(saved));
  } catch (err) {
    fail(res, err, "Không tạo được đề kiểm tra.");
  }
});

async function findOwn(req) {
  const exam = await AiExam.findOne({ _id: req.params.id, createdBy: req.currentUser._id, deletedAt: null });
  if (!exam) throw httpError(404, "Không tìm thấy đề.");
  return exam;
}

router.get("/", async (req, res) => {
  try {
    const list = await AiExam.find({ createdBy: req.currentUser._id, deletedAt: null })
      .select("title config createdAt mcQuestions.level tfQuestions.stem essayQuestions.level")
      .sort({ createdAt: -1 })
      .limit(100);
    res.json(list.map(toSummary));
  } catch (err) {
    fail(res, err, "Không tải được danh sách đề.");
  }
});

router.get("/:id", async (req, res) => {
  try {
    res.json(toDetail(await findOwn(req)));
  } catch (err) {
    fail(res, err, "Không tải được đề.");
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const exam = await findOwn(req);
    exam.deletedAt = new Date();
    await exam.save();
    res.json({ ok: true });
  } catch (err) {
    fail(res, err, "Không xoá được đề.");
  }
});

module.exports = router;
