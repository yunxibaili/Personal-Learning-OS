/**
 * PlanetNode（P8-001B）：中央知识星球 —— 聚合导航视觉。
 *
 * ADR-023 冻结：
 *   - 非概念实体：不入 concepts 表、无 id、不参与 links/mastery/review/事件
 *   - 纯前端聚合视图（数据来自 layout.ts centralPlanet 统计）
 *   - 数据→视觉映射：concept 数→半径 · mastery 总量→光晕 · 活跃→呼吸 · domain 数→轨道
 *
 * ADR-013 克制：
 *   - 平面视觉，无粒子 / 星空 / 3D / 光污染
 *   - 呼吸动画 8-12s scale 1.00↔1.02（微弱）
 */
import { Position, Handle } from "@xyflow/react";

export interface PlanetNodeData extends Record<string, unknown> {
  conceptCount: number;
  domainCount: number;
  masteryAvg: number;
  hasMastery: number;
}

/** concept 数 → 星球半径（40 ~ 84px） */
function planetRadius(count: number): number {
  if (count <= 0) return 40;
  return Math.min(84, 40 + count * 1.4);
}

/** mastery 平均 → 光晕强度（微弱，禁光污染）：0.15 ~ 0.4 opacity */
function glowAlpha(avg: number): number {
  return 0.15 + Math.min(0.25, avg * 0.3);
}

/** domain 数 → 轨道圆环数（0~4，克制） */
function orbitCount(domains: number): number {
  return Math.min(4, domains);
}

export function PlanetNode({ data }: { data: PlanetNodeData }) {
  const d = data as unknown as PlanetNodeData;
  const r = planetRadius(d.conceptCount);
  const glow = glowAlpha(d.masteryAvg);
  const orbits = orbitCount(d.domainCount);
  const breath =
    d.hasMastery > 0 && d.conceptCount > 0
      ? "planet-breath"
      : "";

  return (
    <>
      <Handle type="target" position={Position.Top} style={{ visibility: "hidden" }} />
      <div
        className="planet"
        style={{
          width: r * 2,
          height: r * 2,
          animationDuration: `${9 + (d.conceptCount % 4)}s`,
        }}
      >
        {/* 光晕（微光，非发光堆砌） */}
        <div
          className="planet-glow"
          style={{ opacity: glow, width: r * 2.6, height: r * 2.6 }}
        />
        {/* 轨道环（domain 数量） */}
        {orbits > 0 && (
          <div className="planet-orbits" aria-hidden>
            {Array.from({ length: orbits }).map((_, i) => (
              <span
                key={i}
                className="planet-orbit"
                style={{ width: r * 2 + (i + 1) * 18, height: r * 2 + (i + 1) * 18 }}
              />
            ))}
          </div>
        )}
        {/* 核心 */}
        <div className={`planet-core${breath ? ` ${breath}` : ""}`}>
          <span className="planet-label">Knowledge</span>
          <span className="planet-sub">{d.conceptCount} concepts</span>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} style={{ visibility: "hidden" }} />
    </>
  );
}
