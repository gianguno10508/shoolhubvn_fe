import { useState, useRef, useEffect, useMemo } from "react";
import PanelTitle from "../common/PanelTitle";
import { getDays, getSessions, getTiets, slotKey, cellKey, parseCell } from "../../utils/helpers";

export default function TimetableView({
  config,
  classes,
  teachers,
  schedule,
  setSchedule,
  lessons,
  lessonById,
  effectiveSchedule,
  pinnedKeys,
  pinnedLessonIds,
  focusClassId,
  onClearFocus,
  onBack,
  constraints,
  onExport,
  onExportPerClass,
}) {
  const days = useMemo(() => getDays(config.soNgay), [config.soNgay]);
  const sessions = useMemo(() => getSessions(config.soBuoi), [config.soBuoi]);
  const tiets = useMemo(() => getTiets(config.soTiet), [config.soTiet]);
  const rowsPerDay = sessions.length * tiets.length;

  const [selectedId, setSelectedId] = useState(null);
  const [flash, setFlash] = useState("");
  const [flashType, setFlashType] = useState("ok");
  const [filterClass, setFilterClass] = useState("");
  const [filterTeacher, setFilterTeacher] = useState("");
  const [highlightClassId, setHighlightClassId] = useState(null);
  const thRefs = useRef({});

  const offByClass = useMemo(() => {
    const m = {};
    classes.forEach((c) => {
      m[c.id] = new Set(c.offSlots || []);
    });
    return m;
  }, [classes]);

  const placedIds = useMemo(
    () => new Set(Object.values(effectiveSchedule)),
    [effectiveSchedule],
  );
  const unscheduled = useMemo(
    () => lessons.filter((l) => !placedIds.has(l.id)),
    [lessons, placedIds],
  );

  /* Các ô đang thực sự trùng giáo viên trong lịch hiện tại — cả 2 (hoặc nhiều hơn) ô đều bị đánh dấu đỏ. */
  const dupKeys = useMemo(() => {
    const bySlotTeacher = {};
    Object.entries(effectiveSchedule).forEach(([key, lessonId]) => {
      const lesson = lessonById[lessonId];
      if (!lesson || !lesson.teacherId) return;
      const pos = parseCell(key);
      const groupKey = `${pos.slot}|${lesson.teacherId}`;
      (bySlotTeacher[groupKey] = bySlotTeacher[groupKey] || []).push(key);
    });
    const out = new Set();
    Object.values(bySlotTeacher).forEach((keys) => {
      if (keys.length > 1) keys.forEach((k) => out.add(k));
    });
    return out;
  }, [effectiveSchedule, lessonById]);

  const filteredUnscheduled = useMemo(
    () =>
      unscheduled.filter(
        (l) =>
          (!filterClass || l.classId === filterClass) &&
          (!filterTeacher || l.teacherId === filterTeacher),
      ),
    [unscheduled, filterClass, filterTeacher],
  );

  const selectedItem = selectedId ? lessonById[selectedId] || null : null;

  useEffect(() => {
    if (focusClassId && thRefs.current[focusClassId]) {
      thRefs.current[focusClassId].scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      });
      setFilterClass(focusClassId);
      setHighlightClassId(focusClassId);
      const t = setTimeout(() => {
        setHighlightClassId(null);
        onClearFocus();
      }, 1600);
      return () => clearTimeout(t);
    }
  }, [focusClassId]); // eslint-disable-line

  function showFlash(msg, type = "ok") {
    setFlash(msg);
    setFlashType(type);
    window.clearTimeout(showFlash._t);
    showFlash._t = window.setTimeout(() => setFlash(""), 2800);
  }

  async function handleExport() {
    try {
      showFlash(`Đã xuất file ${await onExport()}.`);
    } catch (err) {
      showFlash(
        "Không xuất được file Excel: " + (err?.message || "lỗi không xác định"),
        "error",
      );
    }
  }
  async function handleExportPerClass() {
    try {
      showFlash(`Đã xuất file ${await onExportPerClass()}.`);
    } catch (err) {
      showFlash(
        "Không xuất được file Excel: " + (err?.message || "lỗi không xác định"),
        "error",
      );
    }
  }

  function teacherBusy(day, session, tiet, tId, excludeKey) {
    if (!tId) return null;
    for (const [key, lessonId] of Object.entries(effectiveSchedule)) {
      if (key === excludeKey) continue;
      const pos = parseCell(key);
      const lesson = lessonById[lessonId];
      if (!lesson) continue;
      if (
        pos.day === day &&
        pos.session === session &&
        pos.tiet === String(tiet) &&
        lesson.teacherId === tId
      ) {
        const klass = classes.find((c) => c.id === pos.classId);
        return { klass: klass ? klass.name : "?" };
      }
    }
    return null;
  }

  /* Số tiết một lớp đã có trong đúng buổi này (không tính ô đang xét) — dùng để chặn theo Bước 8. */
  function classSessionLoad(day, session, classId, excludeKey) {
    return Object.keys(effectiveSchedule).filter((key) => {
      if (key === excludeKey) return false;
      const pos = parseCell(key);
      return (
        pos.day === day && pos.session === session && pos.classId === classId
      );
    }).length;
  }

  function handleCellClick(day, session, tiet, klass) {
    const slot = slotKey(day, session, tiet);
    const key = cellKey(day, session, tiet, klass.id);

    if (offByClass[klass.id] && offByClass[klass.id].has(slot)) {
      showFlash(
        `${klass.name} nghỉ tiết này theo khung chương trình.`,
        "error",
      );
      return;
    }
    if (pinnedKeys.has(key)) {
      showFlash(
        "Tiết cố định, không thể gỡ hay đổi chỗ. Muốn sửa hãy vào Khung CT của lớp.",
        "error",
      );
      return;
    }

    const occupantId = schedule[key];

    if (selectedItem) {
      if (selectedItem.classId !== klass.id) {
        showFlash(
          "Tiết này thuộc lớp khác, chỉ xếp được vào cột lớp của nó.",
          "error",
        );
        return;
      }
      if ((selectedItem.avoid || []).includes(slot)) {
        showFlash(
          `Vị trí này nằm trong danh sách tiết tránh của ${selectedItem.subjectName}.`,
          "error",
        );
        return;
      }

      const maxPerSession =
        Number(constraints.lopToiDaTietTrenBuoi) || tiets.length;
      const sessionLoad = classSessionLoad(day, session, klass.id, key);
      if (sessionLoad >= maxPerSession) {
        showFlash(
          `${klass.name} đã đạt tối đa ${maxPerSession} tiết trong buổi ${session} ${day}.`,
          "error",
        );
        return;
      }

      /* Trùng giáo viên: vẫn cho xếp, chỉ báo đỏ để người dùng tự cân nhắc. */
      const busy = teacherBusy(day, session, tiet, selectedItem.teacherId, key);
      if (busy) {
        showFlash(
          `Trùng lịch: ${selectedItem.teacherName} đang dạy lớp ${busy.klass} vào tiết ${tiet} ${session} ${day}. Đã xếp đè, hãy kiểm tra lại.`,
          "error",
        );
      } else {
        showFlash(
          `Đã xếp ${selectedItem.subjectName} vào ${klass.name} — ${day}, tiết ${tiet} ${session}.`,
        );
      }
      setSchedule((prev) => ({ ...prev, [key]: selectedItem.id }));
      setSelectedId(null);
      return;
    }

    if (occupantId) {
      const lesson = lessonById[occupantId];
      setSchedule((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      showFlash(
        `Đã gỡ ${lesson ? lesson.subjectName : "tiết"} khỏi ${klass.name} — ${day}, tiết ${tiet}.`,
      );
    }
  }

  function clearAll() {
    if (Object.keys(schedule).length === 0) {
      showFlash("Chỉ còn các tiết cố định, không gỡ được.", "error");
      return;
    }
    setSchedule({});
    setSelectedId(null);
    showFlash("Đã gỡ các tiết xếp tay. Tiết cố định vẫn giữ nguyên.");
  }

  /* ---------------------------------------------------------------------
   * Xếp tự động — tôn trọng "Cấu hình tiết liên tiếp" của từng phân công:
   * các tiết chưa xếp của cùng 1 phân công (assignment) được gom thành
   * từng cụm đúng bằng số tiết liên tiếp, rồi tìm một dải tiết LIỀN KỀ
   * nhau (cùng ngày, cùng buổi) còn trống để xếp cả cụm vào đó.
   * Nếu không tìm được vị trí liền kề cho cả cụm, sẽ xếp tạm từng tiết
   * lẻ (fallback) để không bỏ sót tiết nào.
   * ------------------------------------------------------------------- */
  function autoFill() {
    const next = { ...schedule };
    const working = { ...effectiveSchedule };
    let placed = 0;
    const maxPerSession =
      Number(constraints.lopToiDaTietTrenBuoi) || tiets.length;

    function sessionLoadOf(day, session, classId) {
      return Object.keys(working).filter((k) => {
        const pos = parseCell(k);
        return (
          pos.day === day && pos.session === session && pos.classId === classId
        );
      }).length;
    }

    function teacherBusyAtSlot(teacherId, slot) {
      if (!teacherId) return false;
      return Object.entries(working).some(([k, id]) => {
        const pos = parseCell(k);
        const l = lessonById[id];
        return l && l.teacherId === teacherId && pos.slot === slot;
      });
    }

    /* Lấy khoảng tiết [min, max] mà một phân công (assignmentId) đã CHIẾM
     * trong đúng buổi (day, session) này của lớp classId. Trả về null nếu
     * môn đó chưa có tiết nào trong buổi này. Dùng để đảm bảo mọi tiết của
     * cùng 1 môn trong cùng 1 buổi luôn nằm liền thành 1 khối duy nhất,
     * không bao giờ bị cách quãng (ví dụ không thể có tiết 1 và tiết 3 mà
     * bỏ trống tiết 2 ở giữa). */
    function getAssignmentRange(day, session, classId, assignmentId) {
      let min = null;
      let max = null;
      tiets.forEach((tiet) => {
        const key = cellKey(day, session, tiet, classId);
        const lesson = lessonById[working[key]];
        if (lesson && lesson.assignmentId === assignmentId) {
          if (min === null || tiet < min) min = tiet;
          if (max === null || tiet > max) max = tiet;
        }
      });
      return min === null ? null : { min, max };
    }

    /* Thử xếp 1 cụm (block) gồm 1 hoặc nhiều tiết liên tiếp vào 1 dải tiết
     * liền kề nhau trong cùng ngày, cùng buổi. Với block chỉ 1 tiết, hàm
     * này cũng chính là cách xếp "từng tiết lẻ".
     *
     * Luật CỨNG (luôn áp dụng, không tùy chọn): nếu buổi đó đã có tiết nào
     * của cùng phân công rồi, cụm mới CHỈ được xếp ngay sát khối đã có
     * (nối liền phía trước hoặc phía sau) — tuyệt đối không được xếp cách
     * quãng để bỏ trống 1 tiết ở giữa.
     *
     * Khi avoidAdjacent = true: nếu buổi đó đã có tiết của cùng phân công,
     * sẽ bỏ qua buổi này luôn (ưu tiên tìm 1 buổi hoàn toàn trống của môn
     * đó) để không vô tình nối dài vượt quá số tiết liên tiếp cấu hình.
     * Khi avoidAdjacent = false: cho phép nối liền vào khối đã có (dùng làm
     * phương án cuối khi hết chỗ trống khác). */
    function placeBlock(block, avoidAdjacent) {
      const classId = block[0].classId;
      const teacherId = block[0].teacherId;
      const assignmentId = block[0].assignmentId;
      const size = block.length;

      for (const day of days) {
        for (const session of sessions) {
          if (sessionLoadOf(day, session, classId) + size > maxPerSession)
            continue;

          const occ = getAssignmentRange(day, session, classId, assignmentId);

          for (let start = 0; start + size <= tiets.length; start += 1) {
            const tietSlice = tiets.slice(start, start + size);

            let ok = true;
            for (let i = 0; i < size; i += 1) {
              const tiet = tietSlice[i];
              const slot = slotKey(day, session, tiet);
              const key = cellKey(day, session, tiet, classId);
              if (working[key]) { ok = false; break; }
              if (offByClass[classId] && offByClass[classId].has(slot)) {
                ok = false;
                break;
              }
              if ((block[i].avoid || []).includes(slot)) { ok = false; break; }
              if (teacherBusyAtSlot(teacherId, slot)) { ok = false; break; }
            }
            if (!ok) continue;

            if (occ) {
              const touchesAfter = tietSlice[0] === occ.max + 1;
              const touchesBefore = tietSlice[size - 1] === occ.min - 1;
              // Cách quãng với khối đã có trong buổi này -> luôn từ chối.
              if (!touchesAfter && !touchesBefore) continue;
              // Liền kề với khối đã có -> chỉ chấp nhận ở lượt cho phép nối dài.
              if (avoidAdjacent) continue;
            }

            tietSlice.forEach((tiet, i) => {
              const key = cellKey(day, session, tiet, classId);
              working[key] = block[i].id;
              next[key] = block[i].id;
              placed += 1;
            });
            return true;
          }
        }
      }
      return false;
    }

    /* Gom các tiết chưa xếp theo từng phân công, giữ nguyên thứ tự xuất hiện */
    const groups = [];
    const groupIndex = {};
    unscheduled.forEach((lesson) => {
      const gId = lesson.assignmentId;
      if (!(gId in groupIndex)) {
        groupIndex[gId] = groups.length;
        groups.push([]);
      }
      groups[groupIndex[gId]].push(lesson);
    });

    groups.forEach((groupLessons) => {
      const lienTiep = Math.max(1, Number(groupLessons[0].tietLienTiep) || 1);
      let queue = groupLessons;

      while (queue.length > 0) {
        const size = Math.min(lienTiep, queue.length);
        const block = queue.slice(0, size);
        queue = queue.slice(size);

        const okBlock = placeBlock(block, true) || placeBlock(block, false);
        if (!okBlock) {
          // Không tìm được dải liền kề đủ chỗ cho cả cụm — xếp tạm từng tiết lẻ
          block.forEach((lesson) => {
            placeBlock([lesson], true) || placeBlock([lesson], false);
          });
        }
      }
    });

    setSchedule(next);
    showFlash(
      placed > 0
        ? `Đã xếp tự động ${placed} tiết.`
        : "Không còn chỗ trống phù hợp.",
      placed > 0 ? "ok" : "error",
    );
  }

  if (classes.length === 0 || lessons.length === 0) {
    return (
      <div className="panel">
        <PanelTitle title="Thời khóa biểu" />
        <p className="hint">
          {classes.length === 0
            ? "Chưa có lớp học. Hãy khai báo ở Bước 6."
            : "Chưa có tiết nào trong khung chương trình. Hãy mở Khung CT của lớp ở Bước 6 hoặc dùng Bước 7."}
        </p>
        <button className="btn btn-primary" onClick={onBack}>
          Quay lại các bước
        </button>
      </div>
    );
  }

  return (
    <div className="panel tt-panel">
      <div className="tt-head">
        <div>
          <h2>{config.tenTKB || "Thời khóa biểu"}</h2>
          <p className="tt-sub">
            {[config.tenTruong, config.namHoc].filter(Boolean).join(" - ")} —{" "}
            {placedIds.size} tiết đã xếp ({pinnedLessonIds.size} tiết cố định),{" "}
            {unscheduled.length} tiết chưa xếp.
          </p>
        </div>
        <div className="tt-tools">
          <span className={"flash " + flashType}>{flash}</span>
          <button className="btn btn-info btn-sm" onClick={autoFill}>
            Xếp tự động
          </button>
          <button className="btn btn-export btn-sm" onClick={handleExport}>
            Xuất Excel
          </button>
          <button
            className="btn btn-export btn-sm"
            onClick={handleExportPerClass}
          >
            Excel từng lớp
          </button>
          <button className="btn btn-danger btn-sm" onClick={clearAll}>
            Gỡ tiết xếp tay
          </button>
          <button className="btn btn-primary btn-sm" onClick={onBack}>
            Về các bước
          </button>
        </div>
      </div>

      <div className="tt-layout">
        <div className="tt-scroll">
          <table className="tt-grid">
            <thead>
              <tr>
                <th className="col-thu">Thứ</th>
                <th className="col-buoi">Buổi</th>
                <th className="col-tiet">Tiết</th>
                {classes.map((c) => (
                  <th
                    key={c.id}
                    ref={(el) => {
                      thRefs.current[c.id] = el;
                    }}
                    className={highlightClassId === c.id ? "hl" : ""}
                  >
                    {c.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {days.map((day, di) => {
                let dayDone = false;
                return sessions.map((session) =>
                  tiets.map((tiet, ti) => {
                    const firstOfDay = !dayDone;
                    if (firstOfDay) dayDone = true;
                    const slot = slotKey(day, session, tiet);
                    return (
                      <tr
                        key={`${day}-${session}-${tiet}`}
                        className={ti === 0 ? "sess-start" : ""}
                      >
                        {firstOfDay && (
                          <td className="cell-thu" rowSpan={rowsPerDay}>
                            {di === 6 ? "CN" : di + 2}
                          </td>
                        )}
                        {ti === 0 && (
                          <td className="cell-buoi" rowSpan={tiets.length}>
                            {session}
                          </td>
                        )}
                        <td className="cell-tiet">{tiet}</td>
                        {classes.map((c) => {
                          const key = cellKey(day, session, tiet, c.id);
                          const lesson = lessonById[effectiveSchedule[key]];
                          const isPinned = pinnedKeys.has(key);
                          const isOff =
                            offByClass[c.id] && offByClass[c.id].has(slot);
                          const isDup = dupKeys.has(key);
                          let cls = "cell";
                          if (isOff) cls += " off";
                          else if (isDup) cls += " dup";
                          else if (isPinned) cls += " pinned";
                          else if (selectedItem && !lesson) {
                            if (selectedItem.classId !== c.id)
                              cls += " blocked";
                            else if (
                              (selectedItem.avoid || []).includes(slot) ||
                              teacherBusy(
                                day,
                                session,
                                tiet,
                                selectedItem.teacherId,
                                key,
                              )
                            )
                              cls += " conflict";
                            else cls += " can-drop";
                          }
                          if (isDup && isPinned) cls += " pinned";
                          return (
                            <td
                              key={key}
                              className={cls}
                              onClick={() =>
                                handleCellClick(day, session, tiet, c)
                              }
                              title={
                                isDup
                                  ? `${lesson ? lesson.teacherName : ""} bị trùng lịch ở tiết này — kiểm tra lại.`
                                  : undefined
                              }
                            >
                              {isOff ? (
                                <span className="lesson muted">Nghỉ</span>
                              ) : lesson ? (
                                <span className="lesson">
                                  {isPinned && <span className="lock">🔒</span>}
                                  {isDup && <span className="dup-mark">⚠</span>}
                                  {lesson.subjectName}
                                  {lesson.teacherName
                                    ? ` - ${lesson.teacherName}`
                                    : ""}
                                </span>
                              ) : null}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  }),
                );
              })}
            </tbody>
          </table>
        </div>

        <aside className="tt-side">
          <h3>CÁC TIẾT CHƯA ĐƯỢC XẾP ({unscheduled.length})</h3>
          <p className="side-note">
            Chọn một tiết rồi bấm vào ô trống trong bảng để xếp. Ô có 🔒 là tiết
            cố định. Ô báo đỏ là trùng giáo viên — vẫn xếp được nhưng nên kiểm
            tra lại.
          </p>
          <div className="side-filters">
            <label>
              Lớp
              <select
                value={filterClass}
                onChange={(e) => setFilterClass(e.target.value)}
              >
                <option value="">Tất cả</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Giáo viên
              <select
                value={filterTeacher}
                onChange={(e) => setFilterTeacher(e.target.value)}
              >
                <option value="">Tất cả</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.short}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="side-list">
            {filteredUnscheduled.length === 0 && (
              <div className="empty">
                Không còn tiết nào chưa xếp trong bộ lọc này.
              </div>
            )}
            {filteredUnscheduled.map((l) => {
              const klass = classes.find((c) => c.id === l.classId);
              return (
                <button
                  key={l.id}
                  className={
                    "side-pill" + (selectedId === l.id ? " selected" : "")
                  }
                  onClick={() =>
                    setSelectedId((prev) => (prev === l.id ? null : l.id))
                  }
                >
                  {l.subjectName}
                  {l.teacherName ? ` - ${l.teacherName}` : ""} -{" "}
                  {klass ? klass.name : "?"}
                </button>
              );
            })}
          </div>
        </aside>
      </div>
    </div>
  );
}
