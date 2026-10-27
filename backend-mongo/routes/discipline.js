const express = require("express");
const mongoose = require("mongoose");
const DisciplineRecord = require("../models/DisciplineRecord");
const Class = require("../models/Class");
const User = require("../models/User");
const auth = require("../middleware/auth");
const loadUser = require("../middleware/loadUser");
const requirePermission = require("../middleware/requirePermission");
const requireSchoolVip = require("../middleware/requireSchoolVip");
const { PERMISSIONS: P, ROLES } = require("../config/roles");
const { pushToUsers } = require("../utils/push");

const router = express.Router();

router.use(auth, loadUser, (req, res, next) => {
  const school = req.currentUser.school;
  if (!school) return res.status(400).json({ error: "Tài khoản này không thuộc trường nào." });
  if (school.modules && school.modules.discipline === false) {
    return res.status(403).json({ error: "Trường chưa bật mục Thi đua & Nề nếp." });
  }
  req.school = school;
  next();
});

// Trường chưa có / hết hạn VIP: khóa toàn bộ chức năng (admin hệ thống luôn qua)
router.use(requireSchoolVip);

const canView = requirePermission(P.DISCIPLINE_VIEW, P.DISCIPLINE_SCORE, P.DISCIPLINE_CONFIG);
const canScore = requirePermission(P.DISCIPLINE_SCORE);
const canConfig = requirePermission(P.DISCIPLINE_CONFIG);

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

/* =========================================
   NGÀY THÁNG — làm việc với chuỗi "YYYY-MM-DD" (giờ Việt Nam)
========================================= */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86400e3;
const WEEKDAY = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

const parseDay = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
const fmtDay = (t) => new Date(t).toISOString().slice(0, 10);
const addDays = (s, n) => fmtDay(parseDay(s) + n * DAY_MS);
const weekdayOf = (s) => new Date(parseDay(s)).getUTCDay();
const todayVN = () => fmtDay(Date.now() + 7 * 3600e3);

function weekStartOf(s, weekStartDay) {
  const diff = (weekdayOf(s) - weekStartDay + 7) % 7;
  return addDays(s, -diff);
}

function checkDate(s) {
  if (!DATE_RE.test(s || "") || Number.isNaN(parseDay(s))) throw httpError(400, "Ngày không hợp lệ (YYYY-MM-DD).");
  return s;
}

/* =========================================
   CẤU HÌNH
========================================= */

const T = (name, items) => ({ name, active: true, items: items.map(([n, points, inputType, kind = "penalty"]) => ({ name: n, points, inputType, kind, active: true })) });

// Mẫu mặc định cho trường chưa cấu hình (Đoàn thanh niên sửa lại tùy ý)
const DEFAULT_CATEGORIES = [
  T("Sĩ số", [
    ["Vắng không phép", 2, "names"],
    ["Vắng có phép", 1, "names"],
    ["Đi muộn", 1, "names"],
  ]),
  T("Truy bài", [
    ["Lớp không truy bài", 5, "checkbox"],
    ["Mất trật tự giờ truy bài", 1, "names"],
  ]),
  T("Vệ sinh", [
    ["Lớp học bẩn", 5, "checkbox"],
    ["Không đổ rác", 2, "checkbox"],
    ["Khu vực được phân công bẩn", 3, "checkbox"],
  ]),
  T("Đồng phục", [
    ["Sai đồng phục", 1, "names"],
    ["Không đeo huy hiệu / khăn quàng", 1, "names"],
  ]),
  T("Nề nếp giờ học", [
    ["Tiết học xếp loại B", 2, "count"],
    ["Tiết học xếp loại C", 5, "count"],
    ["Tiết học tốt (loại A+)", 2, "count", "bonus"],
  ]),
];

async function getConfig(school) {
  const d = school.settings.discipline;
  if (!d.configured && (!d.categories || d.categories.length === 0)) {
    d.categories = DEFAULT_CATEGORIES;
    await school.save();
  }
  return school.settings.discipline;
}

function configJSON(d) {
  return {
    configured: d.configured,
    basePoints: d.basePoints,
    weekStartDay: d.weekStartDay,
    scoreDays: d.scoreDays,
    weekOneStart: d.weekOneStart || "",
    categories: d.categories.map((c) => ({
      id: c._id,
      name: c.name,
      active: c.active,
      items: c.items.map((i) => ({
        id: i._id,
        name: i.name,
        kind: i.kind,
        points: i.points,
        inputType: i.inputType,
        active: i.active,
      })),
    })),
  };
}

