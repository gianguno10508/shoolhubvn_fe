const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const School = require("../models/School");
const auth = require("../middleware/auth");
const loadUser = require("../middleware/loadUser");
const { ROLES } = require("../config/roles");
const { parseBirthDate } = require("../utils/accountName");
const { passwordError } = require("../utils/passwordPolicy");
const { createLimiter, clientIp } = require("../middleware/rateLimit");
const { isPushToken } = require("../utils/push");

const router = express.Router();

// Sai mật khẩu 5 lần trong 15 phút (cùng IP + tài khoản) → khóa thử 15 phút; 1 IP tối đa 30 lần sai / 15 phút
const loginByAccount = createLimiter({ max: 5, windowMs: 15 * 60 * 1000 });
const loginByIp = createLimiter({ max: 30, windowMs: 15 * 60 * 1000 });
// Đăng ký: mỗi IP tối đa 5 tài khoản / giờ; đổi mật khẩu: sai mật khẩu cũ tối đa 5 lần / 15 phút
const registerByIp = createLimiter({ max: 5, windowMs: 60 * 60 * 1000 });
const changeByUser = createLimiter({ max: 5, windowMs: 15 * 60 * 1000 });

const waitMessage = (s) => `Thử quá nhiều lần, vui lòng thử lại sau ${Math.ceil(s / 60)} phút.`;

// So sánh với 1 hash giả khi không có tài khoản: thời gian phản hồi như nhau, không dò được username nào tồn tại
let dummyHash = null;
const dummyCompare = async (password) => {
  dummyHash = dummyHash || (await bcrypt.hash("dummy-password", 12));
  await bcrypt.compare(password, dummyHash);
  return false;
};

function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "30d", algorithm: "HS256" });
}

async function publicUser(userId) {
  const user = await User.findById(userId).populate("school").populate("classId");
  return user.toPublicJSON();
}

/* Đăng ký = tạo 1 trường mới + tài khoản chính (school_admin) của trường đó.
 * Các tài khoản khác trong trường do tài khoản chính (khi còn VIP) tạo ra. */
router.post("/register", async (req, res) => {
  let school = null;
  try {
    const { username, password, name, schoolName } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Thiếu username hoặc password." });
    }
    const ip = clientIp(req);
    const wait = registerByIp.check(ip);
    if (wait) return res.status(429).json({ error: waitMessage(wait) });
    if (!/^[a-zA-Z0-9._-]{3,40}$/.test(String(username))) {
      return res.status(400).json({ error: "Tên đăng nhập 3–40 ký tự, chỉ gồm chữ không dấu, số và . _ -" });
    }
    const weak = passwordError(password, username);
    if (weak) return res.status(400).json({ error: weak });
    const existed = await User.findOne({ username: username.toLowerCase() });
    if (existed) return res.status(409).json({ error: "Username này đã tồn tại." });

    // Tài khoản đầu tiên của hệ thống là admin hệ thống, không gắn trường
    const isFirstUser = (await User.countDocuments()) === 0;
    if (!isFirstUser && !(schoolName || "").trim()) {
      return res.status(400).json({ error: "Vui lòng nhập tên trường." });
    }

    if (!isFirstUser) {
      school = await School.create({ name: schoolName.trim() });
    }
    const user = await User.create({
      username,
      password,
      name,
      school: school ? school._id : null,
      role: isFirstUser ? ROLES.ADMIN : ROLES.SCHOOL_ADMIN,
    });
    if (school) {
      school.owner = user._id;
      await school.save();
    }
    registerByIp.fail(ip); // đếm số tài khoản đã tạo từ IP này

    res.json({ token: signToken(user._id), user: await publicUser(user._id) });
  } catch (err) {
    if (school) await School.deleteOne({ _id: school._id }).catch(() => {});
    console.error(err);
    res.status(500).json({ error: "Lỗi máy chủ khi đăng ký." });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const name = String(username || "").toLowerCase().slice(0, 100);
    const ip = clientIp(req);
    const key = `${ip}|${name}`;
    const wait = Math.max(loginByAccount.check(key), loginByIp.check(ip));
    if (wait) return res.status(429).json({ error: waitMessage(wait) });

    const user = await User.findOne({ username: name }).select("+password");
    const ok = user ? await user.comparePassword(String(password || "")) : await dummyCompare(String(password || ""));
    if (!ok) {
      loginByAccount.fail(key);
      loginByIp.fail(ip);
      return res.status(401).json({ error: "Sai username hoặc password." });
    }
    loginByAccount.reset(key);
    if (user.status === "locked") return res.status(403).json({ error: "Tài khoản đã bị khóa." });

    res.json({ token: signToken(user._id), user: await publicUser(user._id) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi máy chủ khi đăng nhập." });
  }
});

router.get("/me", auth, loadUser, (req, res) => {
  res.json(req.currentUser.toPublicJSON());
});

/* Người dùng tự sửa thông tin cá nhân (tên đăng nhập, chức danh, lớp do nhà trường quản lý) */
router.patch("/me", auth, loadUser, async (req, res) => {
  try {
    const user = req.currentUser;
    for (const f of ["name", "email", "phone"]) {
      if (req.body[f] !== undefined) user[f] = String(req.body[f] || "").trim();
    }
    if (req.body.birthDate !== undefined) {
      if (!req.body.birthDate) user.birthDate = null;
      else {
        const date = parseBirthDate(req.body.birthDate);
        if (!date) return res.status(400).json({ error: "Ngày sinh không hợp lệ." });
        user.birthDate = date;
      }
    }
    if (!user.name) return res.status(400).json({ error: "Họ và tên không được để trống." });
    if (user.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email)) {
      return res.status(400).json({ error: "Email không hợp lệ." });
    }
    await user.save();
    res.json(user.toPublicJSON());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi máy chủ khi cập nhật thông tin." });
  }
});

