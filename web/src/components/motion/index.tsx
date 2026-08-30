import { useEffect, useRef, useState } from "react";

/**
 * 动效基元（FE-001 Phase 1，规格 frontend-impl-spec §2.1）——
 * 逐字移植自 ui/motion-primitives.html。
 */
/** 进度圆环（ui: motion-primitives .pr-wrap，描边动画 1.2s） */
export function ProgressRing({
  value,
  size = 140,
  label,
}: {
  value: number;
  size?: number;
  label?: string;
}) {
  const pct = Math.max(0, Math.min(1, value));
  const r = 60; // viewBox 140 基准，stroke 10
  const c = 2 * Math.PI * r;
  return (
    <div className="pr-wrap" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg viewBox="0 0 140 140">
        <circle className="bg" cx="70" cy="70" r={r} />
        <circle
          className="fg"
          cx="70" cy="70" r={r}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
        />
      </svg>
      <div className="num">{Math.round(pct * 100)}<span style={{ fontSize: 16 }}>%</span></div>
    </div>
  );
}

/** 滚动淡入（ui: .fade-target，IntersectionObserver 触发一次） */
export function FadeInUp({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`fade-target ${inView ? "in" : ""}`}>
      {children}
    </div>
  );
}

/** 数字滚动（ui: .count，800ms ease-out，tabular-nums 防跳动） */
export function CountUp({
  target,
  durationMs = 800,
  className,
}: {
  target: number;
  durationMs?: number;
  className?: string;
}) {
  const [n, setN] = useState(0);
  const started = useRef(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting) || started.current) return;
      started.current = true;
      io.disconnect();
      const t0 = performance.now();
      const tick = (t: number) => {
        const p = Math.min(1, (t - t0) / durationMs);
        setN(Math.round(target * (1 - Math.pow(1 - p, 3)))); // ease-out cubic
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [target, durationMs]);
  return (
    <span ref={ref} className={`count ${className ?? ""}`.trim()}>{n}</span>
  );
}

/** 波浪下划线链接（ui: .wavelink，hover 渐变下划线展开） */
export function WaveLink({
  hl = false,
  className,
  children,
  ...rest
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { hl?: boolean }) {
  return (
    <a className={`wavelink ${hl ? "hl" : ""} ${className ?? ""}`.trim()} {...rest}>
      {children}
    </a>
  );
}
