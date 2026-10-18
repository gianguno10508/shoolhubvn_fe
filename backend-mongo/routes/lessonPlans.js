const express = require("express");
const LessonPlan = require("../models/LessonPlan");
const AiUsage = require("../models/AiUsage");
const auth = require("../middleware/auth");
const loadUser = require("../middleware/loadUser");
const requirePermission = require("../middleware/requirePermission");
const requireSchoolVip = require("../middleware/requireSchoolVip");
const { PERMISSIONS: P } = require("../config/roles");
const {
  SYSTEM_PROMPT,
  digitalCompetencePrompt,
  buildUserPrompt,
  SLIDES_PROMPT,
  buildSlidesPrompt,
} = require("../config/lessonPlanPrompt");
const { loadDigitalCompetence, competenceTable } = require("../utils/digitalCompetence");
const { generateFromImages } = require("../utils/gemini");

/* Giáo án AI: giáo viên tải ảnh SGK → Gemini soạn giáo án theo prompt có sẵn → lưu, sửa, xuất Word / PowerPoint */

const router = express.Router();

const MAX_IMAGES = 30; // 1 bài thường gồm nhiều ảnh chụp màn hình
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_TOTAL_BYTES = 30 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const DAILY_LIMIT = Number(process.env.LESSON_PLAN_DAILY_LIMIT) || 2; // giáo án / tài khoản / ngày
const SLIDES_DAILY_LIMIT = Number(process.env.SLIDES_DAILY_LIMIT) || 2; // lần tạo PowerPoint bằng AI / tài khoản / ngày
const VN_OFFSET_MS = 7 * 60 * 60 * 1000; // ngày tính theo giờ Việt Nam (UTC+7)

router.use(auth, loadUser, (req, res, next) => {
  const school = req.currentUser.school;
  if (!school) return res.status(400).json({ error: "Tài khoản này không thuộc trường nào." });
  req.school = school;
  next();
});
router.use(requireSchoolVip);
router.use(requirePermission(P.LESSON_PLAN));

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
  return {
    ...toSummary(p),
    notes: p.notes,
    content: p.content,
    model: p.model,
    hasSlides: !!p.slides?.length,
  };
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
      .select("-content -notes -slides")
      .sort({ createdAt: -1 })
      .limit(200);
    res.json(list.map(toSummary));
  } catch (err) {
    fail(res, err, "Không tải được danh sách giáo án.");
  }
});

/* Số giáo án đã soạn hôm nay (tính cả giáo án đã xoá để không xoá đi soạn lại được) */
function startOfTodayVN() {
  const now = Date.now() + VN_OFFSET_MS;
  return new Date(now - (now % 86400000) - VN_OFFSET_MS);
}

async function usedToday(user) {
  return LessonPlan.countDocuments({ createdBy: user._id, createdAt: { $gte: startOfTodayVN() } });
}

const slidesUsedToday = (user) => AiUsage.countDocuments({ user: user._id, kind: "slides", createdAt: { $gte: startOfTodayVN() } });

