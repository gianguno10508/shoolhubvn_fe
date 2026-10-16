const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const School = require("../models/School");
const auth = require("../middleware/auth");
const loadUser = require("../middleware/loadUser");
const { ROLES } = require("../config/roles");
const { parseBirthDate } = require("../utils/accountName");

const router = express.Router();

function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "30d" });
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
    const user = await User.findOne({ username: (username || "").toLowerCase() }).select("+password");
    if (!user) return res.status(401).json({ error: "Sai username hoặc password." });

    const ok = await user.comparePassword(password || "");
    if (!ok) return res.status(401).json({ error: "Sai username hoặc password." });
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

router.post("/change-password", auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || String(newPassword).length < 6) {
      return res.status(400).json({ error: "Mật khẩu mới cần ít nhất 6 ký tự." });
    }
    const user = await User.findById(req.userId).select("+password");
    if (!user) return res.status(401).json({ error: "Không tìm thấy tài khoản." });
    if (!(await user.comparePassword(currentPassword || ""))) {
      return res.status(400).json({ error: "Mật khẩu hiện tại không đúng." });
    }
    if (currentPassword === newPassword) {
      return res.status(400).json({ error: "Mật khẩu mới phải khác mật khẩu hiện tại." });
    }
    user.password = newPassword;
    user.mustChangePassword = false;
    await user.save();
    res.json({ ok: true, user: await publicUser(user._id) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi máy chủ khi đổi mật khẩu." });
  }
});

module.exports = router;
