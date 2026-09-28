export function Field({ label, warn, children }) {
  return (
    <label className={"field" + (warn ? " warn" : "")}>
      <span>{label}</span>
      {children}
    </label>
  );
}

export default Field;
