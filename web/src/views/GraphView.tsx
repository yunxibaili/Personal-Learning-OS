/**
 * GraphView（M2-E → P8-002 Graph V2）：关系探索视图。
 *
 * ADR-023 冻结：
 *   - 核心隐喻：Knowledge Map（关系探索）
 *   - 节点：Note + Concept 双层
 *   - 边：links 表全部关系类型
 *   - 布局：dagre 层级
 *   - 视觉：Note = 方形，Concept = 圆形
 *   - 交互：双击展开、根节点切换、Domain 过滤、隐藏未确认桩
 *   - 禁止：mastery 视觉投射（仅 tooltip）
 *
 * P8-002 新增：
 *   - dagre 层级布局（lib/graph/layout.ts）
 *   - ConceptNode / NoteNode 双视觉组件
 *   - Edge 视觉层次（按 relation 区分）
 *   - Layer Toggle（Mixed / Concept / Note）
 *   - MiniMap 导航
 *   - Floating Inspector
 *   - hover relation label
 */
import "@xyflow/react/dist/style.css";

import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
  type NodeTypes,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { apiGet } from "../lib/api";
import { dagreLayout, DEFAULT_NODE_SIZE } from "../lib/graph/layout";
import { useUi } from "../stores/ui";
import type { EntityType, GraphNode, GraphResponse } from "@shared/types/graph";
import { GraphConceptNode, type GraphConceptData } from "../components/graph/GraphConceptNode";
import { GraphEdgeComponent } from "../components/graph/GraphEdge";
import { GraphNoteNode, type GraphNoteData } from "../components/graph/GraphNoteNode";

/** Layer filter mode */
type LayerMode = "mixed" | "concept" | "note";

interface RootRef {
  type: EntityType;
  id: number;
}

const nodeTypes: NodeTypes = {
  concept: GraphConceptNode as any,
  note: GraphNoteNode as any,
};

const edgeTypes = { graph: GraphEdgeComponent };

function conceptMastery(refId: number, data: GraphResponse | null): number | null {
  if (!data) return null;
  const node = data.nodes.find((n) => n.type === "concept" && n.refId === refId);
  return node?.learning?.mastery ?? null;
}