router.get("/config", canView, async (req, res) => {
  try {
    res.json(configJSON(await getConfig(req.school)));
  } catch (err) {
    fail(res, err, "Lỗi máy chủ khi tải cấu hình.");
  }
});

const asId = (v) => (v && mongoose.isValidObjectId(v) ? v : undefined);

router.put("/config", canConfig, requireSchoolVip, async (req, res) => {
  try {
    const { basePoints, weekStartDay, scoreDays, categories, weekOneStart } = req.body;
    if (!Array.isArray(categories)) throw httpError(400, "Thiếu danh sách mục chấm.");
    const clean = categories.map((c, ci) => {
      if (!String(c.name || "").trim()) throw httpError(400, `Mục lớn thứ ${ci + 1} chưa có tên.`);
      return {
        _id: asId(c.id),
        name: String(c.name).trim(),
        active: c.active !== false,
        items: (c.items || []).map((i, ii) => {
          if (!String(i.name || "").trim()) throw httpError(400, `“${c.name}”: mục nhỏ thứ ${ii + 1} chưa có tên.`);
          const points = Number(i.points);
          if (!Number.isFinite(points) || points < 0) throw httpError(400, `“${i.name}”: điểm không hợp lệ.`);
          return {
            _id: asId(i.id),
            name: String(i.name).trim(),
            kind: i.kind === "bonus" ? "bonus" : "penalty",
            points,
            inputType: ["checkbox", "names", "count"].includes(i.inputType) ? i.inputType : "checkbox",
            active: i.active !== false,
          };
        }),
      };
    });

    const d = req.school.settings.discipline;
    if (basePoints !== undefined) d.basePoints = Math.max(0, Number(basePoints) || 0);
    if (weekStartDay !== undefined) d.weekStartDay = Math.min(6, Math.max(0, Number(weekStartDay) || 0));
    if (Array.isArray(scoreDays)) d.scoreDays = [...new Set(scoreDays.map(Number).filter((n) => n >= 0 && n <= 6))].sort();
    if (weekOneStart !== undefined) d.weekOneStart = weekOneStart ? checkDate(weekOneStart) : "";
    d.categories = clean;
    d.configured = true;
    await req.school.save();
    res.json(configJSON(req.school.settings.discipline));
  } catch (err) {
    fail(res, err, "Lỗi máy chủ khi lưu cấu hình.");
  }
});

/* =========================================
   CHẤM ĐIỂM (phiếu theo lớp × ngày)
========================================= */

// Danh sách phiếu của 1 ngày (màn hình chấm: lớp nào đã chấm)
router.get("/records", canView, async (req, res) => {
  try {
    const filter = { school: req.school._id };
    if (req.query.date) filter.date = checkDate(req.query.date);
    if (req.query.from || req.query.to) {
      filter.date = { $gte: checkDate(req.query.from), $lte: checkDate(req.query.to) };
    }
    if (req.query.classId) filter.classId = req.query.classId;
    if (!req.query.date && !req.query.from) throw httpError(400, "Cần truyền date hoặc from/to.");
    const list = await DisciplineRecord.find(filter).sort({ date: -1, className: 1 });
    res.json(list.map((r) => r.toPublicJSON()));
  } catch (err) {
    fail(res, err, "Lỗi máy chủ khi tải phiếu chấm.");
  }
});

function buildEntries(raw, config) {
  const items = new Map();
  for (const c of config.categories) for (const i of c.items) items.set(String(i._id), { c, i });

  const entries = [];
  for (const e of Array.isArray(raw) ? raw : []) {
    const found = items.get(String(e.itemId));
    if (!found) throw httpError(400, "Có mục chấm không còn trong cấu hình, hãy tải lại trang.");
    const { c, i } = found;
    let quantity = 0;
    let studentNames = [];
    if (i.inputType === "checkbox") quantity = e.checked ? 1 : 0;
    if (i.inputType === "count") quantity = Math.max(0, Math.floor(Number(e.quantity) || 0));
    if (i.inputType === "names") {
      studentNames = (Array.isArray(e.studentNames) ? e.studentNames : String(e.studentNames || "").split(/[,\n;]/))
        .map((n) => String(n).trim())
        .filter(Boolean)
        .slice(0, 100);
      quantity = studentNames.length;
    }
    if (quantity <= 0) continue;
    entries.push({
      categoryId: c._id,
      categoryName: c.name,
      itemId: i._id,
      itemName: i.name,
      kind: i.kind,
      inputType: i.inputType,
      points: i.points,
      quantity,
      studentNames,
      note: String(e.note || "").slice(0, 300),
      total: i.points * quantity,
    });
  }
  return entries;
}

