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
    const { basePoints, weekStartDay, scoreDays, categories } = req.body;
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

const isFullScorer = (user) => user.hasPermission(P.DISCIPLINE_CONFIG); // Đoàn TN, tài khoản trường

function checkScoreAccess(user, cls, date, config) {
  if (date > todayVN()) throw httpError(400, "Không chấm trước cho ngày trong tương lai.");
  if (isFullScorer(user)) return;
  if (user.role === ROLES.RED_FLAG && user.classId && String(user.classId._id) === String(cls._id)) {
    throw httpError(403, "Cờ đỏ không chấm lớp của mình.");
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

/** period = week | month, date = 1 ngày bất kỳ trong kỳ */
router.get("/summary", canView, async (req, res) => {
  try {
    const period = req.query.period === "month" ? "month" : "week";
    const date = checkDate(req.query.date || todayVN());
    const config = await getConfig(req.school);
    const base = config.basePoints;

    let start;
    let end;
    let weeks = [];
    if (period === "week") {
      start = weekStartOf(date, config.weekStartDay);
      end = addDays(start, 6);
    } else {
      const month = date.slice(0, 7);
      start = `${month}-01`;
      const [y, m] = month.split("-").map(Number);
      end = fmtDay(Date.UTC(y, m, 0));
      // Các tuần có ngày đầu tuần nằm trong tháng
      for (let w = weekStartOf(start, config.weekStartDay); w <= end; w = addDays(w, 7)) {
        if (w >= start) weeks.push(w);
      }
      if (!weeks.length) weeks = [weekStartOf(start, config.weekStartDay)];
    }

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

    res.json({
      period,
      date,
      start,
      end,
      basePoints: base,
      columns,
      categories: config.categories.map((c) => c.name),
      rows: rankRows(rows),
    });
  } catch (err) {
    fail(res, err, "Lỗi máy chủ khi tổng hợp điểm.");
  }
});

module.exports = router;
module.exports.helpers = { todayVN, weekStartOf, addDays };
