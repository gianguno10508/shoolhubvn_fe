// utils/scheduler.js — xếp thời khóa biểu tự động
/* Cách làm:
 *  1. Gom các tiết chưa xếp của mỗi phân công thành từng cụm bằng "số tiết liên tiếp".
 *  2. Xếp lần lượt cụm khó trước (GV dạy nhiều tiết, cụm dài, ít chỗ đặt được), mỗi cụm chọn vị trí
 *     có điểm phạt thấp nhất. Luật cứng: không trùng lớp, không trùng GV, không vào tiết nghỉ / tiết tránh,
 *     không vượt số tiết tối đa của lớp trong buổi, các tiết cùng môn trong 1 buổi phải liền nhau.
 *     Điểm phạt (mềm): tiết trống xen giữa / đầu buổi, cùng môn 2 lần trong 1 ngày, lớp học dồn vào 1 ngày,
 *     môn chính buổi chiều, Chào cờ không ở tiết 1 sáng thứ 2, SHL không ở cuối tuần.
 *  3. Cụm không còn chỗ: thử gỡ 1 cụm đang chặn, đặt cụm này vào rồi xếp lại cụm vừa gỡ sang chỗ khác.
 *  4. Lặp lại nhiều lần với thứ tự ngẫu nhiên khác nhau trong thời gian cho phép, giữ phương án tốt nhất. */

import { getDays, getSessions, getTiets, cellKey, slotKey } from "./helpers";

const CHAO_CO = /chào\s*cờ/i;
const SHL = /^(shl|shcn|sinh\s*hoạt(\s*lớp)?)$/i;

const W = {
  gap: 12, // mỗi tiết trống xen giữa trong buổi
  lead: 4, // mỗi tiết trống ở đầu buổi
  sameDay: 30, // cùng môn đã có ở buổi khác trong ngày
  sameSession: 45, // nối dài khối cùng môn trong buổi
  dayOver: 6, // mỗi tiết vượt mức trung bình / ngày của lớp
  teacherDay: 0.4, // GV dạy nhiều tiết trong ngày
  afternoon: 2, // mỗi tiết buổi chiều (ưu tiên lấp kín buổi sáng trước)
  mainAfternoon: 6,
  chaoCo: 500,
  shl: 3,
};

/**
 * @param {object} p
 * @param {object} p.config, p.constraints
 * @param {object[]} p.classes
 * @param {object[]} p.lessons — tất cả tiết (từ khung chương trình)
 * @param {Record<string,string>} p.base — các ô giữ nguyên (cellKey → lessonId): tiết cố định (+ tiết đã xếp tay)
 * @param {Record<string,object>} p.lessonById
 * @param {number} [p.timeBudget] — mili giây
 * @returns {{ placements: Record<string,string>, placed: number, total: number, unplaced: object[], gaps: number }}
 */
