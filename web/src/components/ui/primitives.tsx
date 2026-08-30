import { useState } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

/** 基础按钮（P1）：variant/size/disabled/loading 五态内建（FE-001 Phase 1）。 */
export function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  const cls = [
    "ui-btn",
    `ui-btn--${variant}`,
    `ui-btn--${size}`,
    loading ? "ui-btn--loading" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button className={cls} disabled={disabled || loading} {...rest}>
      {loading && <span className="ui-btn__spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}

/** 基础输入框（P1）：label/error/hint/disabled。 */
export function Input({
  label,
  error,
  hint,
  className,
  id,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
  hint?: string;
}) {
  const autoId = useState(() => `ui-input-${Math.random().toString(36).slice(2, 8)}`)[0];
  const inputId = id ?? autoId;
  return (
    <div className={`ui-field ${error ? "ui-field--error" : ""} ${className ?? ""}`}>
      {label && <label className="ui-field__label" htmlFor={inputId}>{label}</label>}
      <input
        id={inputId}
        className="ui-input"
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

type Tone = "neutral" | "brand" | "ok" | "warn" | "err" | "ink";

/** 标签（P1）：可选移除按钮。 */
export function Tag({
  tone = "neutral",
  onRemove,
  children,
}: {
  tone?: Tone;
  onRemove?: () => void;
  children: React.ReactNode;
}) {
  return (
    <span className={`ui-tag ui-tag--${tone}`}>
      {children}
      {onRemove && (
        <button
          type="button"
          className="ui-tag__remove"
          aria-label="移除"
          onClick={onRemove}
        >
          ×
        </button>
      )}
    </span>
  );
}

/** 徽章（P1）：计数/状态小胶囊。 */
export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: Tone;
  children: React.ReactNode;
}) {
  return <span className={`ui-badge ui-badge--${tone}`}>{children}</span>;
}

/** 骨架屏（P1）：text/rect/circle 三形态，reduced-motion 下静止。 */
export function Skeleton({
  variant = "text",
  width,
  height,
}: {
  variant?: "text" | "rect" | "circle";
  width?: number | string;
  height?: number | string;
}) {
  const style: React.CSSProperties = { width, height };
  if (variant === "text") style.height ??= "1em";
  if (variant === "circle") style.width ??= style.height ?? 32;
  return <span className={`ui-skeleton ui-skeleton--${variant}`} style={style} aria-hidden="true" />;
}

/** 进度条（P1）：value ∈ [0,1]，色调随掌握度区间（与 Dashboard 一致）。 */
export function Progress({
  value,
  tone,
  label,
}: {
  value: number;
  tone?: Tone;
  label?: string;
}) {
  const pct = Math.max(0, Math.min(1, value));
  const auto: Tone = pct >= 0.7 ? "ok" : pct >= 0.4 ? "brand" : "err";
  const t = tone ?? auto;
  return (
    <div
      className="ui-progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct * 100)}
      aria-label={label}
    >
      <div className={`ui-progress__bar ui-progress__bar--${t}`} style={{ width: `${pct * 100}%` }} />
    </div>
  );
}