async function loadClass(req) {
  const cls = await Class.findOne({ _id: req.params.classId, school: req.school._id, deletedAt: null });
  if (!cls) throw httpError(404, "Không tìm thấy lớp.");
  return cls;
}

const isFullScorer = (user) => user.hasPermission(P.DISCIPLINE_CONFIG); // Đoàn TN

/** Các lớp cờ đỏ của lớp `classId` được chấm theo phân công của Đoàn TN.
 *  null = Đoàn chưa phân công lớp nào (chấm được mọi lớp trừ lớp mình) */
function assignedTargets(config, classId) {
  const pairs = config.scoringPairs || [];
  if (!pairs.length) return null;
  const mine = pairs.find((p) => String(p.scorer) === String(classId));
  return mine ? mine.targets.map(String) : [];
}

function checkScoreAccess(user, cls, date, config) {
  if (date > todayVN()) throw httpError(400, "Không chấm trước cho ngày trong tương lai.");
  if (isFullScorer(user)) return;
  const ownId = user.classId ? String(user.classId._id || user.classId) : null;
  if (user.role === ROLES.RED_FLAG && ownId === String(cls._id)) {
    throw httpError(403, "Cờ đỏ không chấm lớp của mình.");
  }
  const targets = ownId ? assignedTargets(config, ownId) : null;
  if (targets && !targets.includes(String(cls._id))) {
    throw httpError(403, targets.length ? "Lớp bạn không được phân công chấm lớp này." : "Đoàn trường chưa phân công lớp chấm cho lớp bạn.");
  }
  // Cờ đỏ chỉ chấm / sửa trong tuần hiện tại
  if (weekStartOf(date, config.weekStartDay) !== weekStartOf(todayVN(), config.weekStartDay)) {
    throw httpError(403, "Chỉ được chấm / sửa trong tuần hiện tại. Liên hệ Đoàn trường để sửa tuần trước.");
  }
}

