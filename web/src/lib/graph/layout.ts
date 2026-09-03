/**
 * Graph 布局引擎（P8-002，dagre 层级布局 + 稀疏图两阶段扩展）。
 *
 * 分层铁律（separation.md ADR-008）：UI 组件内禁止图计算；布局引擎独立模块。
 * 本模块不 import React、不 import @xyflow/react，可被 vitest 直接测试。
 *
 * 职责：
 *   - dagreLayout: 连通分量走 dagre 拓扑排序 + 坐标分配；孤立（无任何边的）
 *     节点走 grid 散开（避免 dagre 默认行为把全部孤立节点塞在 rank 0 同一条横线）。
 *
 * ADR-023 约束：本布局仅供 Graph（relationship exploration），不用于 Universe/MindMap。
 */

import Dagre from "dagre";

export interface LayoutNode {
  id: string;
  type: "concept" | "note";
  width: number;
  height: number;
}

export interface LayoutEdge {
  id: string;
  source: string;
  target: string;
}

export interface LayoutResult {
  nodes: Array<{ id: string; x: number; y: number }>;
  edges: Array<{ id: string; source: string; target: string }>;
  width: number;
  height: number;
}

const NODEsep = 40;
const EDGEsep = 30;
const RANKsep = 60;
const GRID_GAP = 60; // 孤立节点 grid 与 dagre 连通区之间的最小间距

/**
 * 两阶段层级布局：
 *  1) dagre TB 排连通分量（保留原 TB 层级语义与确定性）；
 *  2) 把无边节点按 grid 排在画布右侧，避免堆在 rank 0 同一行。
 */
export function dagreLayout(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
): LayoutResult {
  const g = new Dagre.graphlib.Graph({ compound: true })
    .setGraph({ rankdir: "TB", nodesep: NODEsep, edgesep: EDGEsep, ranksep: RANKsep })
    .setDefaultEdgeLabel(() => ({}));

  for (const n of nodes) {
    g.setNode(n.id, { width: n.width, height: n.height });
  }
  for (const e of edges) {
    g.setEdge(e.source, e.target);
  }

  Dagre.layout(g);

  // 1. dagre 阶段：所有节点先取 dagre 坐标。
  const positioned = new Map<string, { x: number; y: number; w: number; h: number }>();
  let dagreMaxX = 0;
  for (const n of nodes) {
    const pos = g.node(n.id);
    const p = { x: pos.x, y: pos.y, w: n.width, h: n.height };
    positioned.set(n.id, p);
    const right = p.x + p.w / 2;
    if (right > dagreMaxX) dagreMaxX = right;
  }

  // 2. 识别孤立节点（无任何边端到该点）。
  const connected = new Set<string>();
  for (const e of edges) {
    connected.add(e.source);
    connected.add(e.target);
  }
  const isolated = nodes.filter((n) => !connected.has(n.id));

  // 3. 孤立节点 grid 布局（确定：id 字典序；列数封顶 6，避免稀疏图宽到
  //    fitView 后缩得太小、节点变成看不清的像素）。
  if (isolated.length > 0) {
    const cols = Math.max(1, Math.min(6, Math.ceil(Math.sqrt(isolated.length))));
    const sorted = [...isolated].sort((a, b) => a.id.localeCompare(b.id));
    const gridStartX = dagreMaxX + GRID_GAP;
    const baseH = Math.max(...isolated.map((n) => n.height));
    for (let i = 0; i < sorted.length; i++) {
      const n = sorted[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = gridStartX + col * (n.width + GRID_GAP);
      const y = baseH / 2 + row * (n.height + GRID_GAP);
      positioned.set(n.id, { x, y, w: n.width, h: n.height });
    }
  }

  // 4. 画布尺寸：取所有节点最终坐标的最右/最下。
  let canvasMaxX = 0;
  let canvasMaxY = 0;
  for (const n of nodes) {
    const p = positioned.get(n.id)!;
    const right = p.x + p.w / 2;
    const bottom = p.y + p.h / 2;
    if (right > canvasMaxX) canvasMaxX = right;
    if (bottom > canvasMaxY) canvasMaxY = bottom;
  }

  return {
    nodes: nodes.map((n) => {
      const p = positioned.get(n.id)!;
      return { id: n.id, x: p.x, y: p.y };
    }),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
    })),
    width: canvasMaxX + NODEsep,
    height: canvasMaxY + NODEsep,
  };
}

/** 默认节点尺寸 */
export const DEFAULT_NODE_SIZE = {
  concept: { width: 160, height: 40 },
  note: { width: 180, height: 36 },
};