/**
 * KnowledgeUniverse（M3b-004 → P8-001B）：Knowledge Planet 主容器。
 *
 * ADR-018/023 冻结：
 *   - 节点 = Concept（非 Note）· 边 = links（concept↔concept）
 *   - 布局 = d3-force 物理（ADR-007）+ React Flow 渲染
 *   - 禁止：3D / 粒子 / 星空 / 游戏化 / 光污染
 *
 * P8-001B（Spatial Experience）：
 *   - computeUniverseLayout 纯函数（lib/universe/layout.ts）→ force 聚类
 *   - PlanetNode 中央聚合星球（前端合成，不入库）
 *   - ConceptNode hover 抬升 + weak 状态环
 *   - Floating Inspector 替换右侧大抽屉（保留能力，供 P8-003 复用）
 *   - Planet / viewport 拖动 → localStorage（视图状态，非数据库）
 */
import "@xyflow/react/dist/style.css";

import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type NodeTypes,
  type OnNodeDrag,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { apiGet } from "../../lib/api";
import { computeUniverseLayout } from "../../lib/universe/layout";
import { useUi } from "../../stores/ui";
import { ConceptNode, type ConceptNodeData } from "./ConceptNode";
import { PlanetNode, type PlanetNodeData } from "./PlanetNode";

/** Universe API 响应 */
interface UniverseNode {
  id: number;
  label: string;
  type: string;
  domain: string | null;
  status: string;
  mastery: {
    effective: number;
    knowledge: number;
    practice: number;
    recall: number;
    transfer: number;
  } | null;
}

interface UniverseEdge {
  source: number;
  target: number;
  relation: string;
}

interface UniverseResponse {
  nodes: UniverseNode[];
  edges: UniverseEdge[];
}

/** 视图模式 */
type ViewMode = "all" | "weak" | "focus";

/** React Flow 节点类型注册 */
const nodeTypes: NodeTypes = { concept: ConceptNode, planet: PlanetNode };

const LS_VIEWPORT_KEY = "plos.universe.viewport";
const LS_FIXED_KEY = "plos.universe.fixed";

/** mastery 百分比 */
function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

/** mastery 状态 */
function masteryLabel(effective: number): string {
  if (effective <= 0) return "Unlearned";
  if (effective < 0.3) return "Weak";
  if (effective < 0.7) return "Learning";
  return "Mastered";
}

/** mastery 颜色 */
function masteryColor(effective: number): string {
  if (effective <= 0) return "#e5e5e5";
  if (effective < 0.7) return "#ff8a00";
  return "#1a1a1a";
}

/** 构建邻接表 */
function buildAdjacency(edges: UniverseEdge[]): Map<number, Set<number>> {
  const adj = new Map<number, Set<number>>();
  for (const e of edges) {
    if (!adj.has(e.source)) adj.set(e.source, new Set());
    if (!adj.has(e.target)) adj.set(e.target, new Set());
    adj.get(e.source)!.add(e.target);
    adj.get(e.target)!.add(e.source);
  }
  return adj;
}

/** 获取 N-hop 邻居 ID 集合 */
function getNeighbors(
  startId: number,
  adj: Map<number, Set<number>>,
  depth: number,
): Set<number> {
  const visited = new Set<number>([startId]);
  let frontier = new Set<number>([startId]);
  for (let d = 0; d < depth; d++) {
    const next = new Set<number>();
    for (const id of frontier) {
      const neighbors = adj.get(id);
      if (!neighbors) continue;
      for (const n of neighbors) {
        if (!visited.has(n)) {
          visited.add(n);
          next.add(n);
        }
      }
    }
    frontier = next;
  }
  visited.delete(startId);
  return visited;
}

/** 读 localStorage 中的 fixed 坐标（Map<id,{x,y}>） */
function loadFixed(): Map<number, { x: number; y: number }> {
  try {
    const raw = localStorage.getItem(LS_FIXED_KEY);
    if (!raw) return new Map();
    const obj = JSON.parse(raw) as Record<string, { x: number; y: number }>;
    return new Map(Object.entries(obj).map(([k, v]) => [Number(k), v]));
  } catch {
    return new Map();
  }
}

