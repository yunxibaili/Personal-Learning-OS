/**
 * MindMapCanvas（M2b-001）：用户思考空间。
 *
 * ADR-019 冻结：
 *   - MindMap ≠ Universe
 *   - 不改变 mastery / learning_events
 *   - concept binding 是引用
 *   - 用户布局属于用户数据
 *
 * 功能：
 *   - 选择 Map / 创建新 Map
 *   - 添加节点（Concept 引用 / 临时节点）
 *   - 拖动节点保存坐标
 *   - 连线
 *   - 删除
 */
import "@xyflow/react/dist/style.css";

import {
  Background,
  Controls,
  ReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeTypes,
  type OnNodesChange,
  type OnEdgesChange,
  applyNodeChanges,
  applyEdgeChanges,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { apiGet } from "../../lib/api";
import { MapNode, type MapNodeData } from "./MapNode";

/** API 响应 */
interface MapSummary {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
}

interface MapNodeResp {
  id: number;
  map_id: number;
  concept_id: number | null;
  label: string;
  note: string;
  position_x: number;
  position_y: number;
}

interface MapEdgeResp {
  id: number;
  map_id: number;
  source: number;
  target: number;
  relation: string;
}

interface MapDetail extends MapSummary {
  nodes: MapNodeResp[];
  edges: MapEdgeResp[];
}

/** React Flow 节点类型注册 */
const nodeTypes: NodeTypes = { mapNode: MapNode };

export function MindMapCanvas() {
  const [maps, setMaps] = useState<MapSummary[]>([]);
  const [activeMapId, setActiveMapId] = useState<number | null>(null);
  const [mapDetail, setMapDetail] = useState<MapDetail | null>(null);
  const [error, setError] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newNodeLabel, setNewNodeLabel] = useState("");

  /** 加载 Map 列表 */
  const loadMaps = useCallback(async () => {
    try {
      const data = await apiGet<MapSummary[]>("/mindmaps");
      setMaps(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  /** 加载 Map 详情 */
  const loadMap = useCallback(async (id: number) => {
    try {
      const data = await apiGet<MapDetail>(`/mindmaps/${id}`);
      setMapDetail(data);
      setActiveMapId(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void loadMaps();
  }, [loadMaps]);

  /** 创建新 Map */
  const handleCreateMap = useCallback(async () => {
    if (!newTitle.trim()) return;
    try {
      const resp = await fetch(`/api/v1/mindmaps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim() }),
      });
      if (!resp.ok) throw new Error("create failed");
      const data = await resp.json();
      setNewTitle("");
      await loadMaps();
      await loadMap(data.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [newTitle, loadMaps, loadMap]);

  /** 添加节点 */
  const handleAddNode = useCallback(async () => {
    if (!activeMapId || !newNodeLabel.trim()) return;
    try {
      await fetch(`/api/v1/mindmaps/${activeMapId}/nodes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: newNodeLabel.trim(),
          position_x: 100 + Math.random() * 200,
          position_y: 100 + Math.random() * 200,
        }),
      });
      setNewNodeLabel("");
      await loadMap(activeMapId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [activeMapId, newNodeLabel, loadMap]);

  /** 节点拖动 → 保存坐标 */
  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      if (!mapDetail) return;
      // 先应用本地状态
      setMapDetail((prev) => {
        if (!prev) return prev;
        const rfNodes = prev.nodes.map(n => ({
          id: String(n.id),
          type: "mapNode" as const,
          position: { x: n.position_x, y: n.position_y },
          data: { id: n.id, label: n.label, concept_id: n.concept_id, note: n.note },
        }));
        const updated = applyNodeChanges(changes, rfNodes);
        // 转回 MapNodeResp 格式
        const nodesMap = new Map(updated.map(n => [n.id, n]));
        return {
          ...prev,
          nodes: prev.nodes.map(n => {
            const rn = nodesMap.get(String(n.id));
            if (rn) {
              return { ...n, position_x: rn.position.x, position_y: rn.position.y };
            }
            return n;
          }),
        };
      });
      // 保存坐标到后端
      for (const ch of changes) {
        if (ch.type === "position" && ch.position && ch.dragging) {
          const nodeId = Number(ch.id);
          void fetch(`/api/v1/mindmaps/${activeMapId}/nodes/${nodeId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ position_x: ch.position.x, position_y: ch.position.y }),
          });
        }
      }
    },
    [mapDetail, activeMapId],
  );

  /** 边变化 */
  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      if (!mapDetail) return;
      setMapDetail((prev) => {
        if (!prev) return prev;
        const rfEdges = prev.edges.map(e => ({
          id: String(e.id),
          source: String(e.source),
          target: String(e.target),
          relation: e.relation,
        }));
        applyEdgeChanges(changes, rfEdges);
        return prev;
      });
    },
    [mapDetail],
  );

  /** 连线 → 保存到后端 */
  const onConnect = useCallback(
    async (conn: Connection) => {
      if (!activeMapId || !conn.source || !conn.target) return;
      try {
        await fetch(`/api/v1/mindmaps/${activeMapId}/edges`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source: Number(conn.source),
            target: Number(conn.target),
          }),
        });
        await loadMap(activeMapId);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [activeMapId, loadMap],
  );

  /** 转换为 React Flow 格式 */
  const { rfNodes, rfEdges } = useMemo(() => {
    if (!mapDetail) return { rfNodes: [], rfEdges: [] };

    const nodes: Node[] = mapDetail.nodes.map((n) => ({
      id: String(n.id),
      type: "mapNode" as const,
      position: { x: n.position_x, y: n.position_y },
      data: { id: n.id, label: n.label, concept_id: n.concept_id, note: n.note } satisfies MapNodeData,
    }));

    const edges: Edge[] = mapDetail.edges.map((e) => ({
      id: String(e.id),
      source: String(e.source),
      target: String(e.target),
      label: e.relation,
      style: { stroke: "#999", strokeWidth: 1 },
      labelStyle: { fontSize: 10, fill: "#999" },
      labelBgStyle: { fill: "#fff", fillOpacity: 0.8 },
    }));

    return { rfNodes: nodes, rfEdges: edges };
  }, [mapDetail]);

  if (error) {
    return <div className="universe-error">{error}</div>;
  }

  return (
    <div className="mindmap-container">
      {/* Sidebar: Map List */}
      <div className="mindmap-sidebar">
        <div className="mindmap-sidebar-title">Maps</div>
        <div className="mindmap-map-list">
          {maps.map((m) => (
            <button
              key={m.id}
              className={`mindmap-map-item ${activeMapId === m.id ? "active" : ""}`}
              onClick={() => void loadMap(m.id)}
            >
              {m.title}
            </button>
          ))}
        </div>
        <div className="mindmap-new-map">
          <input
            type="text"
            placeholder="New map title..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void handleCreateMap(); }}
            className="mindmap-input"
          />
          <button className="mindmap-btn" onClick={() => void handleCreateMap()}>
            Create
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="mindmap-canvas-area">
        {mapDetail ? (
          <>
            <div className="mindmap-toolbar">
              <span className="mindmap-title">{mapDetail.title}</span>
              <input
                type="text"
                placeholder="Add node..."
                value={newNodeLabel}
                onChange={(e) => setNewNodeLabel(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void handleAddNode(); }}
                className="mindmap-input"
              />
              <button className="mindmap-btn" onClick={() => void handleAddNode()}>
                Add
              </button>
            </div>
            <div className="mindmap-graph">
              <ReactFlow
                nodes={rfNodes}
                edges={rfEdges}
                nodeTypes={nodeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                fitView
                fitViewOptions={{ padding: 0.3 }}
                minZoom={0.2}
                maxZoom={3}
                proOptions={{ hideAttribution: true }}
              >
                <Background gap={20} size={1} color="#f0f0f0" />
                <Controls position="bottom-right" />
              </ReactFlow>
            </div>
          </>
        ) : (
          <div className="mindmap-empty">Select or create a map</div>
        )}
      </div>
    </div>
  );
}