router.put("/records/:classId/:date", canScore, requireSchoolVip, async (req, res) => {
  try {
    const date = checkDate(req.params.date);
    const cls = await loadClass(req);
    const config = await getConfig(req.school);
    checkScoreAccess(req.currentUser, cls, date, config);

    const entries = buildEntries(req.body.entries, config);
    const sum = (kind) => entries.filter((e) => e.kind === kind).reduce((n, e) => n + e.total, 0);
    const record = await DisciplineRecord.findOneAndUpdate(
      { school: req.school._id, classId: cls._id, date },
      {
        className: cls.name,
        weekStart: weekStartOf(date, config.weekStartDay),
        entries,
        totalPenalty: sum("penalty"),
        totalBonus: sum("bonus"),
        note: String(req.body.note || "").slice(0, 500),
        recordedBy: req.currentUser._id,
        recordedByName: req.currentUser.name || req.currentUser.username,
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    );
    res.json(record.toPublicJSON());

    // Báo về điện thoại GVCN của lớp được chấm: "Thi đua nề nếp ngày 21/10/2026 lớp 10A1"
    const scorer = req.currentUser;
    const net = record.totalBonus - record.totalPenalty;
    pushToUsers(
      { school: req.school._id, role: ROLES.HOMEROOM_TEACHER, classId: cls._id, status: "active", _id: { $ne: scorer._id } },
      {
        title: `Thi đua nề nếp ngày ${date.split("-").reverse().join("/")} lớp ${cls.name}`,
        body:
          `${scorer.name || scorer.username}${scorer.classId?.name ? ` (lớp ${scorer.classId.name})` : ""} đã chấm: ` +
          `trừ ${record.totalPenalty}, cộng ${record.totalBonus} → ${net > 0 ? "+" : ""}${net} điểm.`,
        data: { type: "discipline", classId: String(cls._id), date },
      },
    );
  } catch (err) {
    fail(res, err, "Lỗi máy chủ khi lưu phiếu chấm.");
  }
});

router.delete("/records/:classId/:date", canScore, requireSchoolVip, async (req, res) => {
  try {
    const date = checkDate(req.params.date);
    const cls = await loadClass(req);
    const config = await getConfig(req.school);
    checkScoreAccess(req.currentUser, cls, date, config);
    await DisciplineRecord.deleteOne({ school: req.school._id, classId: cls._id, date });
    res.json({ ok: true });
  } catch (err) {
    fail(res, err, "Lỗi máy chủ khi xóa phiếu chấm.");
  }
});

/* =========================================
   TỔNG HỢP TUẦN / THÁNG
========================================= */

function rankRows(rows) {
  const sorted = [...rows].sort((a, b) => b.score - a.score || a.className.localeCompare(b.className, "vi"));
  let rank = 0;
  let prev = null;
  sorted.forEach((r, i) => {
    if (r.score !== prev) rank = i + 1;
    prev = r.score;
    r.rank = rank;
  });
  return sorted;
}

const round2 = (n) => Math.round(n * 100) / 100;

/** GVCN chỉ xem thi đua lớp mình: trả về id lớp (chuỗi) hoặc null nếu được xem cả trường */
function ownClassOnly(user) {
  if (user.role !== ROLES.HOMEROOM_TEACHER) return null;
  if (!user.classId) throw httpError(403, "Bạn chưa được gán lớp chủ nhiệm.");
  return String(user.classId._id || user.classId);
}

/** Khoảng ngày của kỳ tổng hợp: tuần chứa `date` hoặc các tuần bắt đầu trong tháng của `date` */
function periodRange(period, date, config) {
  if (period === "week") {
    const start = weekStartOf(date, config.weekStartDay);
    return { start, end: addDays(start, 6), weeks: [start] };
  }
  const month = date.slice(0, 7);
  const start = `${month}-01`;
  const [y, m] = month.split("-").map(Number);
  const end = fmtDay(Date.UTC(y, m, 0));
  let weeks = [];
  for (let w = weekStartOf(start, config.weekStartDay); w <= end; w = addDays(w, 7)) if (w >= start) weeks.push(w);
  if (!weeks.length) weeks = [weekStartOf(start, config.weekStartDay)];
  return { start, end, weeks };
}

/** period = week | month, date = 1 ngày bất kỳ trong kỳ */
router.get("/summary", canView, async (req, res) => {
  try {
    const period = req.query.period === "month" ? "month" : "week";
    const date = checkDate(req.query.date || todayVN());
    const config = await getConfig(req.school);
    const base = config.basePoints;

    const { start, end, weeks } = periodRange(period, date, config);

    const rangeEnd = period === "month" ? addDays(weeks[weeks.length - 1], 6) : end;
    const rangeStart = period === "month" ? weeks[0] : start;

    const [classes, records, homerooms] = await Promise.all([
      Class.find({ school: req.school._id, deletedAt: null }).sort({ grade: 1, name: 1 }),
      DisciplineRecord.find({ school: req.school._id, date: { $gte: rangeStart, $lte: rangeEnd } }),
      User.find({ school: req.school._id, role: ROLES.HOMEROOM_TEACHER }).select("name username classId"),
    ]);
    const homeroomBy = new Map(homerooms.map((u) => [String(u.classId), u.name || u.username]));

    // Cột hiển thị
    const columns =
      period === "week"
        ? config.scoreDays
            .map((wd) => {
              const day = addDays(start, (wd - config.weekStartDay + 7) % 7);
              return { key: day, label: `${WEEKDAY[wd]} ${day.slice(8, 10)}/${day.slice(5, 7)}` };
            })
            .sort((a, b) => a.key.localeCompare(b.key))
        : weeks.map((w, i) => ({ key: w, label: `Tuần ${i + 1} (${w.slice(8, 10)}/${w.slice(5, 7)})` }));

    const today = todayVN();
    const rows = classes.map((cls) => {
      const mine = records.filter((r) => String(r.classId) === String(cls._id));
      const byCategory = {};
      for (const r of mine) {
        for (const e of r.entries) {
          if (e.kind === "penalty") byCategory[e.categoryName] = (byCategory[e.categoryName] || 0) + e.total;
        }
      }
      const cells = {};
      let penalty = 0;
      let bonus = 0;
      let score;
      if (period === "week") {
        for (const r of mine) {
          cells[r.date] = { net: r.totalBonus - r.totalPenalty, recorded: true };
          penalty += r.totalPenalty;
          bonus += r.totalBonus;
        }
        score = base - penalty + bonus;
      } else {
        // Điểm tháng = trung bình điểm các tuần đã bắt đầu
        const weekScores = [];
        for (const w of weeks) {
          const inWeek = mine.filter((r) => r.weekStart === w);
          const p = inWeek.reduce((n, r) => n + r.totalPenalty, 0);
          const b = inWeek.reduce((n, r) => n + r.totalBonus, 0);
          penalty += p;
          bonus += b;
          if (w <= today) {
            const s = base - p + b;
            weekScores.push(s);
            cells[w] = { score: s, recordedDays: inWeek.length };
          }
        }
        score = weekScores.length ? round2(weekScores.reduce((x, y) => x + y, 0) / weekScores.length) : base;
      }
      return {
        classId: cls._id,
        className: cls.name,
        grade: cls.grade,
        homeroomTeacher: homeroomBy.get(String(cls._id)) || "",
        recordedDays: mine.length,
        penalty,
        bonus,
        score,
        cells,
        byCategory,
      };
    });

    // GVCN: chỉ trả về lớp mình (thứ hạng vẫn tính trên toàn trường)
    const own = ownClassOnly(req.currentUser);
    const ranked = rankRows(rows);
    res.json({
      period,
      date,
      start,
      end,
      week: period === "week" ? weekInfo(config, date).number : null, // tuần học thứ mấy (xuất Excel thi đua)
      basePoints: base,
      columns,
      categories: config.categories.map((c) => c.name),
      totalClasses: ranked.length,
      ownClassOnly: !!own,
      rows: own ? ranked.filter((r) => String(r.classId) === own) : ranked,
    });
  } catch (err) {
    fail(res, err, "Lỗi máy chủ khi tổng hợp điểm.");
  }
});

/* =========================================
   PHÂN CÔNG CHẤM CHÉO & MÀN HÌNH CHẤM CỦA CỜ ĐỎ
========================================= */

const WEEKDAY_FULL = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];

