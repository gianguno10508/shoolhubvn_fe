// pages/discipline/ScoreTab.jsx
import { useEffect, useMemo, useState } from "react";
import { deleteDisciplineRecord, listDisciplineRecords, saveDisciplineRecord } from "../../api/discipline";
import { listClasses } from "../../api/school";
import { formatPoints, splitNames, today, viDate, weekdayName } from "./disciplineUtils";

/* Chấm thi đua: 1 phiếu cho 1 lớp trong 1 ngày (Cờ đỏ, Đoàn thanh niên) */
export default function ScoreTab({ user, config, showToast }) {
  const [date, setDate] = useState(today());
  const [classes, setClasses] = useState([]);
  const [records, setRecords] = useState([]);
  const [classId, setClassId] = useState("");
  const [values, setValues] = useState({}); // itemId -> { checked, quantity, names, note }
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const isRedFlag = user?.role === "red_flag";
  const ownClass = String(user?.classId || "");

  useEffect(() => {
    listClasses()
      .then(setClasses)
      .catch((err) => showToast(err.message || "Không tải được danh sách lớp.", true));
  }, [showToast]);

  function loadDay() {
    return listDisciplineRecords({ date })
      .then(setRecords)
      .catch((err) => showToast(err.message || "Không tải được phiếu chấm.", true));
  }

  useEffect(() => {
    loadDay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const recordBy = useMemo(() => new Map(records.map((r) => [String(r.classId), r])), [records]);

  // Chọn lớp: nạp lại phiếu đã chấm (nếu có)
  useEffect(() => {
    const r = recordBy.get(classId);
    const next = {};
    for (const e of r?.entries || []) {
      next[e.itemId] = {
        checked: true,
        quantity: e.quantity,
        names: e.studentNames.join(", "),
        note: e.note,
      };
    }
    setValues(next);
    setNote(r?.note || "");
  }, [classId, recordBy]);

  const activeCategories = config.categories
    .filter((c) => c.active)
    .map((c) => ({ ...c, items: c.items.filter((i) => i.active) }))
    .filter((c) => c.items.length);

  const setValue = (itemId, patch) => setValues((prev) => ({ ...prev, [itemId]: { ...prev[itemId], ...patch } }));

  function quantityOf(item) {
    const v = values[item.id] || {};
    if (item.inputType === "checkbox") return v.checked ? 1 : 0;
    if (item.inputType === "count") return Math.max(0, Math.floor(Number(v.quantity) || 0));
    return splitNames(v.names).length;
  }

  const totals = useMemo(() => {
    let penalty = 0;
    let bonus = 0;
    for (const c of activeCategories) {
      for (const i of c.items) {
        const n = quantityOf(i) * i.points;
        if (i.kind === "penalty") penalty += n;
        else bonus += n;
      }
    }
    return { penalty, bonus };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, config]);

  async function save() {
    if (!classId) return;
    setBusy(true);
    try {
      const entries = activeCategories.flatMap((c) =>
        c.items
          .filter((i) => quantityOf(i) > 0)
          .map((i) => {
            const v = values[i.id] || {};
            return {
              itemId: i.id,
              checked: !!v.checked,
              quantity: Number(v.quantity) || 0,
              studentNames: splitNames(v.names),
              note: v.note || "",
            };
          }),
      );
      await saveDisciplineRecord(classId, date, entries, note);
      const cls = classes.find((c) => c.id === classId);
      showToast(`Đã lưu phiếu chấm lớp ${cls?.name || ""} ngày ${viDate(date)}.`);
      await loadDay();
      // Chuyển sang lớp kế tiếp chưa chấm cho nhanh
      const next = classes.find((c) => c.id !== classId && !recordBy.has(c.id) && !(isRedFlag && c.id === ownClass));
      if (next) setClassId(next.id);
    } catch (err) {
      showToast(err.message || "Không lưu được phiếu chấm.", true);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    const cls = classes.find((c) => c.id === classId);
    if (!window.confirm(`Xóa phiếu chấm lớp ${cls?.name} ngày ${viDate(date)}?`)) return;
    setBusy(true);
    try {
      await deleteDisciplineRecord(classId, date);
      showToast("Đã xóa phiếu chấm.");
      await loadDay();
    } catch (err) {
      showToast(err.message || "Không xóa được.", true);
    } finally {
      setBusy(false);
    }
  }

  const current = recordBy.get(classId);
  const doneCount = classes.filter((c) => recordBy.has(c.id)).length;

  return (
    <div className="dc-score-layout">
      {/* ----- Chọn ngày + lớp ----- */}
      <aside className="dc-score-side">
        <label className="field">
          <span>Ngày chấm</span>
          <input type="date" value={date} max={today()} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </label>
        <p className="dc-side-note">
          {weekdayName(date)} · đã chấm {doneCount}/{classes.length} lớp
        </p>
        <div className="dc-class-list">
          {classes.map((c) => {
            const r = recordBy.get(c.id);
            const disabled = isRedFlag && c.id === ownClass;
            return (
              <button
                key={c.id}
                type="button"
                disabled={disabled}
                title={disabled ? "Cờ đỏ không chấm lớp của mình" : ""}
                className={"dc-class" + (classId === c.id ? " active" : "") + (r ? " done" : "")}
                onClick={() => setClassId(c.id)}
              >
                <strong>{c.name}</strong>
                <small>
                  {disabled
                    ? "Lớp của bạn"
                    : r
                      ? r.totalPenalty || r.totalBonus
                        ? `−${formatPoints(r.totalPenalty)}${r.totalBonus ? ` +${formatPoints(r.totalBonus)}` : ""}`
                        : "Không vi phạm"
                      : "Chưa chấm"}
                </small>
              </button>
            );
          })}
        </div>
      </aside>

      {/* ----- Phiếu chấm ----- */}
      <section className="dc-sheet">
        {!classId ? (
          <div className="as-empty">
            <span>👈</span>
            <strong>Chọn lớp để chấm</strong>
            <p>Lớp đã chấm có dấu xanh. Có thể chấm lại để sửa trong tuần hiện tại.</p>
          </div>
        ) : (
          <>
            <div className="dc-sheet-head">
              <div>
                <span className="dc-eyebrow">PHIẾU CHẤM</span>
                <h3>
                  Lớp {classes.find((c) => c.id === classId)?.name} · {weekdayName(date)}, {viDate(date)}
                </h3>
                {current && (
                  <small>
                    Đã chấm bởi {current.recordedByName}, cập nhật {new Date(current.updatedAt).toLocaleString("vi-VN")}
                  </small>
                )}
              </div>
              <div className="dc-sheet-total">
                <span className="bad-text">−{formatPoints(totals.penalty)}</span>
                {totals.bonus > 0 && <span className="ok-text">+{formatPoints(totals.bonus)}</span>}
              </div>
            </div>

            {activeCategories.length === 0 && (
              <p className="hint">Chưa có mục chấm nào. Đoàn thanh niên cần cấu hình ở tab “Cấu hình chấm”.</p>
            )}

            {activeCategories.map((c) => (
              <div key={c.id} className="dc-cat-block">
                <h4>{c.name}</h4>
                {c.items.map((i) => {
                  const v = values[i.id] || {};
                  const q = quantityOf(i);
                  return (
                    <div key={i.id} className={"dc-item-row" + (q > 0 ? " hit" : "")}>
                      <div className="dc-item-label">
                        <strong>{i.name}</strong>
                        <small className={i.kind === "penalty" ? "bad-text" : "ok-text"}>
                          {i.kind === "penalty" ? "−" : "+"}
                          {formatPoints(i.points)} {i.inputType === "checkbox" ? "điểm" : i.inputType === "names" ? "/ học sinh" : "/ lần"}
                        </small>
                      </div>

                      <div className="dc-item-input">
                        {i.inputType === "checkbox" && (
                          <label className="dc-check">
                            <input type="checkbox" checked={!!v.checked} onChange={(e) => setValue(i.id, { checked: e.target.checked })} />
                            <span>{v.checked ? "Có vi phạm" : "Không"}</span>
                          </label>
                        )}
                        {i.inputType === "count" && (
                          <div className="dc-stepper">
                            <button type="button" onClick={() => setValue(i.id, { quantity: Math.max(0, (Number(v.quantity) || 0) - 1) })}>
                              −
                            </button>
                            <input
                              type="number"
                              min={0}
                              value={v.quantity || 0}
                              onChange={(e) => setValue(i.id, { quantity: e.target.value })}
                            />
                            <button type="button" onClick={() => setValue(i.id, { quantity: (Number(v.quantity) || 0) + 1 })}>
                              +
                            </button>
                          </div>
                        )}
                        {i.inputType === "names" && (
                          <input
                            className="dc-names"
                            value={v.names || ""}
                            onChange={(e) => setValue(i.id, { names: e.target.value })}
                            placeholder="Ghi tên học sinh, cách nhau bởi dấu phẩy"
                          />
                        )}
                      </div>

                      <div className="dc-item-sub">{q > 0 ? `${i.kind === "penalty" ? "−" : "+"}${formatPoints(q * i.points)}` : ""}</div>
                    </div>
                  );
                })}
              </div>
            ))}

            <label className="field dc-sheet-note">
              <span>Ghi chú chung</span>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Không bắt buộc" />
            </label>

            <div className="dc-sheet-actions">
              {current && (
                <button className="btn btn-danger" onClick={remove} disabled={busy}>
                  Xóa phiếu
                </button>
              )}
              <div className="spacer" />
              <span className="muted">
                {totals.penalty === 0 && totals.bonus === 0 ? "Lưu với “không vi phạm”" : "Tổng trong ngày"}
              </span>
              <button className="btn btn-primary" onClick={save} disabled={busy}>
                {busy ? "Đang lưu..." : current ? "Cập nhật phiếu" : "Lưu phiếu chấm"}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
