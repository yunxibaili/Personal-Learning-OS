/**
 * Toast — Reference Component（UI-COMPONENT-BEHAVIOR-MATRIX §10）。
 * feedback system：materialize → idle → (hover pause) → auto/manual dismiss。
 * [A] "Let people cancel motion"——hover 暂停自动消失计时。
 * 语义：success/info → role=status；warning/error → role=alert。
 */
import { useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "../icons/Icon";

export type ToastTone = "success" | "info" | "warning" | "error";

const TONE_ICON: Record<ToastTone, IconName> = {
  success: "success",
  info: "sync",
  warning: "error",
  error: "error",
};

export interface ToastProps {
  tone: ToastTone;
  title: string;
  description?: string;
  /** 自动消失毫秒数；0 = 不自动消失 */
  duration?: number;
  onDismiss: () => void;
}

export function Toast({ tone, title, description, duration = 5000, onDismiss }: ToastProps) {
  const [leaving, setLeaving] = useState(false);
  const remaining = useRef(duration);
  const startedAt = useRef(0);
  const timer = useRef<number | undefined>(undefined);

  const startTimer = () => {
    if (duration <= 0 || remaining.current <= 0) return;
    startedAt.current = Date.now();
    timer.current = window.setTimeout(dismiss, remaining.current);
  };
  const pauseTimer = () => {
    if (timer.current === undefined) return;
    window.clearTimeout(timer.current);
    timer.current = undefined;
    remaining.current -= Date.now() - startedAt.current;
  };

  function dismiss() {
    if (timer.current !== undefined) window.clearTimeout(timer.current);
    setLeaving(true);
    window.setTimeout(onDismiss, 120); // dissolve 时长后卸载
  }

  useEffect(() => {
    startTimer();
    return () => window.clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={`toast toast--${tone}${leaving ? " is-leaving" : ""}`}
      role={tone === "error" || tone === "warning" ? "alert" : "status"}
      onMouseEnter={pauseTimer}
      onMouseLeave={startTimer}
    >
      <Icon name={TONE_ICON[tone]} activity={tone === "info"} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="t-body-ui" style={{ fontWeight: 600 }}>{title}</div>
        {description && <div className="t-callout">{description}</div>}
      </div>
      <button type="button" className="icon-btn toast__close" style={{ width: 28, height: 28 }} aria-label="关闭通知" onClick={dismiss}>
        <Icon name="close" size={16} />
      </button>
    </div>
  );
}

/** Toast 堆叠容器（固定于右下，functional layer 语义） */
export function ToastRegion({ children }: { children: React.ReactNode }) {
  return <div className="toast-region">{children}</div>;
}
