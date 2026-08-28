/**
 * Graph 布局引擎（P8-002，dagre 层级布局）。
 *
 * 分层铁律（separation.md ADR-008）：UI 组件内禁止图计算；布局引擎独立模块。
 * 本模块不 import React、不 import @xyflow/react，可被 vitest 直接测试。
 *
 * 职责：
 *   - dagreLayout: dagre 拓扑排序 + 坐标分配 → 节点坐标快照
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

/**
 * dagre 层级布局：拓扑排序 → 分层 → 坐标分配。
 *
 * @param nodes  节点列表（需提供 id / type / width / height）
 * @param edges  边列表（需提供 id / source / target）
 * @returns      布局后的坐标 + 画布尺寸
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

  const resultNodes = nodes.map((n) => {
    const pos = g.node(n.id);
    return { id: n.id, x: pos.x, y: pos.y };
  });

  const resultEdges = edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
  }));

  // 计算画布边界
  let maxX = 0;
  let maxY = 0;
  for (const n of resultNodes) {
    const node = g.node(n.id);
    const right = n.x + (node.width ?? 0) / 2;
    const bottom = n.y + (node.height ?? 0) / 2;
    if (right > maxX) maxX = right;
    if (bottom > maxY) maxY = bottom;
  }

  return {
    nodes: resultNodes,
    edges: resultEdges,
    width: maxX + NODEsep,
    height: maxY + NODEsep,
  };
}

/** 默认节点尺寸 */
export const DEFAULT_NODE_SIZE = {
  concept: { width: 160, height: 40 },
  note: { width: 180, height: 36 },
};
