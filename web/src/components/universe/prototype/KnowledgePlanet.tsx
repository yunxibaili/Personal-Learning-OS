import { useState, useCallback, useMemo } from "react";
import type { Satellite } from "./planet.types";
import "./planet.css";

const SATELLITES: Satellite[] = [
  { id: "math", name: "数学分析", color: "#4a9eff", period: 18, rotation: -15, xRadius: 200, yRadius: 55, notes: 12, lastUpdated: "2h ago" },
  { id: "physics", name: "量子力学", color: "#22c55e", period: 24, rotation: 30, xRadius: 240, yRadius: 70, notes: 8, lastUpdated: "1d ago" },
  { id: "cs", name: "算法与数据结构", color: "#f97316", period: 14, rotation: 65, xRadius: 170, yRadius: 48, notes: 23, lastUpdated: "3h ago" },
  { id: "philosophy", name: "科学哲学", color: "#a855f7", period: 30, rotation: -45, xRadius: 280, yRadius: 85, notes: 5, lastUpdated: "5d ago" },
  { id: "linguistics", name: "形式语言理论", color: "#ef4444", period: 20, rotation: 80, xRadius: 220, yRadius: 60, notes: 15, lastUpdated: "12h ago" },
];

const R = 140;
const TILT = -18 * (Math.PI / 180);

// ── 球面投影 ──
function project(lat: number, lon: number): [number, number] {
  const latR = (lat * Math.PI) / 180;
  const lonR = (lon * Math.PI) / 180;
  const x = R * Math.cos(latR) * Math.sin(lonR);
  const y = R * Math.sin(latR);
  const z = R * Math.cos(latR) * Math.cos(lonR);
  const y2 = y * Math.cos(TILT) - z * Math.sin(TILT);
  const z2 = y * Math.sin(TILT) + z * Math.cos(TILT);
  const scale = 1 / (1 + z2 / 900);
  return [x * scale, -y2 * scale];
}

// ── 经纬线 ──
function linePath(degrees: number[], axis: "lat" | "lon"): string {
  const pts: string[] = [];
  for (let i = 0; i <= 60; i++) {
    const t = (i / 60) * 360;
    const [px, py] = axis === "lat"
      ? project(degrees[0], t)
      : project(t - 180, degrees[0]);
    pts.push(`${px},${py}`);
  }
  return pts.join(" ");
}

