// utils/dailyReminders.js — thông báo đẩy tự động lúc 20h hằng ngày (giờ Việt Nam):
//  - học sinh, cờ đỏ, giáo viên: số tiết ngày mai theo TKB nhà trường đang áp dụng
//      "Hello!! Mai bạn có 3 tiết cần học" / "Hello!! Ngày mai bạn rảnh"
//  - học sinh, cờ đỏ: bài tập hạn nộp vào ngày mai mà chưa nộp → "Bạn có bài tập cần làm!!"
// Chỉ chạy cho trường còn VIP và người dùng đã cài app (có push token).
const School = require("../models/School");
const User = require("../models/User");
const Assignment = require("../models/Assignment");
const Submission = require("../models/Submission");
const JobRun = require("../models/JobRun");
const { ROLES } = require("../config/roles");
const { DAY_MS } = require("./timetableWeek");
const { DAY_LABELS, TITLE_RE, matchByName, findTimetable, effectiveSchedule } = require("./timetableLessons");
const { sendMessages, isPushToken, viDateTime } = require("./push");

const VN_OFFSET = 7 * 60 * 60 * 1000;
const SEND_HOUR = 20;
const CHECK_EVERY = 60 * 1000;

const LEARNERS = [ROLES.STUDENT, ROLES.RED_FLAG];
const TEACHERS = [ROLES.TEACHER, ROLES.HOMEROOM_TEACHER];

/** Ngày hôm nay theo giờ VN: { key: "YYYY-MM-DD", hour, tomorrow: Date 0h UTC của ngày mai } */
function vnNow(now = Date.now()) {
  const vn = new Date(now + VN_OFFSET);
  const today = Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate());
  return { key: new Date(today).toISOString().slice(0, 10), hour: vn.getUTCHours(), tomorrow: new Date(today + DAY_MS) };
}

const classKey = (n) => String(n || "").replace(TITLE_RE, "").replace(/\s/g, "");

/** Số tiết ngày `date` (0h UTC) theo lớp và theo giáo viên; null = trường chưa áp dụng TKB nào */
async function lessonsOn(schoolId, date) {
  const dayIndex = (date.getUTCDay() + 6) % 7; // 0 = thứ 2
  const from = new Date(date.getTime() - dayIndex * DAY_MS);
  const { doc, range, any } = await findTimetable(schoolId, from, new Date(from.getTime() + 6 * DAY_MS));
  if (!any) return null;
  const data = doc?.data || {};
  const result = { classes: data.classes || [], teachers: data.teachers || [], byClass: new Map(), byTeacher: new Map() };
  const soNgay = Math.min(Math.max(Number(data.config?.soNgay) || 6, 1), 7);
  if (!doc || dayIndex >= soNgay || (range && (date < range.weekStart || date > range.weekEnd))) return result;

  const { cells, lessons } = effectiveSchedule(data);
  for (const [key, lessonId] of Object.entries(cells)) {
    const [day, , , classId] = key.split("|");
    if (day !== DAY_LABELS[dayIndex]) continue;
    const a = lessons.get(lessonId);
    result.byClass.set(classId, (result.byClass.get(classId) || 0) + 1);
    if (a.teacherId) result.byTeacher.set(a.teacherId, (result.byTeacher.get(a.teacherId) || 0) + 1);
  }
  return result;
}

/** Số tiết ngày mai của 1 tài khoản; null = không xác định được (chưa khớp lớp / tên giáo viên) */
function lessonCountOf(user, lessons) {
  if (LEARNERS.includes(user.role)) {
    if (!user.classId) return null;
    const cls = matchByName(lessons.classes, (c) => [classKey(c.name)], classKey(user.classId.name));
    return cls ? lessons.byClass.get(cls.id) || 0 : null;
  }
  const teacher = matchByName(lessons.teachers, (t) => [t.fullName, t.short], String(user.name || "").replace(TITLE_RE, ""));
  return teacher ? lessons.byTeacher.get(teacher.id) || 0 : null;
}

const tokensOf = (u) => (u.pushTokens || []).filter(isPushToken);