/** Ngày đầu tuần 1 của năm học: Đoàn TN đặt, hoặc tuần chứa ngày khai giảng 05/09 gần nhất (không sau hôm nay) */
function weekOneOf(config, date) {
  if (config.weekOneStart) return weekStartOf(config.weekOneStart, config.weekStartDay);
  const year = Number(date.slice(0, 4));
  const opening = `${year}-09-05` <= date ? `${year}-09-05` : `${year - 1}-09-05`;
  return weekStartOf(opening, config.weekStartDay);
}

function weekInfo(config, date) {
  const start = weekStartOf(date, config.weekStartDay);
  const n = Math.floor((parseDay(start) - parseDay(weekOneOf(config, date))) / (7 * DAY_MS)) + 1;
  return { number: n >= 1 ? n : null, start, end: addDays(start, 6) };
}

router.get("/pairs", canView, async (req, res) => {
  try {
    const config = await getConfig(req.school);
    res.json({ pairs: (config.scoringPairs || []).map((p) => ({ scorerClassId: p.scorer, targetClassIds: p.targets })) });
  } catch (err) {
    fail(res, err, "Lỗi máy chủ khi tải phân công chấm.");
  }
});

/* Đoàn TN lưu phân công: { pairs: [{ scorerClassId, targetClassIds: [] }] } */
router.put("/pairs", canConfig, async (req, res) => {
  try {
    const raw = Array.isArray(req.body.pairs) ? req.body.pairs : [];
    const classes = await Class.find({ school: req.school._id, deletedAt: null }).select("_id");
    const valid = new Set(classes.map((c) => String(c._id)));
    const pairs = [];
    const seen = new Set();
    for (const p of raw) {
      const scorer = String(p.scorerClassId || "");
      if (!valid.has(scorer) || seen.has(scorer)) continue;
      const targets = [...new Set((p.targetClassIds || []).map(String))].filter((t) => valid.has(t) && t !== scorer);
      if (!targets.length) continue;
      seen.add(scorer);
      pairs.push({ scorer, targets });
    }
    const config = await getConfig(req.school);
    config.scoringPairs = pairs;
    await req.school.save();
    res.json({ pairs: config.scoringPairs.map((p) => ({ scorerClassId: p.scorer, targetClassIds: p.targets })) });
  } catch (err) {
    fail(res, err, "Lỗi máy chủ khi lưu phân công chấm.");
  }
});

