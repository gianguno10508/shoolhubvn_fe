// pages/discipline/PairsTab.jsx — Đoàn TN phân công chấm chéo: cờ đỏ lớp nào chấm lớp nào (vd 11A1 chấm 11A2)
import { useEffect, useMemo, useState } from "react";
import { getScoringPairs, saveScoringPairs } from "../../api/discipline";
import { listClasses } from "../../api/school";

const byName = (a, b) => a.name.localeCompare(b.name, "vi", { numeric: true });

/** Khối của lớp: trường "grade" hoặc phần số đầu tên lớp (11A1 → 11) */
const gradeOf = (c) => c.grade || (c.name.match(/^\d+/) || [""])[0];

export default function PairsTab({ showToast }) {
  const [classes, setClasses] = useState(null);
  const [pairs, setPairs] = useState({}); // scorerClassId -> [targetClassId]
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    Promise.all([listClasses(), getScoringPairs()])
      .then(([list, data]) => {
        setClasses([...list].sort(byName));
        setPairs(Object.fromEntries(data.pairs.map((p) => [String(p.scorerClassId), p.targetClassIds.map(String)])));
      })
      .catch((err) => setError(err.message || "Không tải được phân công chấm."));
  }, []);

  const nameOf = useMemo(() => new Map((classes || []).map((c) => [String(c.id), c.name])), [classes]);

  function change(fn) {
    setPairs((prev) => {
      const next = { ...prev };
      fn(next);
      return next;
    });
    setDirty(true);
  }

  const addTarget = (scorer, target) =>
    change((p) => {
      if (target && target !== scorer) p[scorer] = [...new Set([...(p[scorer] || []), target])];
    });
  const removeTarget = (scorer, target) => change((p) => (p[scorer] = (p[scorer] || []).filter((t) => t !== target)));

  /** Vòng tròn trong từng khối: 11A1 → 11A2 → 11A3 → 11A1 */
  function autoRing() {
    if (Object.values(pairs).some((t) => t.length) && !window.confirm("Thay toàn bộ phân công hiện tại bằng phân công vòng tròn trong từng khối?")) return;
    const groups = {};
    for (const c of classes) (groups[gradeOf(c)] = groups[gradeOf(c)] || []).push(c);
    const next = {};
    Object.values(groups).forEach((list) => {
      if (list.length < 2) return;
      list.sort(byName).forEach((c, i) => {
        next[String(c.id)] = [String(list[(i + 1) % list.length].id)];
      });
    });
    setPairs(next);
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    try {
      const data = await saveScoringPairs(
        Object.entries(pairs)
          .filter(([, targets]) => targets.length)
          .map(([scorerClassId, targetClassIds]) => ({ scorerClassId, targetClassIds })),
      );
      setPairs(Object.fromEntries(data.pairs.map((p) => [String(p.scorerClassId), p.targetClassIds.map(String)])));
      setDirty(false);
      showToast("Đã lưu phân công chấm.");
    } catch (err) {
      showToast(err.message || "Không lưu được phân công.", true);
    } finally {
      setSaving(false);
    }
  }

  if (error) {
    return (
      <div className="auth-error">
        <span>!</span>
        <p>{error}</p>
      </div>
    );
  }
  if (!classes) return <p className="as-empty">Đang tải...</p>;

  const assigned = Object.values(pairs).filter((t) => t.length).length;
  const scoredBy = {}; // lớp được chấm -> các lớp chấm nó
  Object.entries(pairs).forEach(([s, ts]) => ts.forEach((t) => (scoredBy[t] = [...(scoredBy[t] || []), s])));
  const unscored = classes.filter((c) => !scoredBy[String(c.id)]);

  return (
    <div className="as-card dc-pairs">
      <div className="as-card-head">
        <div>
          <h3>Phân công chấm chéo</h3>
          <p>
            Cờ đỏ của lớp ở cột trái chỉ được chấm các lớp được phân công. Chưa phân công lớp nào thì cờ đỏ chấm được mọi lớp
            trừ lớp mình.
          </p>
        </div>
      </div>

      <div className="btn-row">
        <button className="btn btn-info" type="button" onClick={autoRing} disabled={classes.length < 2}>
          ⟳ Tự phân công vòng tròn trong khối
        </button>
        <button
          className="btn btn-light"
          type="button"
          onClick={() => window.confirm("Xoá toàn bộ phân công?") && (setPairs({}), setDirty(true))}
          disabled={!assigned}
        >
          Xoá hết
        </button>
        <div className="spacer" />
        <button className="btn btn-primary" type="button" onClick={save} disabled={saving || !dirty}>
          {saving ? "Đang lưu..." : "Lưu phân công"}
        </button>
      </div>

      {assigned > 0 && unscored.length > 0 && (
        <p className="dc-template-note">
          ⚠️ Chưa có lớp nào chấm: <b>{unscored.map((c) => c.name).join(", ")}</b>
        </p>
      )}

      <table className="grid-table dc-pairs-table">
        <thead>
          <tr>
            <th className="w-stt">STT</th>
            <th>Lớp chấm (cờ đỏ)</th>
            <th>Chấm các lớp</th>
            <th>Thêm lớp</th>
          </tr>
        </thead>
        <tbody>
          {classes.map((c, i) => {
            const id = String(c.id);
            const targets = pairs[id] || [];
            return (
              <tr key={id}>
                <td className="stt">{i + 1}</td>
                <td>
                  <strong>{c.name}</strong>
                </td>
                <td>
                  {targets.length === 0 ? (
                    <span className="muted">— chưa phân công —</span>
                  ) : (
                    <div className="as-chip-row">
                      {targets.map((t) => (
                        <span key={t} className="as-chip selected">
                          {nameOf.get(t) || "?"}
                          <button type="button" className="dc-chip-x" onClick={() => removeTarget(id, t)} aria-label="Bỏ">
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td>
                  <select value="" onChange={(e) => addTarget(id, e.target.value)}>
                    <option value="">+ chọn lớp</option>
                    {classes
                      .filter((x) => String(x.id) !== id && !targets.includes(String(x.id)))
                      .map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name}
                        </option>
                      ))}
                  </select>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
