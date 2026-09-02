import { useId } from "react";

/**
 * 基础组件（FE-001 Phase 1）——结构/类名逐字移植自 ui/motion-primitives.html。
 * ui/ 无规范页的组件（Badge/Progress 条）以令牌化最小实现补充，来源已标注。
 */

type BtnVariant = "primary" | "secondary" | "ghost" | "danger";

/**
 * 按钮（ui: .btn / .btn-primary）。
 * primary = 纯色实底（--brand-deep + --text-inv），不是渐变：ADR-013 §2.13 line 291
 * 明确「按钮渐变、渐变背景 —— 本例外不豁免」。
 */
export function Button({
  variant = "secondary",
  size,
  loading = false,
  disabled,
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: BtnVariant;
  size?: "sm" | "lg";
  loading?: boolean;
}) {
  const variantCls =
    variant === "primary" ? "btn-primary"
    : variant === "ghost" ? "btn-ghost"
    : variant === "danger" ? "btn-danger"
    : "";
  const cls = ["btn", variantCls, size ? `btn--${size}` : "", className ?? ""]
    .filter(Boolean)
    .join(" ");
  return (
    <button className={cls} disabled={disabled || loading} {...rest}>
      {loading && <span className="btn__spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}

/** 输入框（ui: .inp 包裹结构，focus-within 橙描边 + 3px 外发光） */
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
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <div className={`ui-field ${error ? "ui-field--error" : ""} ${className ?? ""}`}>
      {label && <label className="ui-field__label" htmlFor={inputId}>{label}</label>}
      <div className={`inp ${error ? "inp--error" : ""}`}>
        <input id={inputId} aria-invalid={error ? true : undefined} {...rest} />
      </div>
      {error ? (
        <p className="ui-field__msg ui-field__msg--error" role="alert">{error}</p>
      ) : hint ? (
        <p className="ui-field__msg">{hint}</p>
      ) : null}
    </div>
  );
}

type Tone = "neutral" | "brand" | "ok" | "warn" | "err" | "ink";

/** 标签（ui: app-shell .editor .chip） */
export function Tag({
  tone = "neutral",
  onRemove,
  children,
}: {
  tone?: Tone;
  onRemove?: () => void;
  children: React.ReactNode;
}) {
  const toneCls = tone === "neutral" ? "" : tone;
  return (
    <span className={`chip ${toneCls}`.trim()}>
      {children}
      {onRemove && (
        <button type="button" className="chip__remove" aria-label="移除" onClick={onRemove}>
          ×
        </button>
      )}
    </span>
  );
}

/** 徽章（ui/ 无独立规范页：bento badge-row 语义，token 化最小实现） */
export function Badge({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) {
  return <span className={`ui-badge ui-badge--${tone}`}>{children}</span>;
}

/** 骨架屏（ui: .skel，1.4s linear shimmer） */
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
  if (variant === "text") style.height ??= 12;
  if (variant === "circle") style.width ??= style.height ?? 36;
  return <span className="skel" style={style} aria-hidden="true" />;
}

/** 进度条（ui/ 无独立规范页：token 化实现，色调随值自动） */
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
  return (
    <div
      className="ui-progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct * 100)}
      aria-label={label}
    >
      <div className={`ui-progress__bar ui-progress__bar--${tone ?? auto}`}
           style={{ width: `${pct * 100}%` }} />
    </div>
  );
}
