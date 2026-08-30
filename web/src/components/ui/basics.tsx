import { useId } from "react";

/** 多行文本（P3）：与 Input 同一套 label/error/hint 结构。 */
export function Textarea({
  label,
  error,
  hint,
  className,
  id,
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  error?: string;
  hint?: string;
}) {
  const autoId = useId();
  const areaId = id ?? autoId;
  return (
    <div className={`ui-field ${error ? "ui-field--error" : ""} ${className ?? ""}`}>
      {label && <label className="ui-field__label" htmlFor={areaId}>{label}</label>}
      <textarea
        id={areaId}
        className="ui-textarea"
        aria-invalid={error ? true : undefined}
        {...rest}
      />
      {error ? (
        <p className="ui-field__msg ui-field__msg--error" role="alert">{error}</p>
      ) : hint ? (
        <p className="ui-field__msg">{hint}</p>
      ) : null}
    </div>
  );
}

/** 复选框（P3）：原生 checkbox + 令牌配色。 */
export function Checkbox({
  label,
  checked,
  onChange,
  disabled,
}: {
  label?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <label className={`ui-checkbox ${disabled ? "ui-checkbox--disabled" : ""}`} htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="ui-checkbox__box" aria-hidden="true">
        <svg viewBox="0 0 12 10" className="ui-checkbox__mark">
          <path d="M1 5.5 4.2 8.5 11 1.5" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {label && <span className="ui-checkbox__label">{label}</span>}
    </label>
  );
}

/** 头像（P3）：首字回退（无图时显示 title 首字符），size sm/md/lg。 */
export function Avatar({
  src,
  title,
  size = "md",
}: {
  src?: string;
  title: string;
  size?: "sm" | "md" | "lg";  // UI_DESIGN §7.1：32/40/56
}) {
  const cls = `ui-avatar ui-avatar--${size}`;
  if (src) {
    return <img className={cls} src={src} alt={title} />;
  }
  return (
    <span className={cls} role="img" aria-label={title}>
      {[...title][0]?.toUpperCase() ?? "?"}
    </span>
  );
}
