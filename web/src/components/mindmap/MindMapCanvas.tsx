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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  apiGet,
  apiPatch,
  apiPost,
  searchConcepts,
  bindConcept,
  unbindConcept,
  type ConceptResult,
} from "../../lib/api";
import { PositionSaveQueue } from "./PositionSaveQueue";
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
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [conceptQuery, setConceptQuery] = useState("");
  const [conceptResults, setConceptResults] = useState<ConceptResult[]>([]);
  // searchingConcept 值当前无消费方；仅保留 setter 供搜索流程置位
  const [, setSearchingConcept] = useState(false);
  const saveQueueRef = useRef<PositionSaveQueue | null>(null);

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
      const data = await apiPost<{ id: number }>("/mindmaps", { title: newTitle.trim() });
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
      await apiPost(`/mindmaps/${activeMapId}/nodes`, {
        label: newNodeLabel.trim(),
        position_x: 100 + Math.random() * 200,
        position_y: 100 + Math.random() * 200,
      });
      setNewNodeLabel("");
      await loadMap(activeMapId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [activeMapId, newNodeLabel, loadMap]);

  // 拖拽坐标保存队列（P1-1）：drag-end flush + 1s trailing debounce 兜底。
  // flush 闭包经 activeMapIdRef 读当前 map，队列实例与 map 切换解耦，不随渲染重建。
  const activeMapIdRef = useRef<number | null>(activeMapId);
  useEffect(() => {
    activeMapIdRef.current = activeMapId;
  }, [activeMapId]);

  useEffect(() => {
    const queue = new PositionSaveQueue(
      async (items) => {
        const mapId = activeMapIdRef.current;
        if (!mapId) return;
        await Promise.all(
          items.map((it) =>
            apiPatch(`/mindmaps/${mapId}/nodes/${it.nodeId}`, {
              position_x: it.position.x,
              position_y: it.position.y,
            }),
          ),
        );
      },
      (e) => setError(e instanceof Error ? e.message : String(e)),
      1000,
    );
    saveQueueRef.current = queue;
    return () => {
      saveQueueRef.current = null;
      queue.dispose();
    };
  }, []);

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
      // 保存坐标到后端：入队，拖动结束立即 flush，拖动中靠 1s 兜底 debounce
      const queue = saveQueueRef.current;
      if (!queue) return;
      for (const ch of changes) {
        if (ch.type === "position" && ch.position && typeof ch.dragging === "boolean") {
          queue.queue(Number(ch.id), { x: ch.position.x, y: ch.position.y });
          if (!ch.dragging) queue.flushNow();
        }
      }
    },
    [mapDetail],
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
        await apiPost(`/mindmaps/${activeMapId}/edges`, {
          source: Number(conn.source),
          target: Number(conn.target),
        });
        await loadMap(activeMapId);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [activeMapId, loadMap],
  );

  /** 搜索 Concept（绑定用） */
  const handleSearchConcept = useCallback(async (q: string) => {
    setConceptQuery(q);
    if (!q.trim()) { setConceptResults([]); return; }
    setSearchingConcept(true);
    try {
      const results = await searchConcepts(q);
      setConceptResults(results);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSearchingConcept(false);
    }
  }, []);

  /** 绑定 Concept 到选中节点 */
  const handleBindConcept = useCallback(async (conceptId: number) => {
    if (!activeMapId || !selectedNodeId) return;
    try {
      await bindConcept(activeMapId, selectedNodeId, conceptId);
      await loadMap(activeMapId);
      setConceptResults([]);
      setConceptQuery("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [activeMapId, selectedNodeId, loadMap]);

  /** 解绑 Concept */
  const handleUnbindConcept = useCallback(async () => {
    if (!activeMapId || !selectedNodeId) return;
    try {
      await unbindConcept(activeMapId, selectedNodeId);
      await loadMap(activeMapId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [activeMapId, selectedNodeId, loadMap]);

  /** 导出 Map（下载 .map.json） */
  const handleExport = useCallback(async () => {
    if (!activeMapId) return;
    try {
      const data = await apiGet<unknown>(`/mindmaps/${activeMapId}/export`);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `map-${activeMapId}.map.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [activeMapId]);

  /** 导入 Map（上传 .map.json） */
  const handleImport = useCallback(async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".map.json,.json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const result = await apiPost<{ id: number }>("/mindmaps/import", data);
        await loadMaps();
        await loadMap(result.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    };
    input.click();
  }, [loadMaps, loadMap]);

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
      <h1 className="sr-only">思维导图</h1>
      {/* Sidebar: Map List */}
      <div className="mindmap-sidebar">
        <div className="mindmap-sidebar-title">导图</div>
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
            placeholder="新导图标题…"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void handleCreateMap(); }}
            className="mindmap-input"
          />
          <button className="mindmap-btn" onClick={() => void handleCreateMap()}>
            创建
          </button>
        </div>
        <div className="mindmap-import-export">
          <button className="mindmap-btn-sm" onClick={() => void handleImport()}>
            导入
          </button>
          {activeMapId && (
            <button className="mindmap-btn-sm" onClick={() => void handleExport()}>
              导出
            </button>
          )}
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
                placeholder="添加节点…"
                value={newNodeLabel}
                onChange={(e) => setNewNodeLabel(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void handleAddNode(); }}
                className="mindmap-input"
              />
              <button className="mindmap-btn" onClick={() => void handleAddNode()}>
                添加
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
                onNodeClick={(_, node) => {
                  const nid = Number(node.id);
                  setSelectedNodeId(nid === selectedNodeId ? null : nid);
                  setConceptQuery("");
                  setConceptResults([]);
                }}
                onPaneClick={() => {
                  setSelectedNodeId(null);
                  setConceptQuery("");
                  setConceptResults([]);
                }}
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

            {/* Concept Binding Panel (ADR-019: 只读引用，不改 mastery/event） */}
            {selectedNodeId && (
              <div className="mindmap-binding-panel">
                <div className="binding-panel-title">概念绑定</div>
                <div className="binding-panel-desc">
                  将此节点绑定到已有概念（仅引用，不影响掌握度）
                </div>
                <div className="binding-search">
                  <input
                    type="text"
                    placeholder="搜索概念…"
                    value={conceptQuery}
                    onChange={(e) => void handleSearchConcept(e.target.value)}
                    className="mindmap-input"
                  />
                </div>
                {conceptResults.length > 0 && (
                  <div className="binding-results">
                    {conceptResults.map((c) => (
                      <button
                        key={c.id}
                        className="binding-result-item"
                        onClick={() => void handleBindConcept(c.id)}
                      >
                        <span className="binding-concept-title">{c.title}</span>
                        {c.domain && <span className="binding-concept-domain">{c.domain}</span>}
                      </button>
                    ))}
                  </div>
                )}
                {selectedNodeId && (() => {
                  const node = mapDetail?.nodes.find((n) => n.id === selectedNodeId);
                  if (node?.concept_id) {
                    const concept = conceptResults.find((c) => c.id === node.concept_id);
                    return (
                      <div className="binding-current">
                        <span className="binding-current-label">已绑定：</span>
                        <span className="binding-current-name">
                          {concept?.title ?? `Concept #${node.concept_id}`}
                        </span>
                        <button
                          className="mindmap-btn-unbind"
                          onClick={() => void handleUnbindConcept()}
                        >
                          解绑
                        </button>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            )}
          </>
        ) : (
          <div className="mindmap-empty">选择或新建一个导图</div>
        )}
      </div>
    </div>
  );
}