export function GraphView() {
  const [resp, setResp] = useState<GraphResponse | null>(null);
  const [root, setRoot] = useState<RootRef | null>(null);
  const [domain, setDomain] = useState<string>("");
  const [layerMode, setLayerMode] = useState<LayerMode>("mixed");
  const [hideStubs, setHideStubs] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const openNote = useUi((s) => s.openNote);
  const openTutorForConcept = useUi((s) => s.openTutorForConcept);

  const load = useCallback(async (r: RootRef | null) => {
    setError("");
    try {
      const qs = new URLSearchParams();
      if (r) {
        qs.set("root_type", r.type);
        qs.set("root_id", String(r.id));
      }
      qs.set("depth", "2");
      setResp(await apiGet<GraphResponse>(`/graph?${qs.toString()}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void load(root);
  }, [root, load]);

  const domains = useMemo(
    () =>
      Array.from(
        new Set((resp?.nodes ?? []).map((n: GraphNode) => n.domain).filter(Boolean)),
      ).sort() as string[],
    [resp],
  );

  // Layer + domain + stub filtering
  const visible = useMemo(() => {
    let ns = resp?.nodes ?? [];
    if (layerMode === "concept") ns = ns.filter((n: GraphNode) => n.type === "concept");
    if (layerMode === "note") ns = ns.filter((n: GraphNode) => n.type === "note");
    if (domain) ns = ns.filter((n: GraphNode) => n.domain === domain);
    if (hideStubs) ns = ns.filter((n: GraphNode) => n.status !== "unconfirmed");
    return ns;
  }, [resp, layerMode, domain, hideStubs]);

  // dagre layout
  const layoutNodes = useMemo(() => {
    return visible.map((n) => ({
      id: n.id,
      type: n.type as "concept" | "note",
      ...DEFAULT_NODE_SIZE[n.type as "concept" | "note"],
    }));
  }, [visible]);

  const visibleIdSet = useMemo(() => new Set(visible.map((n: GraphNode) => n.id)), [visible]);

  const layoutEdges = useMemo(() => {
    return (resp?.edges ?? [])
      .filter((e) => visibleIdSet.has(e.source) && visibleIdSet.has(e.target))
      .map((e) => ({
        id: `${e.source}~${e.relation}~${e.target}`,
        source: e.source,
        target: e.target,
        relation: e.relation,
      }));
  }, [resp, visibleIdSet]);

  const layoutResult = useMemo(
    () => dagreLayout(layoutNodes, layoutEdges),
    [layoutNodes, layoutEdges],
  );

  // Build React Flow nodes
  const flowNodes: Node[] = useMemo(() => {
    const idSet = new Set(visible.map((n: GraphNode) => n.id));
    return layoutResult.nodes
      .filter((n) => idSet.has(n.id))
      .map((n) => {
        const src = visible.find((v: GraphNode) => v.id === n.id)!;
        const data: GraphConceptData | GraphNoteData = {
          refId: src.refId,
          label: src.title,
          domain: src.domain,
          mastery: src.type === "concept" ? conceptMastery(src.refId, resp) : null,
          selected: selectedId === n.id,
        };
        return {
          id: n.id,
          type: src.type,
          position: { x: n.x, y: n.y },
          data,
        };
      });
  }, [layoutResult, visible, resp, selectedId]);

  // Build React Flow edges
  const flowEdges: Edge[] = useMemo(() => {
    return layoutResult.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: "graph",
      data: { relation: (e as any).relation },
    }));
  }, [layoutResult]);

  const rootLabel = root ? `${root.type}:${root.id}` : "全局";

  const selectedNode = useMemo(() => {
    if (!selectedId) return null;
    return visible.find((n: GraphNode) => n.id === selectedId) ?? null;
  }, [selectedId, visible]);

  return (
    <section className="graph-view">
      <div className="graph-toolbar">
        <strong>图谱 · {rootLabel}</strong>
        {root && (
          <button onClick={() => setRoot(null)}>← 全局</button>
        )}

        {/* Layer Toggle */}
        <div className="graph-layer-toggle">
          {(["mixed", "concept", "note"] as LayerMode[]).map((m) => (
            <button
              key={m}
              className={layerMode === m ? "active" : ""}
              onClick={() => setLayerMode(m)}
            >
              {m === "mixed" ? "全部" : m === "concept" ? "Concept" : "Note"}
            </button>
          ))}
        </div>

        <select value={domain} onChange={(e) => setDomain(e.target.value)}>
          <option value="">全部领域</option>
          {domains.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>

        <label className="chk">
          <input
            type="checkbox"
            checked={hideStubs}
            onChange={(e) => setHideStubs(e.target.checked)}
          />
          隐藏未确认桩
        </label>

        <span className="muted">
          单击=选中 · 双击=以它为根展开 · hover 边=查看关系
        </span>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="graph-wrap">
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          proOptions={{ hideAttribution: true }}
          onNodeClick={(_, node) => {
            setSelectedId(node.id);
          }}
          onNodeDoubleClick={(_, node) => {
            const d = node.data as GraphConceptData | GraphNoteData;
            setRoot({ type: node.type as EntityType, id: d.refId });
          }}
          onPaneClick={() => setSelectedId(null)}
        >
          <Background color="#f0f0ee" gap={16} />
          <Controls showInteractive={false} />
          <MiniMap
            nodeStrokeWidth={3}
            zoomable
            pannable
          />
        </ReactFlow>
      </div>

      {/* Floating Inspector */}
      {selectedNode && (
        <div className="graph-inspector">
          <div className="graph-inspector-header">
            <span className={`graph-inspector-type ${selectedNode.type}`}>
              {selectedNode.type === "concept" ? "○" : "□"}
            </span>
            <strong>{selectedNode.title}</strong>
            <button onClick={() => setSelectedId(null)}>×</button>
          </div>
          {selectedNode.domain && (
            <div className="graph-inspector-domain">{selectedNode.domain}</div>
          )}
          {selectedNode.type === "concept" && conceptMastery(selectedNode.refId, resp) !== null && (
            <div className="graph-inspector-mastery">
              Mastery: {Math.round((conceptMastery(selectedNode.refId, resp) ?? 0) * 100)}%
            </div>
          )}
          <div className="graph-inspector-actions">
            {selectedNode.type === "note" && (
              <button onClick={() => openNote(selectedNode.refId)}>打开笔记</button>
            )}
            {selectedNode.type === "concept" && (
              <button onClick={() => openTutorForConcept(selectedNode.refId)}>
                问 Tutor
              </button>
            )}
            <button onClick={() => setRoot({ type: selectedNode.type, id: selectedNode.refId })}>
              以此为根展开
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