/* Bước 1 màn hình chấm (app cờ đỏ): hôm nay thứ mấy, tuần mấy, các lớp được chấm + đã chấm chưa */
router.get("/my-scoring", canScore, async (req, res) => {
  try {
    const user = req.currentUser;
    const config = await getConfig(req.school);
    const today = todayVN();
    const ownId = user.classId ? String(user.classId._id || user.classId) : null;

    const classes = await Class.find({ school: req.school._id, deletedAt: null }).sort({ grade: 1, name: 1 });
    let targets = null;
    if (!isFullScorer(user) && ownId) targets = assignedTargets(config, ownId);
    const list = classes.filter((c) => {
      const id = String(c._id);
      if (targets) return targets.includes(id);
      return isFullScorer(user) || id !== ownId;
    });

    const records = await DisciplineRecord.find({ school: req.school._id, date: today, classId: { $in: list.map((c) => c._id) } });
    const byClass = new Map(records.map((r) => [String(r.classId), r]));
    res.json({
      today,
      weekday: WEEKDAY_FULL[weekdayOf(today)],
      isScoreDay: config.scoreDays.includes(weekdayOf(today)),
      week: weekInfo(config, today),
      basePoints: config.basePoints,
      scorerClass: user.classId?.name ? { id: user.classId._id, name: user.classId.name } : null,
      pairsConfigured: (config.scoringPairs || []).length > 0,
      assigned: !!targets,
      targets: list.map((c) => {
        const r = byClass.get(String(c._id));
        return {
          id: c._id,
          name: c.name,
          recorded: !!r,
          totalPenalty: r ? r.totalPenalty : 0,
          totalBonus: r ? r.totalBonus : 0,
          recordedByName: r ? r.recordedByName : "",
        };
      }),
    });
  } catch (err) {
    fail(res, err, "Lỗi máy chủ khi tải thông tin chấm.");
  }
});

/* Danh sách học sinh bị ghi tên trong sổ thi đua của 1 lớp (GVCN: lớp mình) theo tuần / tháng */
router.get("/students", canView, async (req, res) => {
  try {
    const period = req.query.period === "month" ? "month" : "week";
    const date = checkDate(req.query.date || todayVN());
    const config = await getConfig(req.school);
    const classId = ownClassOnly(req.currentUser) || req.query.classId;
    if (!classId) throw httpError(400, "Vui lòng chọn lớp.");
    const cls = await Class.findOne({ _id: classId, school: req.school._id, deletedAt: null });
    if (!cls) throw httpError(404, "Không tìm thấy lớp.");

    const { start, end, weeks } = periodRange(period, date, config);
    const from = period === "month" ? weeks[0] : start;
    const to = period === "month" ? addDays(weeks[weeks.length - 1], 6) : end;
    const records = await DisciplineRecord.find({ school: req.school._id, classId: cls._id, date: { $gte: from, $lte: to } }).sort({ date: 1 });

    const byName = new Map();
    for (const r of records) {
      for (const e of r.entries) {
        for (const raw of e.studentNames || []) {
          const name = raw.replace(/\s+/g, " ").trim();
          const key = name.toLocaleLowerCase("vi");
          if (!byName.has(key)) byName.set(key, { name, count: 0, totalPoints: 0, items: [] });
          const st = byName.get(key);
          st.count += 1;
          st.totalPoints += e.kind === "penalty" ? e.points : -e.points;
          st.items.push({ date: r.date, categoryName: e.categoryName, itemName: e.itemName, kind: e.kind, points: e.points });
        }
      }
    }
    const students = [...byName.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "vi"));
    res.json({ period, classId: cls._id, className: cls.name, start: from, end: to, students });
  } catch (err) {
    fail(res, err, "Lỗi máy chủ khi tải danh sách học sinh.");
  }
});

module.exports = router;
module.exports.helpers = { todayVN, weekStartOf, addDays };
