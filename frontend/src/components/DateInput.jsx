// components/DateInput.jsx — ô nhập ngày / giờ luôn hiển thị dạng dd/mm/yyyy và HH:mm (24 giờ),
// không phụ thuộc ngôn ngữ trình duyệt (ô <input type="date"> gốc có thể hiện mm/dd/yyyy).
// Giá trị vào / ra giữ nguyên chuẩn của input gốc ("YYYY-MM-DD", "HH:mm", "YYYY-MM-DDTHH:mm")
// và onChange nhận { target: { value } } như sự kiện thường, nên thay thế được trực tiếp.
import { useEffect, useRef, useState } from "react";

const pad = (n) => String(n).padStart(2, "0");

/** "YYYY-MM-DD" → "dd/mm/yyyy" */
export function isoToVi(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/** "d/m/yyyy" → "YYYY-MM-DD" ("" nếu chưa đúng hoặc ngày không tồn tại) */
export function viToIso(text) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(text || "").trim());
  if (!m) return "";
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return "";
  return `${y}-${pad(mo)}-${pad(d)}`;
}

/** Chia chữ số thành các phần, phần nào dài quá thì tràn sang phần sau: "21102026" → "21/10/2026", "9:5" giữ nguyên */
function mask(raw, sep, limits) {
  const parts = raw.replace(sep === "/" ? /[^\d/]/g : /[^\d:]/g, "").split(sep);
  const out = [];
  let carry = "";
  for (let i = 0; i < limits.length; i++) {
    let part = carry + (parts[i] ?? "");
    carry = "";
    if (part.length > limits[i]) {
      carry = part.slice(limits[i]);
      part = part.slice(0, limits[i]);
    }
    if (parts[i] === undefined && !part) break;
    out.push(part);
  }
  return out.join(sep);
}

const maskDate = (raw) => mask(raw, "/", [2, 2, 4]);

const maskTime = (raw) => mask(raw, ":", [2, 2]);

/** "9:5" → "09:05" ("" nếu không hợp lệ) */
function normTime(text) {
  const m = /^(\d{1,2}):(\d{1,2})$/.exec(String(text || "").trim());
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return "";
  return `${pad(m[1])}:${pad(m[2])}`;
}

const emit = (onChange, name, value) => onChange?.({ target: { value, name } });

/** Ô chữ có định dạng: giữ chữ đang gõ, chỉ báo ra ngoài khi đủ hợp lệ hoặc bị xóa trống */
function useMaskedText(value, toText, parse) {
  const [text, setText] = useState(toText(value));
  useEffect(() => {
    // Giá trị đổi từ bên ngoài (chọn lịch, nút "Hôm nay", đặt lại form)
    setText((cur) => (parse(cur) === (value || "") ? cur : toText(value)));
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  return [text, setText];
}

export function DateInput({ value, onChange, name, min, max, disabled, className = "", placeholder = "dd/mm/yyyy", ...rest }) {
  const nativeRef = useRef(null);
  const [text, setText] = useMaskedText(value, isoToVi, viToIso);
  const iso = viToIso(text);
  const outOfRange = !!iso && ((min && iso < min) || (max && iso > max));
  const invalid = (!!text && !iso) || outOfRange;

  function change(e) {
    const next = maskDate(e.target.value);
    setText(next);
    const parsed = viToIso(next);
    if (!next) emit(onChange, name, "");
    else if (parsed && !((min && parsed < min) || (max && parsed > max))) emit(onChange, name, parsed);
  }

  function openPicker() {
    const el = nativeRef.current;
    if (!el || disabled) return;
    try {
      el.showPicker();
    } catch {
      el.focus();
      el.click();
    }
  }

  return (
    <span className={"date-input" + (invalid ? " invalid" : "") + (disabled ? " disabled" : "")}>
      <input
        {...rest}
        type="text"
        inputMode="numeric"
        className={className}
        value={text}
        placeholder={placeholder}
        onChange={change}
        onBlur={() => !invalid && setText(isoToVi(value))}
        disabled={disabled}
        title={invalid ? `Nhập ngày dạng dd/mm/yyyy${min || max ? " trong khoảng cho phép" : ""}` : rest.title}
      />
      <button type="button" className="date-input-btn" onClick={openPicker} disabled={disabled} tabIndex={-1} aria-label="Chọn trên lịch">
        📅
      </button>
      <input
        ref={nativeRef}
        type="date"
        className="date-input-native"
        value={value || ""}
        min={min}
        max={max}
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          setText(isoToVi(e.target.value));
          emit(onChange, name, e.target.value);
        }}
      />
    </span>
  );
}

export function TimeInput({ value, onChange, name, disabled, className = "", placeholder = "HH:mm", ...rest }) {
  const [text, setText] = useMaskedText(value, (v) => v || "", normTime);
  const invalid = !!text && !normTime(text);

  function change(e) {
    const next = maskTime(e.target.value);
    setText(next);
    const parsed = normTime(next);
    if (!next) emit(onChange, name, "");
    else if (parsed) emit(onChange, name, parsed);
  }

  return (
    <span className={"date-input time" + (invalid ? " invalid" : "") + (disabled ? " disabled" : "")}>
      <input
        {...rest}
        type="text"
        inputMode="numeric"
        className={className}
        value={text}
        placeholder={placeholder}
        onChange={change}
        onBlur={() => !invalid && text && setText(normTime(text))}
        disabled={disabled}
        title={invalid ? "Nhập giờ dạng HH:mm (24 giờ), ví dụ 14:00" : rest.title}
      />
    </span>
  );
}

/** Ngày + giờ, giá trị "YYYY-MM-DDTHH:mm" như <input type="datetime-local"> */
export function DateTimeInput({ value, onChange, name, disabled }) {
  const [date = "", time = ""] = String(value || "").split("T");
  const [draftTime, setDraftTime] = useState(time.slice(0, 5));
  useEffect(() => setDraftTime(time.slice(0, 5)), [time]);

  const send = (d, t) => emit(onChange, name, d ? `${d}T${t || "00:00"}` : "");

  return (
    <span className="date-time-input">
      <DateInput value={date} onChange={(e) => send(e.target.value, draftTime)} disabled={disabled} aria-label="Ngày" />
      <TimeInput
        value={draftTime}
        onChange={(e) => {
          setDraftTime(e.target.value);
          if (date && e.target.value) send(date, e.target.value);
        }}
        disabled={disabled}
        aria-label="Giờ phút"
      />
    </span>
  );
}
