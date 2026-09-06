/**
 * LiquidGlassLab — Liquid Glass 三档技术实验（?design=reference 的实验区，不接入生产）。
 * 指令书 §15/§16：普通 blur → 边缘折射 → pressed deformation 三档并排肉眼比较。
 *
 * 技术路线（源自 liquid-glass-react 研究，零依赖实现）：
 *   backdrop-filter: blur() url(#lens) saturate() brightness()
 *   位移图 = 圆角矩形 SDF：中心中性灰(128,128)不位移，边缘沿法线 ramp；
 *   **scale 必须为负** → 放大镜效果（正 scale 是鱼眼）。
 *   Chromium 支持 backdrop-filter 内 url()；Safari/Firefox 自动回退到前面的 blur 声明。
 *   位移图运行时由 <canvas> 生成（等价于该库的 Python 脚本，避免额外资产文件）。
 */
import { useEffect, useMemo, useRef, useState } from "react";

/** 生成圆角矩形 SDF 位移图（R=水平法向，G=垂直法向，128=无位移） */
function makeSdfMap(w: number, h: number, radius: number, rim: number): string {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(w, h);
  const hw = w / 2;
  const hh = h / 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = x + 0.5 - hw;
      const py = y + 0.5 - hh;
      const qx = Math.abs(px) - (hw - radius);
      const qy = Math.abs(py) - (hh - radius);
      const dx = Math.max(qx, 0);
      const dy = Math.max(qy, 0);
      // 圆角矩形 SDF（内负外正）
      const dist = Math.hypot(dx, dy) + Math.min(Math.max(qx, qy), 0) - radius;
      // 边缘法向：角区指向外角，边区沿轴向
      let nx = 0;
      let ny = 0;
      if (dx > 0 || dy > 0) {
        const len = Math.hypot(dx, dy) || 1;
        nx = (dx / len) * Math.sign(px || 1);
        ny = (dy / len) * Math.sign(py || 1);
      } else {
        nx = Math.sign(qx > qy ? px : 0);
        ny = Math.sign(qy > qx ? py : 0);
      }
      // rim 内从 0 ramp 到 1（越靠边折射越强）
      const t = Math.min(1, Math.max(0, 1 + dist / rim));
      const i = (y * w + x) * 4;
      img.data[i] = 128 + nx * 127 * t;
      img.data[i + 1] = 128 + ny * 127 * t;
      img.data[i + 2] = 128;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL("image/png");
}

export interface LiquidGlassCardProps {
  tier: "blur" | "refraction" | "press";
  width?: number;
  height?: number;
}

const W = 300;
const H = 190;
const RADIUS = 22;
const RIM = 56; // 折射向内延伸距离（更厚的玻璃边缘，实验可见性优先）
const REFRACT_SCALE = -70; // 负值 = 放大镜；越大越明显（[C] 实验参数）
const FILTER_ID = "liquid-lens-lab";

export function LiquidGlassCard({ tier }: LiquidGlassCardProps) {
  const [pressed, setPressed] = useState(false);
  const [pressPoint, setPressPoint] = useState({ x: 50, y: 50 });
  const ref = useRef<HTMLDivElement>(null);
  // 位移图只生成一次（静态 PNG 等价物）
  const mapUrl = useMemo(() => makeSdfMap(W, H, RADIUS, RIM), []);
  const scale = tier === "press" && pressed ? -120 : REFRACT_SCALE;

  useEffect(() => {
    if (tier !== "press") return;
    const el = ref.current;
    if (!el) return;
    const down = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      setPressPoint({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
      setPressed(true);
    };
    const up = () => setPressed(false);
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
    };
  }, [tier]);

  const baseFilter = "blur(5px) saturate(160%) brightness(1.06)";
  const filter =
    tier === "blur"
      ? "blur(20px) saturate(180%)"
      : tier === "refraction"
        ? `blur(5px) saturate(160%) brightness(1.06) url(#${FILTER_ID})`
        : `blur(5px) saturate(160%) brightness(1.06) url(#${FILTER_ID})`;

  return (
    <figure style={{ margin: 0, display: "grid", gap: "var(--space-xs)" }}>
      <div style={{ position: "relative", width: W, height: H, borderRadius: RADIUS, overflow: "hidden" }}>
        {/* 实验背景：低饱和（Owner 裁定不能太花哨），但保留色块边缘供折射可见性判定 */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(120px circle at 25% 32%, rgba(255,107,53,.85), transparent 70%)," +
              "radial-gradient(150px circle at 72% 68%, rgba(59,130,246,.75), transparent 70%)," +
              "radial-gradient(110px circle at 68% 22%, rgba(46,158,91,.7), transparent 70%)," +
              "linear-gradient(180deg, #e9e7e2 0%, #d9d6d0 100%)",
          }}
        />
        <div
          ref={ref}
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: RADIUS,
            backdropFilter: filter,
            WebkitBackdropFilter: tier === "blur" ? filter : baseFilter, // 降级链：先声明纯 blur
            boxShadow:
              tier === "blur"
                ? "0 8px 24px rgba(0,0,0,.14)"
                : "inset 0 1px 0 rgba(255,255,255,.65), inset 0 -1px 0 rgba(0,0,0,.12), 0 12px 32px rgba(0,0,0,.18)",
            border: "1px solid rgba(255,255,255,.35)",
            transform: tier === "press" && pressed ? "scale(0.985)" : "scale(1)",
            transition: "transform 160ms var(--spring-snappy), backdrop-filter 120ms linear",
            cursor: tier === "press" ? "pointer" : "default",
            display: "grid",
            placeItems: "center",
            color: "#1d1d1f",
          }}
        >
          {tier === "press" && (
            <span
              aria-hidden
              style={{
                position: "absolute",
                inset: 0,
                background: `radial-gradient(90px circle at ${pressPoint.x}% ${pressPoint.y}%, rgba(0,0,0,${pressed ? 0.22 : 0.08}), transparent 70%)`,
                opacity: pressed ? 1 : 0.6,
                transition: "opacity 120ms linear",
              }}
            />
          )}
          <div style={{ position: "relative", textAlign: "center", padding: "0 20px" }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Liquid Glass</div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>
              {tier === "blur" ? "A · 纯 backdrop blur" : tier === "refraction" ? "B · SDF 边缘折射" : "C · 按住我（按压形变）"}
            </div>
          </div>
        </div>
      </div>
      <figcaption className="t-caption" style={{ width: W }}>
        {tier === "blur"
          ? "A：blur(20px)——上一轮的做法，边缘无折射。"
          : tier === "refraction"
            ? `B：SDF 位移图 + feDisplacementMap（scale ${REFRACT_SCALE}，负值=放大镜）`
            : `C：按住玻璃——位移 scale ${scale} + 局部压暗跟随指针（fingertip press）`}
      </figcaption>
      {tier !== "blur" && (
        <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
          <filter id={FILTER_ID} x="0" y="0" width="100%" height="100%">
            <feImage href={mapUrl} xlinkHref={mapUrl} x="0" y="0" width={`${W}px`} height={`${H}px`} preserveAspectRatio="none" result="map" />            <feDisplacementMap in="SourceGraphic" in2="map" scale={scale} xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </svg>
      )}
    </figure>
  );
}
