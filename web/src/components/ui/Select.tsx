import { useId } from "react";

/** 下拉选择（P2）：原生 select 保证键盘/无障碍基线，error 态与 Input 一致。 */
export function Select({
  label,
  error,
  hint,
  options,
  className,
  id,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  error?: string;
  hint?: string;
  options: Array<{ value: string; label: string }>;
}) {
  const autoId = useId();
  const selectId = id ?? autoId;
  return (
    <div className={`ui-field ${error ? "ui-field--error" : ""} ${className ?? ""}`}>
      {label && <label className="ui-field__label" htmlFor={selectId}>{label}</label>}
      <select id={selectId} className="ui-select" aria-invalid={error ? true : undefined} {...rest}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {error ? (
        <p className="ui-field__msg ui-field__msg--error" role="alert">{error}</p>
      ) : hint ? (
        <p className="ui-field__msg">{hint}</p>
      ) : null}
    </div>
  );
}
