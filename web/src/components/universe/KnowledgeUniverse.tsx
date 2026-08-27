/**
 * KnowledgeUniverse（M3b-002）：Concept Graph + Mastery Overlay。
 *
 * ADR-018 冻结：
 *   - 节点 = Concept（非 Note）
 *   - 边 = links 表（concept ↔ concept）
 *   - 布局 = d3-force（ADR-007）
 *   - 渲染 = React Flow
 *   - 禁止：3D / 粒子 / 星空 / 游戏化
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

/** React Flow 节点类型注册 */
const nodeTypes: NodeTypes = { concept: ConceptNode };

export function KnowledgeUniverse() {
  const [resp, setResp] = useState<UniverseResponse | null>(null);
  const [error, setError] = useState("");
  const [domainFilter, setDomainFilter] = useState<string>("");

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

  /** 过滤 + 转换为 React Flow 格式 */
  const { rfNodes, rfEdges } = useMemo(() => {
    if (!resp) return { rfNodes: [], rfEdges: [] };

    const filtered = domainFilter
      ? resp.nodes.filter((n) => n.domain === domainFilter)
      : resp.nodes;

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

    return { rfNodes: nodes, rfEdges: edges };
  }, [resp, domainFilter]);

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
        {domains.length > 0 && (
          <select
            className="universe-filter"
            value={domainFilter}
            onChange={(e) => setDomainFilter(e.target.value)}
          >
            <option value="">All domains</option>
            {domains.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        )}
        <button className="universe-refresh" onClick={() => void load()}>
          Refresh
        </button>
      </div>

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

      {/* React Flow */}
      <div className="universe-graph">
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          nodeTypes={nodeTypes}
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
    </div>
  );
}
