const express = require("express");
const LessonPlan = require("../models/LessonPlan");
const auth = require("../middleware/auth");
const loadUser = require("../middleware/loadUser");
const requirePermission = require("../middleware/requirePermission");
const requireSchoolVip = require("../middleware/requireSchoolVip");
const { PERMISSIONS: P } = require("../config/roles");
const { SYSTEM_PROMPT, digitalCompetencePrompt, buildUserPrompt } = require("../config/lessonPlanPrompt");
const { loadDigitalCompetence, competenceTable } = require("../utils/digitalCompetence");
const { generateFromImages } = require("../utils/gemini");

/* Giáo án AI: giáo viên tải ảnh SGK → Gemini soạn giáo án theo prompt có sẵn → lưu, sửa, xuất Word */

const router = express.Router();

const MAX_IMAGES = 30; // 1 bài thường gồm nhiều ảnh chụp màn hình
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_TOTAL_BYTES = 30 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const DAILY_LIMIT = Number(process.env.LESSON_PLAN_DAILY_LIMIT) || 20; // lượt soạn / giáo viên / ngày

router.use(auth, loadUser, (req, res, next) => {
  const school = req.currentUser.school;
  if (!school) return res.status(400).json({ error: "Tài khoản này không thuộc trường nào." });
  req.school = school;
  next();
});
router.use(requireSchoolVip);
router.use(requirePermission(P.EXAM_MANAGE, P.ASSIGNMENT_MANAGE));

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

const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function toSummary(p) {
  return {
    id: p._id,
    title: p.title,
    subject: p.subject,
    grade: p.grade,
    bookSeries: p.bookSeries,
    periods: p.periods,
    imageCount: p.imageCount,
    digitalCompetence: p.digitalCompetence,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

function toDetail(p) {
  return { ...toSummary(p), notes: p.notes, content: p.content, model: p.model };
}

async function findOwn(req) {
  const plan = await LessonPlan.findOne({
    _id: req.params.id,
    school: req.school._id,
    createdBy: req.currentUser._id,
    deletedAt: null,
  });
  if (!plan) throw httpError(404, "Không tìm thấy giáo án.");
  return plan;
}

function readImages(list) {
  if (!Array.isArray(list) || !list.length) throw httpError(400, "Vui lòng tải lên ít nhất 1 ảnh sách giáo khoa.");
  if (list.length > MAX_IMAGES) throw httpError(400, `Tối đa ${MAX_IMAGES} ảnh cho mỗi giáo án.`);
  const images = list.map((img, i) => {
    const mimeType = str(img?.mimeType, 40).toLowerCase();
    const data = typeof img?.data === "string" ? img.data.replace(/^data:[^;]+;base64,/, "") : "";
    if (!IMAGE_TYPES.includes(mimeType)) throw httpError(400, `Ảnh ${i + 1} không đúng định dạng (JPG, PNG, WEBP).`);
    if (!data || !/^[A-Za-z0-9+/=]+$/.test(data)) throw httpError(400, `Ảnh ${i + 1} bị lỗi dữ liệu.`);
    if ((data.length * 3) / 4 > MAX_IMAGE_BYTES) throw httpError(400, `Ảnh ${i + 1} quá lớn (tối đa 4MB).`);
    return { mimeType, data };
  });
  const total = images.reduce((sum, img) => sum + (img.data.length * 3) / 4, 0);
  if (total > MAX_TOTAL_BYTES) throw httpError(400, "Tổng dung lượng ảnh quá lớn (tối đa 30MB), hãy bớt ảnh.");
  return images;
}

/** Bỏ khối ``` nếu AI lỡ bọc cả giáo án trong đó */
function cleanMarkdown(text) {
  const m = text.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```\s*$/);
  return (m ? m[1] : text).trim();
}

/* Danh sách giáo án của tôi */
router.get("/", async (req, res) => {
  try {
    const list = await LessonPlan.find({ school: req.school._id, createdBy: req.currentUser._id, deletedAt: null })
      .select("-content -notes")
      .sort({ createdAt: -1 })
      .limit(200);
    res.json(list.map(toSummary));
  } catch (err) {
    fail(res, err, "Không tải được danh sách giáo án.");
  }
});

/* Số lượt soạn còn lại hôm nay */
async function usedToday(user) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return LessonPlan.countDocuments({ createdBy: user._id, createdAt: { $gte: start } });
}

router.get("/quota", async (req, res) => {
  try {
    const used = await usedToday(req.currentUser);
    res.json({ used, limit: DAILY_LIMIT, maxImages: MAX_IMAGES });
  } catch (err) {
    fail(res, err, "Không kiểm tra được lượt dùng.");
  }
});

/* Soạn giáo án mới từ ảnh */
router.post("/generate", async (req, res) => {
  try {
    const images = readImages(req.body.images);
    const info = {
      title: str(req.body.title, 200),
      subject: str(req.body.subject, 80),
      grade: str(req.body.grade, 20),
      bookSeries: str(req.body.bookSeries, 80),
      periods: Math.min(10, Math.max(1, Math.round(Number(req.body.periods) || 1))),
      notes: str(req.body.notes, 2000),
      digitalCompetence: req.body.digitalCompetence === true,
    };

    if ((await usedToday(req.currentUser)) >= DAILY_LIMIT) {
      throw httpError(429, `Mỗi giáo viên được soạn tối đa ${DAILY_LIMIT} giáo án mỗi ngày. Vui lòng quay lại vào ngày mai.`);
    }

    let system = SYSTEM_PROMPT;
    if (info.digitalCompetence) system += digitalCompetencePrompt(competenceTable(await loadDigitalCompetence()));

    const result = await generateFromImages({
      system,
      prompt: buildUserPrompt({ ...info, imageCount: images.length, digital: info.digitalCompetence }),
      images,
    });

    let content = cleanMarkdown(result.text);
    if (result.truncated) content += "\n\n*(Giáo án bị cắt do quá dài — hãy tách bài thành ít ảnh hơn hoặc soạn tiếp phần còn thiếu.)*";

    // Tên bài: ưu tiên giáo viên nhập, không thì lấy từ dòng "TÊN BÀI DẠY" AI viết
    const found = content.match(/TÊN BÀI DẠY\s*:?\s*\**\s*([^\n*]+)/i);
    const title = info.title || (found && found[1].trim()) || "Giáo án chưa đặt tên";

    const plan = await LessonPlan.create({
      ...info,
      title: title.slice(0, 200),
      school: req.school._id,
      createdBy: req.currentUser._id,
      content,
      imageCount: images.length,
      model: result.model,
    });
    res.status(201).json(toDetail(plan));
  } catch (err) {
    fail(res, err, "Không soạn được giáo án.");
  }
});

router.get("/:id", async (req, res) => {
  try {
    res.json(toDetail(await findOwn(req)));
  } catch (err) {
    fail(res, err, "Không tải được giáo án.");
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const plan = await findOwn(req);
    if (typeof req.body.title === "string") {
      const title = str(req.body.title, 200);
      if (!title) throw httpError(400, "Tên giáo án không được để trống.");
      plan.title = title;
    }
    if (typeof req.body.content === "string") plan.content = req.body.content.slice(0, 200000);
    await plan.save();
    res.json(toDetail(plan));
  } catch (err) {
    fail(res, err, "Không lưu được giáo án.");
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const plan = await findOwn(req);
    plan.deletedAt = new Date();
    await plan.save();
    res.json({ ok: true });
  } catch (err) {
    fail(res, err, "Không xoá được giáo án.");
  }
});

module.exports = router;