// ── 世界地图点阵（简化大陆轮廓） ──
const LAND_DOTS: [number, number][] = [
  // 北美
  [55, -100], [50, -120], [48, -90], [45, -75], [42, -80], [38, -95],
  [35, -100], [33, -115], [30, -90], [28, -82], [25, -80], [20, -100],
  [18, -98], [15, -90], [48, -110], [52, -110], [55, -115], [58, -110],
  [60, -100], [62, -95], [64, -90], [60, -85], [55, -80], [50, -85],
  [45, -85], [43, -88], [40, -83], [38, -78], [36, -76], [34, -78],
  [32, -82], [30, -85], [28, -88], [26, -82], [24, -82], [26, -80],
  // 南美
  [10, -72], [8, -62], [5, -55], [2, -60], [-2, -45], [-5, -35],
  [-8, -35], [-10, -37], [-15, -40], [-18, -42], [-22, -42], [-25, -48],
  [-28, -49], [-30, -52], [-33, -55], [-35, -58], [-38, -62], [-40, -65],
  [-42, -65], [-45, -68], [-48, -72], [-50, -74], [-52, -70], [-48, -65],
  [-44, -65], [-40, -62], [-35, -55], [-30, -50], [-25, -45], [-20, -40],
  [-15, -38], [-10, -36], [-5, -40], [0, -50], [5, -60], [8, -65],
  // 欧洲
  [60, 10], [62, 15], [64, 20], [65, 25], [63, 30], [60, 30],
  [58, 28], [55, 25], [52, 20], [50, 15], [48, 12], [46, 10],
  [44, 8], [42, 5], [40, 0], [38, -5], [36, -6], [38, -8],
  [40, -10], [42, -9], [44, -5], [46, 0], [48, 5], [50, 8],
  [52, 10], [54, 12], [56, 10], [58, 8], [55, 15], [52, 18],
  [50, 20], [48, 22], [46, 20], [44, 18], [42, 15], [40, 20],
  [38, 22], [36, 25], [38, 28], [40, 30], [42, 28], [44, 25],
  // 非洲
  [35, 10], [33, 8], [30, 5], [28, 0], [25, -5], [22, -8],
  [18, -12], [15, -15], [12, -12], [10, -10], [8, -5], [5, 0],
  [2, 5], [0, 10], [-2, 15], [-5, 20], [-8, 25], [-10, 30],
  [-12, 32], [-15, 35], [-18, 35], [-22, 35], [-25, 33], [-28, 30],
  [-30, 28], [-32, 26], [-34, 24], [-33, 20], [-30, 18], [-28, 16],
  [-25, 14], [-22, 12], [-18, 10], [-15, 8], [-12, 10], [-8, 12],
  [-5, 10], [-2, 8], [0, 8], [2, 10], [5, 12], [8, 15],
  [10, 18], [12, 20], [15, 22], [18, 25], [20, 28], [22, 30],
  [25, 32], [28, 33], [30, 32], [32, 30], [33, 12], [35, 12],
  // 亚洲
  [55, 40], [58, 45], [60, 50], [62, 55], [64, 60], [66, 65],
  [68, 70], [65, 75], [62, 70], [60, 65], [58, 60], [55, 55],
  [52, 50], [50, 45], [48, 40], [45, 38], [42, 35], [40, 32],
  [38, 30], [35, 28], [32, 28], [30, 30], [28, 32], [25, 35],
  [22, 38], [20, 40], [18, 42], [15, 45], [12, 48], [10, 50],
  [8, 52], [5, 55], [2, 58], [0, 60], [-2, 62], [-5, 65],
  [-8, 68], [-8, 72], [-6, 75], [-4, 78], [-2, 80], [0, 82],
  [2, 85], [5, 88], [8, 90], [10, 92], [12, 95], [15, 98],
  [18, 100], [20, 102], [22, 105], [25, 108], [28, 110], [30, 112],
  [32, 115], [34, 118], [36, 120], [38, 122], [40, 125], [42, 128],
  [44, 130], [46, 132], [48, 135], [50, 138], [52, 140], [54, 142],
  [56, 140], [58, 138], [60, 135], [62, 130], [64, 125], [66, 120],
  [65, 110], [63, 100], [60, 90], [58, 80], [55, 70], [52, 60],
  [50, 55], [48, 50], [45, 45], [42, 42], [40, 40], [38, 38],
  // 印度
  [30, 70], [28, 72], [25, 75], [22, 78], [20, 80], [18, 78],
  [15, 76], [12, 75], [10, 77], [8, 78], [10, 80], [12, 82],
  [15, 82], [18, 84], [20, 86], [22, 88], [25, 90], [28, 88],
  // 日本
  [45, 142], [43, 143], [40, 140], [38, 138], [35, 136], [33, 132],
  [34, 130], [36, 134], [38, 137], [40, 140], [42, 142], [44, 143],
  // 澳大利亚
  [-15, 130], [-18, 128], [-20, 125], [-22, 120], [-25, 118], [-28, 115],
  [-30, 118], [-32, 120], [-34, 122], [-36, 125], [-38, 145], [-36, 148],
  [-34, 150], [-32, 152], [-30, 153], [-28, 153], [-25, 152], [-22, 150],
  [-20, 148], [-18, 146], [-16, 144], [-14, 142], [-12, 140], [-14, 135],
  [-16, 132], [-18, 130], [-20, 128], [-22, 125], [-24, 122], [-26, 120],
  [-28, 118], [-30, 115], [-32, 118], [-34, 120], [-35, 138], [-37, 140],
  [-38, 142], [-37, 145], [-35, 148], [-33, 150], [-30, 152],
];

// 连线关系（知识图谱边）
const EDGES: [string, string][] = [
  ["math", "cs"],
  ["math", "physics"],
  ["cs", "linguistics"],
  ["physics", "philosophy"],
  ["philosophy", "linguistics"],
];

// ── 轨道椭圆路径 ──
function orbitPath(rx: number, ry: number, segments = 80): string {
  const pts: string[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts.push(`${rx * Math.cos(a)},${ry * Math.sin(a)}`);
  }
  return `M${pts.join("L")}Z`;
}

