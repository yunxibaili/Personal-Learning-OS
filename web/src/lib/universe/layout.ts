/**
 * Universe 布局引擎（P8-001B，graph-core 纯函数）。
 *
 * 分层铁律（separation.md ADR-008）：UI 组件内禁止图计算；布局引擎独立模块。
 * 本模块不 import React、不 import @xyflow/react，可被 vitest 直接测试。
 *
 * 职责：
 *   - domainGrouping: 按 domain 分组，计算各域中心点（径向分布）
 *   - forceLayout:    d3-force 物理模拟 → 节点坐标快照（确定性）
 *   - centralPlanet:  中央星球聚合统计（半径/光晕/轨道/呼吸）
 *   - settleNode:     拖动单个节点后重新 settle 其它节点（node.fx/fy）
 *
 * ADR-007 约束：仅 d3-force；不引入 d3-selection/scale/transition。
 * ADR-023 约束：本布局仅供 Universe（concept-centric），不用于 Graph/MindMap。
 */

import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
} from "d3-force";

export interface LayoutConcept {
  id: number;
  domain: string | null;
  mastery: number | null; // effective
}

export interface LayoutEdge {
  source: number;
  target: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface DomainGroup {
  domain: string;
  center: Point;
  count: number;
  ids: number[];
}

export interface PlanetStats {
  conceptCount: number;
  domainCount: number;
  masterySum: number;
  masteryAvg: number;
  hasMastery: number;
}

const WORLD = 1400;
const DOMAIN_RADIUS = 300;

/** 空域兜底标签（concepts.domain 为 null 时归入） */
export const NO_DOMAIN = "未分类";

/**
 * 把 concept 按 domain 分组。稳定顺序：按首次出现排序（保持确定性）。
 */
export function domainGrouping(nodes: LayoutConcept[]): DomainGroup[] {
  const order: string[] = [];
  const map = new Map<string, number[]>();
  for (const n of nodes) {
    const d = n.domain || NO_DOMAIN;
    if (!map.has(d)) {
      map.set(d, []);
      order.push(d);
    }
      map.get(d)!.push(n.id);
  }
  // 按概念数降序（确定性：数量相同再按域名排序）
  const sorted = order
    .map((d) => ({ domain: d, ids: map.get(d)! }))
    .sort((a, b) => b.ids.length - a.ids.length || a.domain.localeCompare(b.domain));

  return sorted.map((g, i) => {
    const angle = (i / Math.max(sorted.length, 1)) * Math.PI * 2 - Math.PI / 2;
    return {
      domain: g.domain,
      center: {
        x: Math.cos(angle) * DOMAIN_RADIUS,
        y: Math.sin(angle) * DOMAIN_RADIUS,
      },
      count: g.ids.length,
      ids: g.ids,
    };
  });
}

/**
 * 中央星球聚合统计（纯前端聚合，不入库、无 id、不参与 links/mastery 写入）。
 */
export function centralPlanet(nodes: LayoutConcept[]): PlanetStats {
  const conceptCount = nodes.length;
  const domainCount = new Set(nodes.map((n) => n.domain || NO_DOMAIN)).size;
  const masterySum = nodes.reduce((s, n) => s + (n.mastery ?? 0), 0);
  const hasMastery = nodes.filter((n) => n.mastery && n.mastery > 0).length;
  return {
    conceptCount,
    domainCount,
    masterySum,
    masteryAvg: conceptCount ? masterySum / conceptCount : 0,
    hasMastery,
  };
}

/** 确定性伪随机：基于 id 哈希的 jitter，保证同输入同输出（测试/首屏一致）。 */
function seededJitter(id: number, scale = 80): number {
  const h = (id * 2654435761) % 4294967296;
  const u = (h % 1000) / 1000; // 0..1
  return (u - 0.5) * scale;
}

/**
 * d3-force 力导向布局 → 节点坐标快照。
 *
 * 策略（domain 聚类）：
 *   - forceX/forceY 向所属 domain 中心吸引（聚类核心）
 *   - forceManyBody 斥力（防重叠）
 *   - forceLink 边弹簧（关系紧密的靠拢）
 *   - forceCollide 碰撞（节点半径）
 *   - 固定迭代次数 tick + 确定性 jitter → 输出完全由输入决定
 *
 * 返回 Map<nodeId, Point>。fixed: 可传入用户锁定坐标（拖动），不参与模拟。
 */
export function forceLayout(
  nodes: LayoutConcept[],
  edges: LayoutEdge[],
  opts: {
    radius?: (id: number) => number;
    fixed?: Map<number, Point>;
    iterations?: number;
  } = {},
): Map<number, Point> {
  const groups = domainGrouping(nodes);
  const centerBy = new Map<string, Point>();
  for (const g of groups) centerBy.set(g.domain, g.center);

  const fixed = opts.fixed ?? new Map();
  const iter = opts.iterations ?? 220;
  const radius = opts.radius ?? (() => 16);

  // 构建 d3 节点/链接对象
  const d3Nodes = nodes.map((n) => {
    const c = centerBy.get(n.domain || NO_DOMAIN)!;
    const fx = fixed.get(n.id);
    return {
      id: n.id,
      domain: n.domain || NO_DOMAIN,
      x: fx?.x ?? c.x + seededJitter(n.id),
      y: fx?.y ?? c.y + seededJitter(n.id),
      // 锁定：d3-force 在 tick 时会固定 fx/fy，不参与力计算
      fx: fx?.x ?? null,
      fy: fx?.y ?? null,
      vx: 0,
      vy: 0,
    };
  });
  const idSet = new Map(d3Nodes.map((d) => [d.id, d]));
  const d3Links = edges
    .filter((e) => idSet.has(e.source) && idSet.has(e.target))
    .map((e) => ({ source: idSet.get(e.source)!, target: idSet.get(e.target)! }));

  const sim = forceSimulation(d3Nodes)
    .force("x", forceX<typeof d3Nodes[number]>((d) => centerBy.get(d.domain)?.x ?? 0).strength(0.15))
    .force("y", forceY<typeof d3Nodes[number]>((d) => centerBy.get(d.domain)?.y ?? 0).strength(0.15))
    .force("charge", forceManyBody().strength(-160))
    .force("link", forceLink(d3Links).id((d: any) => d.id).distance(70).strength(0.3))
    .force("collide", forceCollide((d: any) => radius(d.id) + 8))
    .force("center", forceCenter(0, 0).strength(0.01))
    .stop();

  for (let i = 0; i < iter; i++) sim.tick();

  const out = new Map<number, Point>();
  for (const d of d3Nodes) out.set(d.id, { x: d.x, y: d.y });
  return out;
}

/**
 * 拖动单个节点后重新 settle：锁定被拖节点（fx/fy），重跑短迭代让周边重排。
 * 返回全部节点新坐标。纯函数：输入不动点 + 数据 → 输出新坐标。
 */
export function settleOnDrag(
  nodes: LayoutConcept[],
  edges: LayoutEdge[],
  dragId: number,
  dragPos: Point,
  opts: { iterations?: number } = {},
): Map<number, Point> {
  const fixed = new Map<number, Point>();
  fixed.set(dragId, dragPos);
  return forceLayout(nodes, edges, {
    fixed,
    radius: () => 16,
    iterations: opts.iterations ?? 60,
  });
}

/**
 * 布局快照规范化：将坐标对齐到原点居中（用于首次 fitView 前缩放到画布中心）。
 */
export function normalizeToCenter(
  positions: Map<number, Point>,
  target = { x: 0, y: 0 },
): Map<number, Point> {
  const pts = [...positions.values()];
  if (pts.length === 0) return positions;
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  const out = new Map<number, Point>();
  for (const [id, p] of positions) {
    out.set(id, { x: p.x - cx + target.x, y: p.y - cy + target.y });
  }
  return out;
}

export interface UniverseLayoutResult {
  positions: Map<number, Point>;
  groups: DomainGroup[];
  planet: PlanetStats;
  width: number;
  height: number;
}

/**
 * 一站式布局：输入 concepts/edges → 输出坐标 + 域分组 + 星球统计 + 画布尺寸。
 * 组件层唯一调用入口（渲染层不再碰图计算）。
 */
export function computeUniverseLayout(
  nodes: LayoutConcept[],
  edges: LayoutEdge[],
  opts: { fixed?: Map<number, Point>; iterations?: number } = {},
): UniverseLayoutResult {
  const positions = forceLayout(nodes, edges, {
    fixed: opts.fixed,
    iterations: opts.iterations,
    radius: () => 16,
  });
  const centered = normalizeToCenter(positions);
  return {
    positions: centered,
    groups: domainGrouping(nodes),
    planet: centralPlanet(nodes),
    width: WORLD,
    height: WORLD,
  };
}
