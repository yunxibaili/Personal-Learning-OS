import "@xyflow/react/dist/style.css";

import {
  Background,
  Controls,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { apiGet } from "../lib/api";
import { useUi } from "../stores/ui";
import type { EntityType, GraphResponse } from "@shared/types/graph";

/**
 * M2-E 基础图谱：仅查看/点击跳转/双击局部展开/过滤。
 * 纯展示组件——图计算与布局引擎不在本文件（separation.md 图谱分层铁律）。
 */

interface GraphNodeData extends Record<string, unknown> {
  label: string;
  etype: EntityType;
  unconfirmed: boolean;
}
type FlowNode = Node<GraphNodeData, "entity">;

function EntityNode({ data }: NodeProps<FlowNode>) {
  return (
    <div className={`gnode ${data.etype}${data.unconfirmed ? " unconf" : ""}`}>
      {data.label}
    </div>
  );
}

const nodeTypes = { entity: EntityNode };

interface RootRef {
  type: EntityType;
  id: number;
}

export function GraphView() {
  const [resp, setResp] = useState<GraphResponse | null>(null);
  const [root, setRoot] = useState<RootRef | null>(null);
  const [domain, setDomain] = useState<string>("");
  const [hideStubs, setHideStubs] = useState(false);
  const [error, setError] = useState("");

  const openNote = useUi((s) => s.openNote);

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
        new Set((resp?.nodes ?? []).map((n) => n.domain).filter(Boolean)),
      ).sort() as string[],
    [resp],
  );

  // 过滤（内存内，不重打 API）
  const visible = useMemo(() => {
    let ns = resp?.nodes ?? [];
    if (domain) ns = ns.filter((n) => n.domain === domain);
    if (hideStubs) ns = ns.filter((n) => n.status !== "unconfirmed");
    return ns;
  }, [resp, domain, hideStubs]);

  const flowNodes: FlowNode[] = visible.map((n, i) => ({
    id: n.id,
    type: "entity" as const,
    position: { x: (i % 6) * 190, y: Math.floor(i / 6) * 100 },
    data: {
      label: n.title,
      etype: n.type,
      unconfirmed: n.status === "unconfirmed",
    },
  }));

  const idSet = new Set(visible.map((n) => n.id));
  const flowEdges: Edge[] = (resp?.edges ?? [])
    .filter((e) => idSet.has(e.source) && idSet.has(e.target))
    .map((e) => ({
      id: `${e.source}~${e.relation}~${e.target}`,
      source: e.source,
      target: e.target,
      label: e.relation === "wikilink" ? "" : e.relation,
      style: { stroke: "#3a3f52" },
    }));

  const rootLabel = root
    ? `${root.type}:${root.id}`
    : "全局";

  return (
    <section className="graph-view">
      <div className="graph-toolbar">
        <strong>
          图谱 · {rootLabel} · depth=2
        </strong>
        {root && (
          <button onClick={() => setRoot(null)}>← 全局</button>
        )}
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
          单击笔记节点=打开 · 双击任意节点=以它为根展开
        </span>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="graph-wrap">
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          fitView
          proOptions={{ hideAttribution: true }}
          onNodeClick={(_, node) => {
            const d = node.data as GraphNodeData;
            if (d.etype === "note") {
              openNote(Number(node.id.replace("note-", "")));
            }
          }}
          onNodeDoubleClick={(_, node) => {
            const d = node.data as GraphNodeData;
            setRoot({ type: d.etype, id: Number(node.id.split("-")[1]) });
          }}
        >
          <Background color="#22263400" gap={0} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </section>
  );
}