export function autoSchedule({ config, constraints, classes, lessons, base, lessonById, timeBudget = 1500 }) {
  const days = getDays(config.soNgay);
  const sessions = getSessions(config.soBuoi);
  const tiets = getTiets(config.soTiet);
  const D = days.length;
  const S = sessions.length;
  const T = tiets.length;
  const SLOTS = D * S * T;
  const maxPer = Math.min(T, Math.max(1, Number(constraints.lopToiDaTietTrenBuoi) || T));
  const compact = constraints.khongTietTrong !== false;
  const chaoCoRule = !!constraints.chaoCoTiet1Thu2;
  const mainMorning = !!constraints.uuTienMonChinhBuoiSang && S === 2;
  const gapW = compact ? W.gap : 2;
  const leadW = compact ? W.lead : 1;

  const classIdx = new Map(classes.map((c, i) => [c.id, i]));
  const slotIdx = new Map();
  days.forEach((dl, d) =>
    sessions.forEach((sl, s) => tiets.forEach((tl, t) => slotIdx.set(slotKey(dl, sl, tl), (d * S + s) * T + t))),
  );
  const slotParts = (slot) => ({ d: Math.floor(slot / (S * T)), s: Math.floor(slot / T) % S, t: slot % T });

  const off = classes.map((c) => {
    const a = new Uint8Array(SLOTS);
    (c.offSlots || []).forEach((k) => slotIdx.has(k) && (a[slotIdx.get(k)] = 1));
    return a;
  });

  /* ---- ô giữ nguyên ---- */
  const fixedCells = [];
  const fixedIds = new Set();
  Object.entries(base).forEach(([key, id]) => {
    const [day, session, tiet, classId] = key.split("|");
    const c = classIdx.get(classId);
    const slot = slotIdx.get(slotKey(day, session, tiet));
    const lesson = lessonById[id];
    if (c === undefined || slot === undefined || !lesson) return;
    fixedCells.push({ c, slot, lesson });
    fixedIds.add(id);
  });

  /* ---- cụm cần xếp ---- */
  const groups = new Map();
  lessons.forEach((l) => {
    if (fixedIds.has(l.id) || !classIdx.has(l.classId)) return;
    if (!groups.has(l.assignmentId)) groups.set(l.assignmentId, []);
    groups.get(l.assignmentId).push(l);
  });
  const teacherLoad = new Map();
  lessons.forEach((l) => l.teacherId && teacherLoad.set(l.teacherId, (teacherLoad.get(l.teacherId) || 0) + 1));
  const classTotal = new Array(classes.length).fill(0);
  lessons.forEach((l) => classIdx.has(l.classId) && (classTotal[classIdx.get(l.classId)] += 1));
  const dayTarget = classTotal.map((n) => Math.ceil(n / D));

  const blocks = [];
  groups.forEach((list) => {
    const size = Math.min(Math.max(1, list[0].tietLienTiep || 1), maxPer);
    const name = list[0].subjectFullName || list[0].subjectName || "";
    const kind = CHAO_CO.test(name) ? "chaoco" : SHL.test(name.trim()) ? "shl" : null;
    for (let i = 0; i < list.length; i += size) {
      const part = list.slice(i, i + size);
      blocks.push({
        id: blocks.length,
        lessons: part,
        size: part.length,
        c: classIdx.get(part[0].classId),
        teacherId: part[0].teacherId || "",
        assignmentId: part[0].assignmentId,
        avoid: new Set((part[0].avoid || []).map((k) => slotIdx.get(k)).filter((x) => x !== undefined)),
        kind,
        main: !!part[0].main,
      });
    }
  });

  // Số vị trí đặt được nếu lịch trống — cụm càng ít chỗ càng xếp trước
  blocks.forEach((b) => {
    let n = 0;
    for (let d = 0; d < D; d++)
      for (let s = 0; s < S; s++)
        for (let t = 0; t + b.size <= T; t++) {
          let ok = true;
          for (let k = 0; k < b.size && ok; k++) {
            const slot = (d * S + s) * T + t + k;
            if (off[b.c][slot] || b.avoid.has(slot)) ok = false;
          }
          if (ok) n++;
        }
    b.options = n;
    b.priority = n * 2 - (teacherLoad.get(b.teacherId) || 0) - b.size * 4 - (b.kind === "chaoco" ? 1000 : 0);
  });

  /* ---- trạng thái của 1 lần xếp ---- */
  function newState() {
    const st = {
      cell: classes.map(() => new Array(SLOTS).fill(null)), // lesson | null
      cellBlock: classes.map(() => new Int32Array(SLOTS).fill(-1)), // id cụm (-1: trống / ô giữ nguyên)
      teacher: new Map(), // teacherId → Int32Array(SLOTS): id cụm + 2, 1 = ô giữ nguyên, 0 = rảnh
      sess: classes.map(() => new Uint8Array(D * S)),
      day: classes.map(() => new Uint8Array(D)),
      assign: new Map(), // assignmentId → Uint8Array(D * S)
      pos: new Map(), // id cụm → slot bắt đầu
    };
    fixedCells.forEach(({ c, slot, lesson }) => {
      const { d, s } = slotParts(slot);
      st.cell[c][slot] = lesson;
      st.sess[c][d * S + s] += 1;
      st.day[c][d] += 1;
      if (lesson.teacherId) teacherArr(st, lesson.teacherId)[slot] = 1;
      assignArr(st, lesson.assignmentId)[d * S + s] += 1;
    });
    return st;
  }
  function teacherArr(st, id) {
    if (!st.teacher.has(id)) st.teacher.set(id, new Int32Array(SLOTS));
    return st.teacher.get(id);
  }
  function assignArr(st, id) {
    if (!st.assign.has(id)) st.assign.set(id, new Uint8Array(D * S));
    return st.assign.get(id);
  }

  function put(st, b, start) {
    const { d, s } = slotParts(start);
    const ta = b.teacherId ? teacherArr(st, b.teacherId) : null;
    for (let k = 0; k < b.size; k++) {
      st.cell[b.c][start + k] = b.lessons[k];
      st.cellBlock[b.c][start + k] = b.id;
      if (ta) ta[start + k] = b.id + 2;
    }
    st.sess[b.c][d * S + s] += b.size;
    st.day[b.c][d] += b.size;
    assignArr(st, b.assignmentId)[d * S + s] += b.size;
    st.pos.set(b.id, start);
  }
  function remove(st, b) {
    const start = st.pos.get(b.id);
    const { d, s } = slotParts(start);
    const ta = b.teacherId ? teacherArr(st, b.teacherId) : null;
    for (let k = 0; k < b.size; k++) {
      st.cell[b.c][start + k] = null;
      st.cellBlock[b.c][start + k] = -1;
      if (ta) ta[start + k] = 0;
    }
    st.sess[b.c][d * S + s] -= b.size;
    st.day[b.c][d] -= b.size;
    assignArr(st, b.assignmentId)[d * S + s] -= b.size;
    st.pos.delete(b.id);
  }

  /** Tiết trống xen giữa và trống đầu buổi của 1 lớp (bỏ qua tiết nghỉ) */
  function holes(st, c, ds, extraFrom = -1, extraSize = 0) {
    const first = ds * T;
    let lead = 0;
    let gaps = 0;
    let seen = false;
    let pending = 0;
    for (let t = 0; t < T; t++) {
      const slot = first + t;
      if (off[c][slot]) continue;
      const filled = st.cell[c][slot] !== null || (slot >= extraFrom && slot < extraFrom + extraSize);
      if (filled) {
        if (seen) gaps += pending;
        seen = true;
        pending = 0;
      } else if (seen) pending++;
      else lead++;
    }
    return seen ? { gaps, lead } : { gaps: 0, lead: 0 };
  }

  /** Điểm phạt khi đặt cụm b bắt đầu ở start; Infinity = không được đặt */
  function cost(st, b, start) {
    const { d, s, t } = slotParts(start);
    if (t + b.size > T) return Infinity;
    const ds = d * S + s;
    if (st.sess[b.c][ds] + b.size > maxPer) return Infinity;
    const ta = b.teacherId ? st.teacher.get(b.teacherId) : null;
    for (let k = 0; k < b.size; k++) {
      const slot = start + k;
      if (st.cell[b.c][slot] !== null || off[b.c][slot] || b.avoid.has(slot)) return Infinity;
      if (ta && ta[slot]) return Infinity;
    }

    let score = 0;
    const aa = st.assign.get(b.assignmentId);
    if (aa) {
      if (aa[ds]) {
        // Cùng môn trong buổi: chỉ được nối liền khối đã có
        const before = t > 0 && st.cell[b.c][start - 1]?.assignmentId === b.assignmentId;
        const after = t + b.size < T && st.cell[b.c][start + b.size]?.assignmentId === b.assignmentId;
        if (!before && !after) return Infinity;
        score += W.sameSession;
      }
      for (let ss = 0; ss < S; ss++) if (ss !== s && aa[d * S + ss]) score += W.sameDay;
    }

    const now = holes(st, b.c, ds);
    const next = holes(st, b.c, ds, start, b.size);
    score += (next.gaps - now.gaps) * gapW + (next.lead - now.lead) * leadW;

    const over = st.day[b.c][d] + b.size - dayTarget[b.c];
    if (over > 0) score += over * W.dayOver;

    if (ta) {
      let n = 0;
      for (let x = d * S * T; x < (d + 1) * S * T; x++) if (ta[x]) n++;
      score += n * W.teacherDay;
    }
    if (s > 0) score += b.size * W.afternoon;
    if (mainMorning && b.main && s > 0) score += W.mainAfternoon;
    if (b.kind === "chaoco" && chaoCoRule && start !== 0) score += W.chaoCo;
    if (b.kind === "shl") score += (D - 1 - d) * W.shl;
    return score;
  }

  function bestStart(st, b, noise, skip = -1) {
    let best = -1;
    let bestScore = Infinity;
    for (let start = 0; start < SLOTS; start++) {
      if (start === skip) continue;
      const sc = cost(st, b, start);
      if (sc === Infinity) continue;
      const v = sc + (noise ? Math.random() * noise : 0);
      if (v < bestScore) {
        bestScore = v;
        best = start;
      }
    }
    return best;
  }

  /** Cụm không còn chỗ: gỡ 1 cụm đang chặn ở vị trí nào đó, đặt cụm này vào, xếp lại cụm bị gỡ */
  function repair(st, b) {
    const tried = new Set();
    for (let start = 0; start < SLOTS; start++) {
      const { t } = slotParts(start);
      if (t + b.size > T) continue;
      // Tìm đúng 1 cụm chặn (cùng lớp hoặc cùng GV)
      let blocker = -2;
      let bad = false;
      const ta = b.teacherId ? st.teacher.get(b.teacherId) : null;
      for (let k = 0; k < b.size && !bad; k++) {
        const slot = start + k;
        if (off[b.c][slot] || b.avoid.has(slot)) bad = true;
        const ids = [];
        if (st.cell[b.c][slot] !== null) ids.push(st.cellBlock[b.c][slot]);
        if (ta && ta[slot]) ids.push(ta[slot] - 2);
        for (const id of ids) {
          if (id < 0) bad = true; // ô giữ nguyên
          else if (blocker === -2) blocker = id;
          else if (blocker !== id) bad = true;
        }
      }
      if (bad || blocker < 0 || tried.has(`${blocker}|${start}`)) continue;
      tried.add(`${blocker}|${start}`);

      const other = blocks[blocker];
      const otherStart = st.pos.get(other.id);
      remove(st, other);
      if (cost(st, b, start) !== Infinity) {
        put(st, b, start);
        const alt = bestStart(st, other, 0);
        if (alt >= 0) {
          put(st, other, alt);
          return true;
        }
        remove(st, b);
      }
      put(st, other, otherStart);
    }
    return false;
  }

  function evaluate(st, unplacedCount) {
    let score = unplacedCount * 10000;
    let gaps = 0;
    for (let c = 0; c < classes.length; c++) {
      for (let ds = 0; ds < D * S; ds++) {
        const h = holes(st, c, ds);
        gaps += h.gaps;
        score += h.gaps * gapW + h.lead * leadW;
      }
      for (let d = 0; d < D; d++) {
        const over = st.day[c][d] - dayTarget[c];
        if (over > 0) score += over * W.dayOver;
      }
    }
    st.assign.forEach((arr) => {
      for (let d = 0; d < D; d++) {
        let sessionsUsed = 0;
        for (let s = 0; s < S; s++) if (arr[d * S + s]) sessionsUsed++;
        if (sessionsUsed > 1) score += (sessionsUsed - 1) * W.sameDay;
      }
    });
    return { score, gaps };
  }

  /* ---- chạy nhiều lần, giữ phương án tốt nhất ---- */
  const deadline = Date.now() + timeBudget;
  let best = null;
  for (let run = 0; run < 200; run++) {
    if (run > 0 && Date.now() > deadline) break;
    const st = newState();
    const jitter = run === 0 ? 0 : 6;
    const order = blocks
      .map((b) => ({ b, key: b.priority + Math.random() * jitter * 3 }))
      .sort((x, y) => x.key - y.key)
      .map((x) => x.b);
    const failed = [];
    for (const b of order) {
      const start = bestStart(st, b, jitter);
      if (start >= 0) put(st, b, start);
      else failed.push(b);
    }
    const unplaced = failed.filter((b) => !repair(st, b));
    const { score, gaps } = evaluate(st, unplaced.reduce((n, b) => n + b.size, 0));
    if (!best || score < best.score) best = { score, gaps, st, unplaced };
    if (blocks.length === 0) break;
  }

  const placements = {};
  let placed = 0;
  if (best) {
    best.st.pos.forEach((start, id) => {
      const b = blocks[id];
      for (let k = 0; k < b.size; k++) {
        const { d, s, t } = slotParts(start + k);
        placements[cellKey(days[d], sessions[s], tiets[t], classes[b.c].id)] = b.lessons[k].id;
        placed++;
      }
    });
  }
  return {
    placements,
    placed,
    total: blocks.reduce((n, b) => n + b.size, 0),
    unplaced: best ? best.unplaced.flatMap((b) => b.lessons) : [],
    gaps: best ? best.gaps : 0,
  };
}
