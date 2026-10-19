import { useEffect, useMemo, useRef, useState } from "react";

const plain = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d");

/* Ô chọn có tìm kiếm, tự vẽ thay cho <select> gốc của trình duyệt.
 * Dùng ở Khung chương trình: popup <select> gốc hay bị đóng ngay sau khi mở (phải bấm 2 lần).
 * options: [{ value, label }] — value "" là lựa chọn trống (placeholder). */
export default function SearchSelect({ value, onChange, options, placeholder = "Mời chọn", className = "" }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const wrapRef = useRef(null);
  const listRef = useRef(null);

  const current = options.find((o) => o.value === value);
  const list = useMemo(() => {
    const q = plain(query.trim());
    const all = [{ value: "", label: placeholder }, ...options];
    return q ? all.filter((o) => o.value && plain(o.label).includes(q)) : all;
  }, [options, query, placeholder]);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => wrapRef.current && !wrapRef.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  // Giữ dòng đang chọn trong tầm nhìn khi dùng phím mũi tên
  useEffect(() => {
    if (open) listRef.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function show() {
    setQuery("");
    setActive(Math.max(0, [{ value: "" }, ...options].findIndex((o) => o.value === value)));
    setOpen(true);
  }

  function pick(o) {
    setOpen(false);
    if (o.value !== value) onChange(o.value);
  }

  function onKey(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(list.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (list[active]) pick(list[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className={"ss " + className + (open ? " open" : "")} ref={wrapRef}>
      <button type="button" className={"ss-btn" + (current ? "" : " empty")} onClick={() => (open ? setOpen(false) : show())}>
        <span>{current ? current.label : placeholder}</span>
        <span className="ss-caret">▾</span>
      </button>
      {open && (
        <div className="ss-pop">
          <input
            autoFocus
            className="ss-search"
            value={query}
            placeholder="Tìm..."
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKey}
          />
          <ul className="ss-list" ref={listRef} role="listbox">
            {list.length === 0 && <li className="ss-none">Không tìm thấy</li>}
            {list.map((o, i) => (
              <li
                key={o.value || "_empty"}
                role="option"
                aria-selected={o.value === value}
                className={(i === active ? "active " : "") + (o.value === value ? "selected " : "") + (o.value ? "" : "ss-empty")}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(o);
                }}
              >
                {o.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
