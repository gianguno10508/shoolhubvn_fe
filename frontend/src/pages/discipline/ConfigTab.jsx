// pages/discipline/ConfigTab.jsx
import { useState } from "react";
import { saveDisciplineConfig } from "../../api/discipline";
import { INPUT_TYPES, WEEKDAY_SHORT } from "./disciplineUtils";

let tempId = 0;
const newItem = () => ({ key: `new-${++tempId}`, name: "", kind: "penalty", points: 1, inputType: "checkbox", active: true });
const newCategory = () => ({ key: `new-${++tempId}`, name: "", active: true, items: [newItem()] });

/* Cấu hình mục chấm (Đoàn thanh niên / tài khoản trường) */
export default function ConfigTab({ config, onSaved, showToast }) {
  const [draft, setDraft] = useState(() => ({
    basePoints: config.basePoints,
    weekStartDay: config.weekStartDay,
    scoreDays: config.scoreDays,
    categories: config.categories.map((c) => ({ ...c, key: c.id, items: c.items.map((i) => ({ ...i, key: i.id })) })),
  }));
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  function update(fn) {
    setDraft((prev) => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
    setDirty(true);
  }

  const move = (list, i, step) => {
    const j = i + step;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
  };

  async function save() {
    setSaving(true);
    try {
      const saved = await saveDisciplineConfig({
        basePoints: Number(draft.basePoints),
        weekStartDay: Number(draft.weekStartDay),
        scoreDays: draft.scoreDays,
        categories: draft.categories.map((c) => ({
          id: c.id,
          name: c.name,
          active: c.active,
          items: c.items.map((i) => ({ id: i.id, name: i.name, kind: i.kind, points: Number(i.points), inputType: i.inputType, active: i.active })),
        })),
      });
      setDirty(false);
      onSaved(saved);
      showToast("Đã lưu cấu hình chấm thi đua.");
    } catch (err) {
      showToast(err.message || "Không lưu được cấu hình.", true);
    } finally {
      setSaving(false);
    }
  }

  const itemCount = draft.categories.reduce((n, c) => n + c.items.length, 0);

  return (
    <>
      <div className="as-card">
        <div className="as-card-head">
          <div>
            <h3>Cài đặt chung</h3>
            <p>Mỗi tuần mỗi lớp bắt đầu với điểm gốc, bị trừ / được cộng theo phiếu chấm hằng ngày.</p>
          </div>
        </div>
        <div className="dc-general">
          <label className="field">
            <span>Điểm gốc mỗi tuần</span>
            <input type="number" min={0} value={draft.basePoints} onChange={(e) => update((d) => (d.basePoints = e.target.value))} />
          </label>
          <label className="field">
            <span>Tuần bắt đầu từ</span>
            <select value={draft.weekStartDay} onChange={(e) => update((d) => (d.weekStartDay = Number(e.target.value)))}>
              {[1, 0, 6].map((d) => (
                <option key={d} value={d}>
                  {["Chủ nhật", "Thứ 2", "", "", "", "", "Thứ 7"][d]}
                </option>
              ))}
            </select>
          </label>
          <div className="field">
            <span>Các ngày có chấm</span>
            <div className="as-chip-row">
              {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                const on = draft.scoreDays.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    className={"as-chip" + (on ? " selected" : "")}
                    onClick={() =>
                      update((x) => {
                        x.scoreDays = on ? x.scoreDays.filter((n) => n !== d) : [...x.scoreDays, d];
                      })
                    }
                  >
                    {WEEKDAY_SHORT[d]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        {!config.configured && (
          <p className="dc-template-note">
            💡 Đây là <b>mẫu gợi ý</b>. Sửa lại cho phù hợp với trường rồi bấm “Lưu cấu hình”.
          </p>
        )}
      </div>

      {draft.categories.map((c, ci) => (
        <div key={c.key} className={"dc-cfg-cat" + (c.active ? "" : " off")}>
          <div className="dc-cfg-cat-head">
            <span className="as-step">{ci + 1}</span>
            <input
              className="dc-cfg-cat-name"
              value={c.name}
              placeholder="Tên mục lớn, ví dụ: Sĩ số"
              onChange={(e) => update((d) => (d.categories[ci].name = e.target.value))}
            />
            <label className="dc-toggle">
              <input type="checkbox" checked={c.active} onChange={(e) => update((d) => (d.categories[ci].active = e.target.checked))} />
              Đang dùng
            </label>
            <div className="dc-cfg-tools">
              <button className="btn btn-sm btn-light" onClick={() => update((d) => move(d.categories, ci, -1))} disabled={ci === 0} title="Lên">
                ↑
              </button>
              <button
                className="btn btn-sm btn-light"
                onClick={() => update((d) => move(d.categories, ci, 1))}
                disabled={ci === draft.categories.length - 1}
                title="Xuống"
              >
                ↓
              </button>
              <button
                className="btn btn-sm btn-danger"
                onClick={() => {
                  if (window.confirm(`Xóa mục lớn “${c.name || "chưa đặt tên"}” và ${c.items.length} mục nhỏ?`)) {
                    update((d) => d.categories.splice(ci, 1));
                  }
                }}
              >
                Xóa
              </button>
            </div>
          </div>

          <div className="dc-cfg-items">
            <div className="dc-cfg-item dc-cfg-item-head">
              <span>Mục nhỏ</span>
              <span>Loại</span>
              <span>Điểm</span>
              <span>Cách chấm</span>
              <span>Dùng</span>
              <span />
            </div>
            {c.items.map((i, ii) => (
              <div key={i.key} className={"dc-cfg-item" + (i.active ? "" : " off")}>
                <input
                  value={i.name}
                  placeholder="Ví dụ: Vắng không phép"
                  onChange={(e) => update((d) => (d.categories[ci].items[ii].name = e.target.value))}
                />
                <select value={i.kind} onChange={(e) => update((d) => (d.categories[ci].items[ii].kind = e.target.value))}>
                  <option value="penalty">Trừ điểm</option>
                  <option value="bonus">Cộng điểm</option>
                </select>
                <input
                  type="number"
                  min={0}
                  step="0.5"
                  value={i.points}
                  onChange={(e) => update((d) => (d.categories[ci].items[ii].points = e.target.value))}
                />
                <select
                  value={i.inputType}
                  title={INPUT_TYPES[i.inputType].hint}
                  onChange={(e) => update((d) => (d.categories[ci].items[ii].inputType = e.target.value))}
                >
                  {Object.entries(INPUT_TYPES).map(([k, t]) => (
                    <option key={k} value={k}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <input
                  type="checkbox"
                  checked={i.active}
                  onChange={(e) => update((d) => (d.categories[ci].items[ii].active = e.target.checked))}
                />
                <button className="dc-remove" title="Xóa mục nhỏ" onClick={() => update((d) => d.categories[ci].items.splice(ii, 1))}>
                  ×
                </button>
              </div>
            ))}
            <button className="btn btn-sm btn-info dc-add-item" onClick={() => update((d) => d.categories[ci].items.push(newItem()))}>
              + Thêm mục nhỏ
            </button>
          </div>
        </div>
      ))}

      <button className="dc-add-cat" onClick={() => update((d) => d.categories.push(newCategory()))}>
        + Thêm mục lớn
      </button>

      <div className="as-submit-bar">
        <span>
          {draft.categories.length} mục lớn · {itemCount} mục nhỏ
          {dirty ? " · có thay đổi chưa lưu" : ""} · đổi cấu hình không ảnh hưởng điểm đã chấm
        </span>
        <button className="btn btn-primary" onClick={save} disabled={saving || !dirty}>
          {saving ? "Đang lưu..." : "Lưu cấu hình"}
        </button>
      </div>
    </>
  );
}
