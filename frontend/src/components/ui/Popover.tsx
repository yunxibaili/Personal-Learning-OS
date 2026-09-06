/**
 * Popover — Reference Component（UI-COMPONENT-BEHAVIOR-MATRIX §7）。
 * Material Reference 母版：glass-regular 材质 + 从 trigger origin materialize +
 * Esc / outside click / focus trap / focus restoration。
 * 禁止：屏幕居中 fade in；嵌套玻璃。
 */
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../icons/Icon";

export interface PopoverRenderProps {
  ref: (el: HTMLElement | null) => void;
  onClick: () => void;
  "aria-expanded": boolean;
  "aria-haspopup": "dialog";
  "aria-controls": string;
}

export interface PopoverProps {
  /** trigger 渲染函数：接收受控的 ref/aria 属性，调用方绑定到自己的按钮上 */
  trigger: (props: PopoverRenderProps) => React.ReactNode;
  /** 触发侧：面板将出现在触发元素的对侧 */
  placement?: "bottom" | "top";
  onClose?: () => void;
  children: React.ReactNode;
}

const GAP = 8; // [C] 面板与触发的间距启发式

export function Popover({ trigger, placement = "bottom", onClose, children }: PopoverProps) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; origin: string } | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const openPanel = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    // origin 记录触发点关系：materialize 从 trigger 侧发生（UI-MOTION-SPEC §3）
    const top = placement === "bottom" ? r.bottom + GAP : r.top - GAP;
    setPos({ top, left: r.left, origin: placement === "bottom" ? "top left" : "bottom left" });
    setOpen(true);
    setClosing(false);
  }, [placement]);

  const closePanel = useCallback(() => {
    if (!open) return;
    setClosing(true);
    window.setTimeout(() => {
      setOpen(false);
      setClosing(false);
      onClose?.();
      triggerRef.current?.focus(); // [A/B] focus restoration
    }, 120); // dissolve 时长（--motion-fast 语义）
  }, [open, onClose]);

  // Esc 关闭 + outside click 关闭
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closePanel();
      }
      // 简易 focus trap：Tab 循环限制在面板内（非模态，但键盘不外泄）
      if (e.key === "Tab" && panelRef.current) {
        const focusables = panelRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      closePanel();
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onPointer, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onPointer, true);
    };
  }, [open, closePanel]);

  // 打开时初始焦点入面板
  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  const triggerProps: PopoverRenderProps = {
    ref: (el) => {
      triggerRef.current = el;
    },
    onClick: () => (open ? closePanel() : openPanel()),
    "aria-expanded": open,
    "aria-haspopup": "dialog",
    "aria-controls": panelId,
  };

  return (
    <>
      {trigger(triggerProps)}
      {open && pos
        ? createPortal(
            <div
              ref={panelRef}
              id={panelId}
              role="dialog"
              tabIndex={-1}
              className={`popover${closing ? " is-closing" : ""}`}
              style={{
                top: pos.top,
                left: pos.left,
                transformOrigin: pos.origin,
                ...(placement === "top" ? { transform: "translateY(-100%)" } : null),
              }}
            >
              {children}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

/** Popover 常用头部：标题 + 关闭钮（Close icon，语义动效非装饰） */
export function PopoverHeader({ title }: { title: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", marginBottom: "var(--space-xs)" }}>
      <h3 className="t-headline" style={{ margin: 0, flex: 1 }}>{title}</h3>
      <button type="button" className="icon-btn" style={{ width: 28, height: 28 }} aria-label="关闭">
        <Icon name="close" size={16} />
      </button>
    </div>
  );
}