router.get("/quota", async (req, res) => {
  try {
    const [used, slidesUsed] = await Promise.all([usedToday(req.currentUser), slidesUsedToday(req.currentUser)]);
    res.json({ used, limit: DAILY_LIMIT, maxImages: MAX_IMAGES, slidesUsed, slidesLimit: SLIDES_DAILY_LIMIT });
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
      throw httpError(429, `Mỗi tài khoản được soạn tối đa ${DAILY_LIMIT} giáo án mỗi ngày. Vui lòng quay lại vào ngày mai.`);
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

/* ---------- Slide trình chiếu ---------- */

const text = (v, max) => (typeof v === "string" ? v.replace(/\*\*|__|`/g, "").replace(/\s+/g, " ").trim().slice(0, max) : "");
const textList = (v, maxItems, max) => (Array.isArray(v) ? v.map((x) => text(x, max)).filter(Boolean).slice(0, maxItems) : []);
const SLIDE_KINDS = ["section", "content", "activity", "quiz", "summary"];

/** Emoji minh hoạ: chỉ nhận 1 emoji ngắn, bỏ cờ (Windows hiển thị cờ thành chữ cái) */
function cleanEmoji(v) {
  const e = typeof v === "string" ? v.trim() : "";
  if (!e || e.length > 12 || !/\p{Extended_Pictographic}/u.test(e) || /\p{Regional_Indicator}/u.test(e)) return "";
  return e;
}

/** Làm sạch JSON AI trả về: chỉ giữ các trường biết trước, cắt độ dài để slide không tràn */
function cleanSlides(raw) {
  let data;
  try {
    data = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    throw httpError(502, "AI trả về dàn ý slide không hợp lệ, vui lòng thử lại.");
  }
  const list = Array.isArray(data) ? data : data?.slides;
  if (!Array.isArray(list)) throw httpError(502, "AI trả về dàn ý slide không hợp lệ, vui lòng thử lại.");

  const slides = [];
  for (const s of list.slice(0, 40)) {
    const kind = SLIDE_KINDS.includes(s?.kind) ? s.kind : "content";
    const slide = { kind, title: text(s?.title, 120), notes: text(s?.notes, 3000), emoji: cleanEmoji(s?.emoji) };
    if (kind === "section") slide.subtitle = text(s.subtitle, 200);
    if (kind === "content" || kind === "summary") slide.bullets = textList(s.bullets, 7, 220);
    if (kind === "activity") {
      slide.task = text(s.task, 400);
      slide.bullets = textList(s.bullets, 6, 200);
      slide.time = text(s.time, 30);
    }
    if (kind === "quiz") {
      slide.question = text(s.question, 300);
      slide.options = textList(s.options, 4, 150);
      const answer = Number(s.answer);
      slide.answer = Number.isInteger(answer) && answer >= 0 && answer < slide.options.length ? answer : 0;
      if (slide.options.length < 2 || !slide.question) continue;
    }
    if (!slide.title && kind !== "quiz") continue;
    slides.push(slide);
  }
  if (slides.length < 3) throw httpError(502, "AI tạo quá ít slide, vui lòng thử lại.");
  return slides;
}

/* Lấy dàn ý slide; tạo bằng AI nếu chưa có, giáo án đã sửa sau lần tạo trước, hoặc giáo viên yêu cầu tạo lại.
 * Mỗi lần AI tạo slide tính 1 lượt (tối đa SLIDES_DAILY_LIMIT / tài khoản / ngày); dùng lại slide cũ không tính. */
router.post("/:id/slides", async (req, res) => {
  try {
    const plan = await findOwn(req);
    const user = req.currentUser;
    const stale = !plan.slides?.length || (plan.slidesAt && plan.updatedAt > plan.slidesAt);
    const used = await slidesUsedToday(user);
    const left = (n) => Math.max(0, SLIDES_DAILY_LIMIT - n);

    if (stale || req.body.refresh === true) {
      if (used >= SLIDES_DAILY_LIMIT) {
        if (plan.slides?.length && !req.body.refresh) return res.json({ slides: plan.slides, slidesLeft: 0, reused: true });
        throw httpError(
          429,
          `Mỗi tài khoản được tạo PowerPoint bằng AI tối đa ${SLIDES_DAILY_LIMIT} lần mỗi ngày. Vui lòng quay lại vào ngày mai.`,
        );
      }
      const result = await generateFromImages({
        system: SLIDES_PROMPT,
        prompt: buildSlidesPrompt(plan),
        json: true,
      });
      const slides = cleanSlides(result.text);
      const now = new Date();
      // updateOne để không làm thay đổi updatedAt (dùng để biết giáo án có sửa sau khi tạo slide)
      await LessonPlan.updateOne(
        { _id: plan._id },
        { $set: { slides, slidesAt: now, updatedAt: plan.updatedAt }, $inc: { slidesCount: 1 } },
        { timestamps: false },
      );
      await AiUsage.create({ user: user._id, kind: "slides", ref: plan._id });
      return res.json({ slides, slidesLeft: left(used + 1) });
    }
    res.json({ slides: plan.slides, slidesLeft: left(used), reused: true });
  } catch (err) {
    fail(res, err, "Không tạo được slide trình chiếu.");
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
