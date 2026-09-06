/**
 * Tabs — Reference Component（UI-COMPONENT-BEHAVIOR-MATRIX §3）。
 * 核心：selection continuity——单一 active indicator 作为同一个空间实体在 tab 间
 * 移动（FLIP 测量 + transform 过渡）。CSS transition 天然 retarget：
 * 快速 A→B→C 时指示器从当前插值态直奔 C，不排队播放（UI-MOTION-SPEC §6）。
 */
import { useLayoutEffect, useRef, useState } from "react";

export interface TabItem {
  id: string;
  label: string;
  disabled?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  "aria-label"?: string;
}

export function Tabs({ items, value, onChange, "aria-label": ariaLabel }: TabsProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  const [indicator, setIndicator] = useState({ x: 0, width: 0, ready: false });

  useLayoutEffect(() => {
    const move = () => {
      const el = activeRef.current;
      const list = listRef.current;
      if (!el || !list) return;
      // First-Last：以当前几何为起点，transform 移动（保留 CSS transition 的 retarget 能力）
      setIndicator({ x: el.offsetLeft, width: el.offsetWidth, ready: true });
    };
    move();
    const ro = new ResizeObserver(move);
    if (listRef.current) ro.observe(listRef.current);
    return () => ro.disconnect();
  }, [value, items]);

  function onKeyDown(e: React.KeyboardEvent) {
    const focusable = items.filter((t) => !t.disabled);
    const idx = focusable.findIndex((t) => t.id === value);
    let next = -1;
    if (e.key === "ArrowRight") next = (idx + 1) % focusable.length;
    if (e.key === "ArrowLeft") next = (idx - 1 + focusable.length) % focusable.length;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = focusable.length - 1;
    if (next >= 0) {
      e.preventDefault();
      onChange(focusable[next].id);
      activeRef.current?.focus();
    }
  }

  return (
    <div ref={listRef} className="tabs2" role="tablist" aria-label={ariaLabel} onKeyDown={onKeyDown}>
      <span
        className="tabs2__indicator"
        aria-hidden="true"
        style={{
          transform: `translateX(${indicator.x}px)`,
          width: indicator.width,
          opacity: indicator.ready ? 1 : 0,
        }}
      />
      {items.map((t) => (
        <button
          key={t.id}
          ref={t.id === value ? activeRef : undefined}
          type="button"
          role="tab"
          className="tabs2__tab"
          aria-selected={t.id === value}
          disabled={t.disabled}
          tabIndex={t.id === value ? 0 : -1}
          onClick={() => !t.disabled && onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
