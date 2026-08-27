/**
 * KnowledgeUniverse（M3b-004）：Navigation Layer。
 *
 * ADR-018 冻结：
 *   - 节点 = Concept（非 Note）
 *   - 边 = links 表（concept ↔ concept）
 *   - 布局 = React Flow
 *   - 禁止：3D / 粒子 / 星空 / 游戏化
 *
 * M3b-004 新增：
 *   - Domain Filter：顶部 tab 选择
 *   - Weak Area View：低掌握度概念筛选
 *   - Focus Mode：邻居展开 + depth 控制
 */
import "@xyflow/react/dist/style.css";

import {
  Background,
  Controls,
  ReactFlow,
  type Edge,
  type Node,
  type NodeTypes,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { apiGet } from "../../lib/api";
import { useUi } from "../../stores/ui";
import { ConceptNode, type ConceptNodeData } from "./ConceptNode";

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
const nodeTypes: NodeTypes = { concept: ConceptNode };

/** mastery 百分比 */
function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

/** mastery 状态 */
function masteryLabel(effective: number): string {
  if (effective <= 0) return "Unlearned";
  if (effective < 0.3) return "Beginner";
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

export function KnowledgeUniverse() {
  const [resp, setResp] = useState<UniverseResponse | null>(null);
  const [error, setError] = useState("");
  const [domainFilter, setDomainFilter] = useState<string>("");
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [weakThreshold, setWeakThreshold] = useState<number>(0.3);
  const [focusDepth, setFocusDepth] = useState<number>(1);
  const [selected, setSelected] = useState<UniverseNode | null>(null);
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
    if (!resp) return { rfNodes: [], rfEdges: [], weakCount: 0 };

    let filtered = resp.nodes;

    // Domain filter
    if (domainFilter) {
      filtered = filtered.filter((n) => n.domain === domainFilter);
    }

    // Weak Area filter
    let weak = 0;
    if (viewMode === "weak") {
      filtered = filtered.filter((n) => {
        const eff = n.mastery?.effective ?? 0;
        if (eff < weakThreshold) {
          weak++;
          return true;
        }
        return false;
      });
    }

    // Focus Mode filter
    if (viewMode === "focus" && selected) {
      const focusIds = new Set<number>([selected.id]);
      for (const id of focusNeighborIds) focusIds.add(id);
      filtered = filtered.filter((n) => focusIds.has(n.id));
    }

    const ids = new Set(filtered.map((n) => n.id));

    const nodes: Node[] = filtered.map((n, i) => ({
      id: String(n.id),
      type: "concept" as const,
      position: {
        x: (i % 5) * 160 + Math.random() * 40,
        y: Math.floor(i / 5) * 140 + Math.random() * 40,
      },
      data: {
        id: n.id,
        label: n.label,
        domain: n.domain,
        mastery: n.mastery,
      } satisfies ConceptNodeData,
    }));

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
  }, [resp, domainFilter, viewMode, weakThreshold, focusNeighborIds, selected]);

  /** 节点点击 → 选中 */
  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
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

  if (!resp) {
    return <div className="universe-loading">Loading...</div>;
  }

  return (
    <div className="universe-container">
      {/* Toolbar */}
      <div className="universe-toolbar">
        <span className="universe-title">
          Knowledge Universe
          <span className="universe-count">{rfNodes.length} concepts</span>
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
          <span className="legend-dot" style={{ background: "#fff", border: "1px solid #ccc" }} /> Size = mastery
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
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.2}
            maxZoom={3}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={20} size={1} color="#f0f0f0" />
            <Controls position="bottom-right" />
          </ReactFlow>
        </div>

        {/* Detail Panel */}
        {selected && (
          <div className="universe-detail">
            <div className="detail-header">
              <span className="detail-title">{selected.label}</span>
              <button className="detail-close" onClick={() => setSelected(null)}>x</button>
            </div>

            {selected.domain && (
              <div className="detail-domain">{selected.domain}</div>
            )}

            <div className="detail-status" style={{ color: masteryColor(selected.mastery?.effective ?? 0) }}>
              {masteryLabel(selected.mastery?.effective ?? 0)}
            </div>

            {/* Effective Bar */}
            <div className="detail-section">
              <div className="detail-label">Effective</div>
              <div className="detail-bar-wrap">
                <div
                  className="detail-bar"
                  style={{
                    width: pct(selected.mastery?.effective ?? 0),
                    background: masteryColor(selected.mastery?.effective ?? 0),
                  }}
                />
              </div>
              <div className="detail-pct">{pct(selected.mastery?.effective ?? 0)}</div>
            </div>

            {/* Four Dimensions */}
            <div className="detail-section">
              <div className="detail-label">Dimensions</div>
              <div className="detail-dims">
                <div className="detail-dim">
                  <span>Knowledge</span>
                  <span>{pct(selected.mastery?.knowledge ?? 0)}</span>
                </div>
                <div className="detail-dim">
                  <span>Practice</span>
                  <span>{pct(selected.mastery?.practice ?? 0)}</span>
                </div>
                <div className="detail-dim">
                  <span>Recall</span>
                  <span>{pct(selected.mastery?.recall ?? 0)}</span>
                </div>
                <div className="detail-dim">
                  <span>Transfer</span>
                  <span>{pct(selected.mastery?.transfer ?? 0)}</span>
                </div>
              </div>
            </div>

            {/* Neighbors (Focus Mode) */}
            {viewMode === "focus" && focusNeighborIds.size > 0 && (
              <div className="detail-section">
                <div className="detail-label">Neighbors ({focusNeighborIds.size})</div>
                <div className="detail-neighbors">
                  {Array.from(focusNeighborIds).map((nid) => {
                    const n = resp.nodes.find((x) => x.id === nid);
                    if (!n) return null;
                    return (
                      <div
                        key={nid}
                        className="detail-neighbor"
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

            {/* Actions */}
            <div className="detail-actions">
              <button className="detail-btn" onClick={() => openNote(selected.id)}>
                Open Note
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
