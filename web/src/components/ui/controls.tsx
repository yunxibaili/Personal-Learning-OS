import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

/** 模态框（P2）：Esc 关闭 · 遮罩点击关闭 · 焦点移入对话框。 */
export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    ref.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="ui-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        ref={ref}
        className="ui-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <div className="ui-modal__head">
          <span className="ui-modal__title">{title}</span>
          <button type="button" className="ui-modal__close" aria-label="关闭" onClick={onClose}>×</button>
        </div>
        <div className="ui-modal__body">{children}</div>
        {footer && <div className="ui-modal__foot">{footer}</div>}
      </div>
    </div>
  );
}

/** 文字提示（P2）：hover/focus 显示，纯 CSS 定位。 */
export function Tooltip({
  content,
  children,
}: {
  content: string;
  children: React.ReactNode;
}) {
  return (
    <span className="ui-tooltip" tabIndex={0}>
      {children}
      <span className="ui-tooltip__bubble" role="tooltip">{content}</span>
    </span>
  );
}

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

/** 分段控制（ui: motion-primitives .seg + .pill 滑块，.35s --ease）。 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: Array<SegmentedOption<T>>;
  value: T;
  onChange: (v: T) => void;
  ariaLabel?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const idx = options.findIndex((o) => o.value === value);
    const btn = wrap.querySelectorAll("button")[idx];
    if (btn) setPill({ left: btn.offsetLeft, width: btn.offsetWidth });
  }, [value, options]);

  return (
    <div ref={wrapRef} className="seg" role="radiogroup" aria-label={ariaLabel}>
      {pill && (
        <span className="pill" style={{ left: pill.left, width: pill.width }} aria-hidden="true" />
      )}
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={value === o.value ? "active" : ""}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * 标签页（P2）：受控 tab 切换。
 *
 * `badge` 槽位为右栏反链计数而加（ContextRail）：原手写 tablist 在「反链」标签后
 * 挂 `<Badge>` 计数，换组件后这个信息不能丢——所以槽位进组件，不靠调用方拼 children。
 * `className` 只作用于容器（右栏语境需要 `.ctx-rail__tabs` 覆盖等分窄栏样式），
 * 子项类名固定为 `.ui-tabs__item`，改样式请用后代选择器，不要在调用方另起一套。
 */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: Array<{ key: T; label: string; badge?: React.ReactNode }>;
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={`ui-tabs ${className ?? ""}`.trim()} role="tablist">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={value === t.key}
          className={`ui-tabs__item ${value === t.key ? "ui-tabs__item--active" : ""}`.trimEnd()}
          onClick={() => onChange(t.key)}
        >
          {t.label}
          {t.badge}
        </button>
      ))}
    </div>
  );
}

/** 开关（P2）：checkbox 语义 + 轨道视觉。 */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <label className={`ui-switch ${disabled ? "ui-switch--disabled" : ""}`} htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="ui-switch__track" aria-hidden="true"><span className="ui-switch__thumb" /></span>
      {label && <span className="ui-switch__label">{label}</span>}
    </label>
  );
}