/** 保存 fixed 坐标到 localStorage */
function saveFixed(fixed: Map<number, { x: number; y: number }>): void {
  try {
    const obj: Record<string, { x: number; y: number }> = {};
    for (const [k, v] of fixed) obj[String(k)] = v;
    localStorage.setItem(LS_FIXED_KEY, JSON.stringify(obj));
  } catch {
    /* localStorage 不可用时静默降级为不持久化 */
  }
}

export function KnowledgeUniverse() {
  return (
    <ReactFlowProvider>
      <UniverseCanvas />
    </ReactFlowProvider>
  );
}

function UniverseCanvas() {
  const [resp, setResp] = useState<UniverseResponse | null>(null);
  const [error, setError] = useState("");
  const [domainFilter, setDomainFilter] = useState<string>("");
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [weakThreshold, setWeakThreshold] = useState<number>(0.3);
  const [focusDepth, setFocusDepth] = useState<number>(1);
  const [selected, setSelected] = useState<UniverseNode | null>(null);
  const [fixed, setFixed] = useState<Map<number, { x: number; y: number }>>(() => loadFixed());
  const { setViewport } = useReactFlow();
  const openNote = useUi((s) => s.openNote);

  const load = useCallback(async () => {
    try {
      const data = await apiGet<UniverseResponse>("/universe");
      setResp(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** 布局计算（纯函数；依赖数据 + fixed） */
  const layout = useMemo(() => {
    if (!resp) return null;
    return computeUniverseLayout(
      resp.nodes.map((n) => ({
        id: n.id,
        domain: n.domain,
        mastery: n.mastery?.effective ?? null,
      })),
      resp.edges.map((e) => ({ source: e.source, target: e.target })),
      { fixed },
    );
  }, [resp, fixed]);

  /** 提取所有 domain 选项 */
  const domains = useMemo(() => {
    if (!resp) return [];
    const set = new Set(resp.nodes.map((n) => n.domain).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [resp]);

  /** 邻接表（缓存） */
  const adj = useMemo(() => {
    if (!resp) return new Map<number, Set<number>>();
    return buildAdjacency(resp.edges);
  }, [resp]);

  /** Focus Mode 邻居 ID 集合 */
  const focusNeighborIds = useMemo(() => {
    if (viewMode !== "focus" || !selected || !resp) return new Set<number>();
    return getNeighbors(selected.id, adj, focusDepth);
  }, [viewMode, selected, adj, focusDepth, resp]);

  /** 过滤 + 转换为 React Flow 格式 */
  const { rfNodes, rfEdges, weakCount } = useMemo(() => {
    if (!resp || !layout) return { rfNodes: [], rfEdges: [], weakCount: 0 };

    let filtered = resp.nodes;

    // Focus Mode：不删除节点，仅计算焦点集合（渲染时非焦点降透明度）
    const focusIds = new Set<number>();
    if (viewMode === "focus" && selected) {
      focusIds.add(selected.id);
      for (const id of focusNeighborIds) focusIds.add(id);
    }

    // Domain filter
    if (domainFilter) {
      filtered = filtered.filter((n) => n.domain === domainFilter);
    }

    // Weak Area filter
    let weak = 0;
    if (viewMode === "weak") {
      filtered = filtered.filter((n) => {
        const eff = n.mastery?.effective ?? 0;
        if (eff > 0 && eff < weakThreshold) {
          weak++;
          return true;
        }
        return false;
      });
    }

    const ids = new Set(filtered.map((n) => n.id));

    const nodes: Node[] = filtered.map((n) => {
      const pos = layout.positions.get(n.id) ?? { x: 0, y: 0 };
      const dimmed = viewMode === "focus" && !focusIds.has(n.id);
      return {
        id: String(n.id),
        type: "concept" as const,
        position: pos,
        data: {
          id: n.id,
          label: n.label,
          domain: n.domain,
          mastery: n.mastery,
        } satisfies ConceptNodeData,
        style: dimmed ? { opacity: 0.15, pointerEvents: "none" as const } : undefined,
      };
    });

    // 中央 Planet 节点（聚合视觉，非概念实体；focus 时降透明度）
    const planetNode: Node = {
      id: "planet",
      type: "planet",
      position: { x: -layout.planet.conceptCount * 0.2, y: -layout.planet.conceptCount * 0.2 },
      data: {
        conceptCount: layout.planet.conceptCount,
        domainCount: layout.planet.domainCount,
        masteryAvg: layout.planet.masteryAvg,
        hasMastery: layout.planet.hasMastery,
      } satisfies PlanetNodeData,
      draggable: true,
      zIndex: 10,
      style: viewMode === "focus" ? { opacity: 0.15, pointerEvents: "none" as const } : undefined,
    };
    nodes.unshift(planetNode);

    const edges: Edge[] = resp.edges
      .filter((e) => ids.has(e.source) && ids.has(e.target))
      .map((e, i) => ({
        id: `e-${e.source}-${e.target}-${i}`,
        source: String(e.source),
        target: String(e.target),
        label: e.relation,
        style: { stroke: "#e5e5e5", strokeWidth: 1 },
        labelStyle: { fontSize: 10, fill: "#999" },
        labelBgStyle: { fill: "#fff", fillOpacity: 0.8 },
      }));

    return { rfNodes: nodes, rfEdges: edges, weakCount: weak };
  }, [resp, layout, domainFilter, viewMode, weakThreshold, focusNeighborIds, selected]);

  /** 首屏 fitView 后恢复 viewport（localStorage） */
  useEffect(() => {
    if (!resp) return;
    try {
      const raw = localStorage.getItem(LS_VIEWPORT_KEY);
      if (raw) setViewport(JSON.parse(raw));
    } catch {
      /* 无持久化 viewport 时用 fitView 默认 */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!resp]);

  /** 节点拖动结束 → 记录 fixed 坐标 + 保存 */
  const handleNodeDragStop = useCallback<OnNodeDrag>(
    (_, node) => {
      if (node.id === "planet") return; // Planet 拖动只动 viewport，不锁坐标
      setFixed((prev) => {
        const next = new Map(prev);
        next.set(Number(node.id), { x: node.position.x, y: node.position.y });
        saveFixed(next);
        return next;
      });
    },
    [],
  );

  /** Planet 拖动 → 视图状态经 viewport 持久化（不锁坐标，不碰数据） */
  const handleViewportChange = useCallback((vp: { x: number; y: number; zoom: number }) => {
    try {
      localStorage.setItem(LS_VIEWPORT_KEY, JSON.stringify(vp));
    } catch {
      /* 降级 */
    }
  }, []);

  /** 节点点击 → 选中（Focus） */
  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.id === "planet") return;
      if (!resp) return;
      const id = Number(node.id);
      const found = resp.nodes.find((n) => n.id === id);
      if (found) setSelected(found);
    },
    [resp],
  );

  /** 点击空白 → 取消选中 */
  const handlePaneClick = useCallback(() => {
    setSelected(null);
  }, []);

  if (error) {
    return <div className="universe-error">{error}</div>;
  }

  if (!resp || !layout) {
    return <div className="universe-loading">Loading...</div>;
  }

  return (
    <div className="universe-container">
      {/* Toolbar */}
      <div className="universe-toolbar">
        <span className="universe-title">
          Knowledge Universe
          <span className="universe-count">{layout.planet.conceptCount} concepts · {layout.planet.domainCount} domains</span>
        </span>

        {/* View Mode Tabs */}
        <div className="universe-tabs">
          <button
            className={`universe-tab ${viewMode === "all" ? "active" : ""}`}
            onClick={() => setViewMode("all")}
          >
            All
          </button>
          <button
            className={`universe-tab ${viewMode === "weak" ? "active" : ""}`}
            onClick={() => setViewMode("weak")}
          >
            Weak{viewMode === "weak" ? ` (${weakCount})` : ""}
          </button>
          <button
            className={`universe-tab ${viewMode === "focus" ? "active" : ""}`}
            onClick={() => setViewMode("focus")}
          >
            Focus
          </button>
        </div>

        {/* Domain Tabs */}
        {domains.length > 0 && (
          <div className="universe-domain-tabs">
            <button
              className={`universe-domain-tab ${domainFilter === "" ? "active" : ""}`}
              onClick={() => setDomainFilter("")}
            >
              All
            </button>
            {domains.map((d) => (
              <button
                key={d}
                className={`universe-domain-tab ${domainFilter === d ? "active" : ""}`}
                onClick={() => setDomainFilter(d)}
              >
                {d}
              </button>
            ))}
          </div>
        )}

        <button className="universe-refresh" onClick={() => void load()}>
          Refresh
        </button>
      </div>

      {/* Weak Threshold Slider */}
      {viewMode === "weak" && (
        <div className="universe-weak-control">
          <span className="weak-label">Mastery &lt;</span>
          <input
            type="range"
            min="0.1"
            max="0.7"
            step="0.05"
            value={weakThreshold}
            onChange={(e) => setWeakThreshold(Number(e.target.value))}
            className="weak-slider"
          />
          <span className="weak-value">{pct(weakThreshold)}</span>
        </div>
      )}

      {/* Focus Depth Control */}
      {viewMode === "focus" && (
        <div className="universe-focus-control">
          <span className="focus-label">Depth:</span>
          {[1, 2, 3].map((d) => (
            <button
              key={d}
              className={`universe-depth-btn ${focusDepth === d ? "active" : ""}`}
              onClick={() => setFocusDepth(d)}
            >
              {d} hop{d > 1 ? "s" : ""}
            </button>
          ))}
          {!selected && (
            <span className="focus-hint">Click a concept to focus</span>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="universe-legend">
        <span className="legend-item">
          <span className="legend-dot" style={{ background: "#e5e5e5" }} /> Unlearned
        </span>
        <span className="legend-item">
          <span className="legend-dot" style={{ background: "#ff8a00" }} /> Learning
        </span>
        <span className="legend-item">
          <span className="legend-dot" style={{ background: "#1a1a1a" }} /> Mastered
        </span>
        <span className="legend-item">
          <span className="legend-dot" style={{ background: "#fff", border: "1px dashed #e67300" }} /> Weak
        </span>
        <span className="legend-item">
          <span className="legend-dot" style={{ background: "none", border: "1px solid #ccc" }} /> Drag planet / pan to explore
        </span>
      </div>

      <div className="universe-body">
        {/* React Flow */}
        <div className="universe-graph">
          <ReactFlow
            nodes={rfNodes}
            edges={rfEdges}
            nodeTypes={nodeTypes}
            onNodeClick={handleNodeClick}
            onPaneClick={handlePaneClick}
            onNodeDragStop={handleNodeDragStop}
            onViewportChange={handleViewportChange}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            minZoom={0.2}
            maxZoom={3}
            nodesDraggable
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={20} size={1} color="#f0f0f0" />
            <Controls position="bottom-right" showInteractive={false} />
          </ReactFlow>
        </div>

        {/* Floating Inspector（替代右侧大抽屉，P8-003 可复用） */}
        {selected && (
          <div className="universe-inspector">
            <div className="inspector-header">
              <span className="inspector-title">{selected.label}</span>
              <button className="inspector-close" onClick={() => setSelected(null)}>×</button>
            </div>

            {selected.domain && (
              <div className="inspector-domain">{selected.domain}</div>
            )}

            <div className="inspector-status" style={{ color: masteryColor(selected.mastery?.effective ?? 0) }}>
              {masteryLabel(selected.mastery?.effective ?? 0)}
            </div>

            {/* Effective */}
            <div className="inspector-row">
              <span>Mastery</span>
              <span>{pct(selected.mastery?.effective ?? 0)}</span>
            </div>

            {/* Dimensions */}
            <div className="inspector-dims">
              <div className="inspector-dim"><span>Knowledge</span><span>{pct(selected.mastery?.knowledge ?? 0)}</span></div>
              <div className="inspector-dim"><span>Practice</span><span>{pct(selected.mastery?.practice ?? 0)}</span></div>
              <div className="inspector-dim"><span>Recall</span><span>{pct(selected.mastery?.recall ?? 0)}</span></div>
              <div className="inspector-dim"><span>Transfer</span><span>{pct(selected.mastery?.transfer ?? 0)}</span></div>
            </div>

            {/* Neighbors (Focus Mode) */}
            {viewMode === "focus" && focusNeighborIds.size > 0 && (
              <div className="inspector-section">
                <div className="inspector-label">Related ({focusNeighborIds.size})</div>
                <div className="inspector-neighbors">
                  {Array.from(focusNeighborIds).map((nid) => {
                    const n = resp.nodes.find((x) => x.id === nid);
                    if (!n) return null;
                    return (
                      <div
                        key={nid}
                        className="inspector-neighbor"
                        onClick={() => setSelected(n)}
                      >
                        <span
                          className="neighbor-dot"
                          style={{ background: masteryColor(n.mastery?.effective ?? 0) }}
                        />
                        {n.label}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <button className="inspector-btn" onClick={() => openNote(selected.id)}>
              Open Notes
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