/* App điện thoại: đăng ký / gỡ Expo push token để nhận thông báo đẩy.
 * 1 điện thoại chỉ gắn với tài khoản đăng nhập gần nhất (đổi tài khoản thì token chuyển sang tài khoản mới). */
router.post("/push-token", auth, loadUser, async (req, res) => {
  try {
    const token = String(req.body.token || "");
    if (!isPushToken(token)) return res.status(400).json({ error: "Push token không hợp lệ." });
    await User.updateMany({ pushTokens: token, _id: { $ne: req.userId } }, { $pull: { pushTokens: token } });
    await User.updateOne({ _id: req.userId }, { $addToSet: { pushTokens: token } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi máy chủ khi đăng ký thông báo." });
  }
});

router.post("/push-token/remove", auth, async (req, res) => {
  try {
    await User.updateOne({ _id: req.userId }, { $pull: { pushTokens: String(req.body.token || "") } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi máy chủ." });
  }
});

router.post("/change-password", auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.userId).select("+password");
    if (!user) return res.status(401).json({ error: "Không tìm thấy tài khoản." });
    if (user.passwordChangedAt && req.tokenIssuedAt < user.passwordChangedAt.getTime() - 1000) {
      return res.status(401).json({ error: "Mật khẩu đã được thay đổi, vui lòng đăng nhập lại.", code: "PASSWORD_CHANGED" });
    }
    const weak = passwordError(newPassword, user.username);
    if (weak) return res.status(400).json({ error: weak });

    const key = String(user._id);
    const wait = changeByUser.check(key);
    if (wait) return res.status(429).json({ error: waitMessage(wait) });
    if (!(await user.comparePassword(String(currentPassword || "")))) {
      changeByUser.fail(key);
      return res.status(400).json({ error: "Mật khẩu hiện tại không đúng." });
    }
    changeByUser.reset(key);
    if (currentPassword === newPassword) {
      return res.status(400).json({ error: "Mật khẩu mới phải khác mật khẩu hiện tại." });
    }
    user.password = newPassword;
    user.mustChangePassword = false;
    await user.save();
    // Các phiên đăng nhập cũ (máy khác) bị đăng xuất; phiên hiện tại nhận token mới
    res.json({ ok: true, token: signToken(user._id), user: await publicUser(user._id) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi máy chủ khi đổi mật khẩu." });
  }
});

module.exports = router;
