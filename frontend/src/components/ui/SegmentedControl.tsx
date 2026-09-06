/**
 * SegmentedControl — Reference Component（UI-COMPONENT-BEHAVIOR-MATRIX §4）。
 * active capsule 必须是持续存在的空间实体：move / morph（宽度随段宽变化）/ settle。
 * 与 Tabs 同用 FLIP + CSS transition retarget（velocity continuity）。
 */
import { useLayoutEffect, useRef, useState } from "react";

export interface SegmentOption {
  id: string;
  label: string;
  disabled?: boolean;
}

export interface SegmentedControlProps {
  options: SegmentOption[];
  value: string;
  onChange: (id: string) => void;
  "aria-label"?: string;
}

export function SegmentedControl({ options, value, onChange, "aria-label": ariaLabel }: SegmentedControlProps) {
  const groupRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  const [capsule, setCapsule] = useState({ x: 0, width: 0, ready: false });

  useLayoutEffect(() => {
    const move = () => {
      const el = activeRef.current;
      if (!el) return;
      setCapsule({ x: el.offsetLeft, width: el.offsetWidth, ready: true });
    };
    move();
    const ro = new ResizeObserver(move);
    if (groupRef.current) ro.observe(groupRef.current);
    return () => ro.disconnect();
  }, [value, options]);

  return (
    <div ref={groupRef} className="seg" role="group" aria-label={ariaLabel}>
      <span
        className="seg__capsule"
        aria-hidden="true"
        style={{ transform: `translateX(${capsule.x}px)`, width: capsule.width, opacity: capsule.ready ? 1 : 0 }}
      />
      {options.map((o) => (
        <button
          key={o.id}
          ref={o.id === value ? activeRef : undefined}
          type="button"
          className="seg__option"
          aria-pressed={o.id === value}
          disabled={o.disabled}
          onClick={() => !o.disabled && onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