export default function KnowledgePlanet() {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedSat = useMemo(
    () => (selectedId ? SATELLITES.find((s) => s.id === selectedId) ?? null : null),
    [selectedId]
  );

  const satMap = useMemo(() => {
    const m = new Map<string, Satellite>();
    SATELLITES.forEach((s) => m.set(s.id, s));
    return m;
  }, []);

  const handleBackgroundClick = useCallback(() => setSelectedId(null), []);

  return (
    <div className="planet-root" onClick={handleBackgroundClick}>
      <div className="planet-header">
        <span className="planet-title">Knowledge Planet</span>
        <span className="planet-hint">hover → 探索 · drag → 旋转 · click → 进入</span>
      </div>

      <div className="planet-canvas">
        <svg className="planet-svg" viewBox="-400 -400 800 800">
          {/* ── 轨道环 ── */}
          {SATELLITES.map((s) => (
            <path
              key={`orbit-${s.id}`}
              d={orbitPath(s.xRadius, s.yRadius)}
              fill="none"
              stroke="#ccc"
              strokeWidth="0.5"
              opacity={hoveredId === s.id ? 0.6 : 0.3}
              transform={`rotate(${s.rotation})`}
            />
          ))}

          {/* ── 球体经纬线 ── */}
          {[-60, -30, 0, 30, 60].map((lat) => (
            <polyline
              key={`lat-${lat}`}
              points={linePath([lat], "lat")}
              fill="none"
              stroke="#bbb"
              strokeWidth="0.4"
              opacity="0.45"
            />
          ))}
          {[-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150].map((lon) => (
            <polyline
              key={`lon-${lon}`}
              points={linePath([lon], "lon")}
              fill="none"
              stroke="#bbb"
              strokeWidth="0.4"
              opacity="0.45"
            />
          ))}

          {/* ── 世界地图点阵 ── */}
          {LAND_DOTS.map(([lat, lon], i) => {
            const [px, py] = project(lat, lon);
            return (
              <circle key={`land-${i}`} cx={px} cy={py} r="1.3" fill="#b0ada5" opacity="0.4" />
            );
          })}

          {/* ── 卫星连线 ── */}
          {EDGES.map(([a, b]) => {
            const sa = satMap.get(a);
            const sb = satMap.get(b);
            if (!sa || !sb) return null;
            const ax = Math.cos((sa.rotation * Math.PI) / 180) * sa.xRadius;
            const ay = Math.sin((sa.rotation * Math.PI) / 180) * sa.xRadius * (sa.yRadius / sa.xRadius);
            const bx = Math.cos((sb.rotation * Math.PI) / 180) * sb.xRadius;
            const by = Math.sin((sb.rotation * Math.PI) / 180) * sb.xRadius * (sb.yRadius / sb.xRadius);
            return (
              <line
                key={`edge-${a}-${b}`}
                x1={ax} y1={ay} x2={bx} y2={by}
                stroke="#ccc"
                strokeWidth="0.5"
                opacity="0.4"
              />
            );
          })}

          {/* ── 球体轮廓 ── */}
          <circle cx="0" cy="0" r={R} fill="none" stroke="#c5c0b8" strokeWidth="0.6" opacity="0.5" />
        </svg>

        {/* ── CSS 动画卫星 ── */}
        {SATELLITES.map((s) => (
          <div
            key={s.id}
            className="sat-orbit"
            style={{
              ["--x-radius" as string]: `${s.xRadius}px`,
              ["--y-radius" as string]: `${s.yRadius}px`,
              ["--rotation" as string]: `${s.rotation}deg`,
              ["--period" as string]: `${s.period}s`,
            }}
          >
            <div
              id={`sat-${s.id}`}
              className="sat-body"
              onMouseEnter={() => setHoveredId(s.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedId((prev) => (prev === s.id ? null : s.id));
              }}
            >
              <div
                className={`sat-dot${hoveredId === s.id ? " sat-hover" : ""}${selectedId === s.id ? " sat-selected" : ""}`}
                style={{ background: s.color }}
              />
              {hoveredId === s.id && <span className="sat-name">{s.name}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* ── 选中指示器 ── */}
      {selectedSat && (
        <div className="planet-indicator" onClick={(e) => e.stopPropagation()}>
          <div className="indicator-ring" style={{ borderColor: selectedSat.color }}>
            <div className="indicator-dot" style={{ background: selectedSat.color }} />
          </div>
          <span className="indicator-name">{selectedSat.name}</span>
        </div>
      )}
    </div>
  );
}