async function timetableMessages(school, users, tomorrow) {
  const lessons = await lessonsOn(school._id, tomorrow);
  if (!lessons) return [];
  const messages = [];
  for (const u of users) {
    const count = lessonCountOf(u, lessons);
    if (count === null) continue;
    const verb = LEARNERS.includes(u.role) ? "cần học" : "cần dạy";
    const body = count ? `Hello!! Mai bạn có ${count} tiết ${verb}` : "Hello!! Ngày mai bạn rảnh";
    for (const to of tokensOf(u)) messages.push({ to, title: "📅 Lịch ngày mai", body, data: { type: "timetable" } });
  }
  return messages;
}

async function assignmentMessages(school, users, tomorrow) {
  // Hạn nộp nằm trong ngày mai (giờ VN)
  const start = new Date(tomorrow.getTime() - VN_OFFSET);
  const end = new Date(start.getTime() + DAY_MS);
  const list = await Assignment.find({ school: school._id, deletedAt: null, status: "published", dueAt: { $gte: start, $lt: end } });
  if (!list.length) return [];

  const learners = users.filter((u) => LEARNERS.includes(u.role) && u.classId);
  const done = await Submission.find({
    assignment: { $in: list.map((a) => a._id) },
    student: { $in: learners.map((u) => u._id) },
    status: "submitted",
  }).select("assignment student");
  const submitted = new Set(done.map((s) => `${s.assignment}|${s.student}`));

  const messages = [];
  for (const u of learners) {
    const classId = String(u.classId._id);
    const todo = list.filter((a) => a.classIds.some((c) => String(c) === classId) && !submitted.has(`${a._id}|${u._id}`));
    if (!todo.length) continue;
    const body =
      todo.length === 1
        ? `"${todo[0].title}" — hạn nộp ${viDateTime(todo[0].dueAt)}`
        : `${todo.length} bài hạn nộp ngày mai: ${todo.map((a) => a.title).join(", ")}`;
    for (const to of tokensOf(u)) {
      messages.push({ to, title: "Bạn có bài tập cần làm!!", body: body.slice(0, 500), data: { type: "assignment", id: String(todo[0]._id) } });
    }
  }
  return messages;
}

async function runDailyReminders(now = Date.now()) {
  const { tomorrow } = vnNow(now);
  const schools = await School.find({ status: "active", vipUntil: { $gt: new Date() } });
  let sent = 0;
  for (const school of schools) {
    try {
      const users = await User.find({
        school: school._id,
        status: "active",
        role: { $in: [...LEARNERS, ...TEACHERS] },
        "pushTokens.0": { $exists: true },
      })
        .select("name role classId pushTokens")
        .populate("classId", "name");
      if (!users.length) continue;
      const messages = [...(await timetableMessages(school, users, tomorrow)), ...(await assignmentMessages(school, users, tomorrow))];
      await sendMessages(messages);
      sent += messages.length;
    } catch (err) {
      console.error(`Lỗi gửi nhắc 20h cho trường ${school._id}:`, err);
    }
  }
  return sent;
}

/** Mỗi phút kiểm tra 1 lần: từ 20h (giờ VN) chưa gửi hôm nay thì gửi. Server khởi động muộn (trước 23h) vẫn gửi bù. */
function startDailyReminders() {
  let running = false;
  const tick = async () => {
    const { key, hour } = vnNow();
    if (running || hour < SEND_HOUR || hour >= 23) return;
    running = true;
    try {
      await JobRun.create({ key: `reminders:${key}` }); // trùng khóa = đã gửi hôm nay
      const sent = await runDailyReminders();
      console.log(`🔔 Đã gửi ${sent} thông báo nhắc 20h ngày ${key}`);
    } catch (err) {
      if (err.code !== 11000) console.error("Lỗi tác vụ nhắc 20h:", err);
    } finally {
      running = false;
    }
  };
  tick();
  return setInterval(tick, CHECK_EVERY);
}

module.exports = { startDailyReminders, runDailyReminders, lessonsOn, vnNow };
