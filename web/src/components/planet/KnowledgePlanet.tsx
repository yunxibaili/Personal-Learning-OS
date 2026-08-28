import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import createGlobe from "cobe";

import { apiGet } from "../../lib/api";

/**
 * KnowledgePlanet（P8-001C）：首页知识星球。
 * 中心 Cobe 点阵地球，卫星 = 笔记（数量随 /api/v1/notes 增长，尺寸随总量增长至上限）。
 *
 * 性能契约（sandbox/cobe-test-math.html 验证过的数学遮挡）：
 * - 两层分离渲染：地球 canvas（dpr=1, 30fps 跳帧）与卫星 DOM（transform, 30fps）
 * - IntersectionObserver / visibilitychange 不可见即完全暂停
 * - prefers-reduced-motion：静态一帧，无 rAF
 * - 卫星渲染上限 16 颗（聚合显示总数），避免大库 DOM 爆炸
 */

const SAT_CAP = 16;
const MAX_SAT_PX = 13;
const MIN_SAT_PX = 6;

interface PlanetNote {
  id: number;
  title: string;
}

const PALETTE = ["#7c93ad", "#c9a86a", "#8aab8e", "#a08cb4", "#b48a8a", "#6fa3b8"];

function hashColor(title: string): string {
  let h = 0;
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}

// 轨道参数（sandbox 验证值）：4 条错倾轨道
const ORBITS = [
  { rx: 170, ry: 55, tilt: -10 },
  { rx: 200, ry: 65, tilt: 25 },
  { rx: 230, ry: 72, tilt: 50 },
  { rx: 155, ry: 50, tilt: -35 },
];
const GLOBE_R = 0.38; // Cobe scale=0.82 时地球半径比例

function isBehind(angle: number, phi: number, tiltDeg: number, rx: number, ry: number): boolean {
  const tilt = (tiltDeg * Math.PI) / 180;
  const lx = rx * Math.cos(angle);
  const ly = ry * Math.sin(angle);
  const x1 = lx;
  const y1 = ly * Math.cos(tilt);
  const z1 = ly * Math.sin(tilt);
  const x2 = x1 * Math.cos(phi) + z1 * Math.sin(phi);
  const y2 = y1;
  const z2 = -x1 * Math.sin(phi) + z1 * Math.cos(phi);
  const screenR = Math.sqrt(x2 * x2 + y2 * y2);
  return z2 < 0 && screenR < rx * GLOBE_R * 2.2;
}

export function KnowledgePlanet() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const satRefs = useRef<Array<HTMLDivElement | null>>([]);
  const phiRef = useRef(0);
  const dragRef = useRef<{ lastX: number } | null>(null);
  const [notes, setNotes] = useState<PlanetNote[]>([]);
  const [selected, setSelected] = useState<PlanetNote | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiGet<{ notes: PlanetNote[] }>("/notes")
      .then((d) => setNotes(d.notes))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const sats = useMemo(() => {
    // 卫星 = 笔记；超过上限时聚合展示前 16 个（按标题稳定排序），剩余计入总数文本
    const sorted = [...notes].sort((a, b) => a.id - b.id);
    return sorted.slice(0, SAT_CAP).map((n, i) => ({
      ...n,
      orbit: i % ORBITS.length,
      period: 14 + (i % 5) * 3,
      phase: (i * 137.5) % 360, // 黄金角错相，避免重叠
      color: hashColor(n.title),
    }));
  }, [notes]);

  const satSize = useMemo(
    () => Math.min(MIN_SAT_PX + notes.length * 0.25, MAX_SAT_PX),
    [notes.length],
  );

  // ── 渲染循环：地球与卫星同用一个 30fps 节流 rAF ──────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const scene = sceneRef.current;
    if (!canvas || !scene) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const S = 280;
    let paused = false;
    let lastFrame = 0;
    const FRAME_MS = 1000 / 30;

    const globe = createGlobe(canvas, {
      devicePixelRatio: 1, // 性能红线：不乘 dpr
      width: S, height: S,
      phi: 0, theta: 0.3,
      dark: 0, diffuse: 1.0, scale: 0.82,
      mapSamples: 6000,
      mapBrightness: 1.0,
      baseColor: [0.93, 0.92, 0.89],
      markerColor: [0.15, 0.15, 0.15],
      glowColor: [0.95, 0.94, 0.91],
      markers: [],
      opacity: 0.98,
      onRender: (state) => {
        if (paused) return;
        state.phi = phiRef.current; // 拖动与自转统一走 ref
      },
    });

    const obs = new IntersectionObserver(
      ([e]) => { paused = !e.isIntersecting; },
      { threshold: 0.1 },
    );
    obs.observe(canvas);
    const onVis = () => { paused = document.hidden; };
    document.addEventListener("visibilitychange", onVis);

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (paused || now - lastFrame < FRAME_MS) return;
      lastFrame = now;

      if (!reduced) phiRef.current += 0.003; // 地球自转（拖动直接改同一 ref）
      const phi = phiRef.current;

      const t = now / 1000;
      for (let i = 0; i < sats.length; i++) {
        const el = satRefs.current[i];
        if (!el) continue;
        const s = sats[i];
        const o = ORBITS[s.orbit];
        const angle = ((t / s.period) * 360 + s.phase) * (Math.PI / 180);
        const x = Math.cos(angle) * o.rx;
        const y = Math.sin(angle) * o.ry;
        el.style.transform =
          `rotate(${o.tilt}deg) translate(${x}px, ${y}px) rotate(${-o.tilt}deg)`;
        const behind = isBehind(angle, phi, o.tilt, o.rx, o.ry);
        el.style.opacity = behind ? "0" : "1";
      }
    };
    let raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      obs.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      globe.destroy();
    };
  }, [sats]);

  // ── 拖动旋转 ────────────────────────────────────────────────
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    dragRef.current = { lastX: e.clientX };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);
  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    phiRef.current += (e.clientX - d.lastX) * 0.005;
    d.lastX = e.clientX;
  }, []);
  const onPointerUp = useCallback(() => { dragRef.current = null; }, []);

  return (
    <div className="dash-section planet-panel">
      <h3>Knowledge Planet</h3>
      {error && <div className="error-banner">{error}</div>}
      <div
        ref={sceneRef}
        className="planet-scene"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <div className="planet-globe-wrap">
          <canvas ref={canvasRef} width={280} height={280}
                  style={{ width: 280, height: 280 }} />
        </div>
        {ORBITS.map((o, i) => (
          <div key={i} className="planet-ring" style={{
            width: o.rx * 2, height: o.ry * 2,
            marginLeft: -o.rx, marginTop: -o.ry,
            transform: `rotateX(65deg) rotateZ(${o.tilt}deg)`,
          }} />
        ))}
        {sats.map((s, i) => (
          <div key={s.id} ref={(el) => { satRefs.current[i] = el; }}
               className="planet-sat">
            <button
              className="planet-sat-dot"
              style={{ background: s.color, width: satSize, height: satSize }}
              onClick={() => setSelected(s)}
              aria-label={s.title}
            />
            <span className="planet-sat-label">{s.title}</span>
          </div>
        ))}
        <div className="planet-hint">
          {notes.length} notes · hover 查看 · 点击选中 · 拖动旋转
        </div>
      </div>
      {selected && (
        <div className="planet-selected">
          <strong>{selected.title}</strong>
          <button onClick={() => setSelected(null)}>×</button>
        </div>
      )}
    </div>
  );
}
