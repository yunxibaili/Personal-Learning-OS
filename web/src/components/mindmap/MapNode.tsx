/**
 * MapNode（M2b-001）：MindMap 节点渲染。
 *
 * ADR-019 冻结：
 *   - 节点 = Map Node（concept_id nullable）
 *   - 概念引用节点：橙色边框
 *   - 临时节点：灰色虚线边框
 *   - 不显示 mastery（MindMap 不关心掌握度）
 */
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useState } from "react";

export interface MapNodeData extends Record<string, unknown> {
  id: number;
  label: string;
  concept_id: number | null;
  note: string;
}

export function MapNode({ data, selected }: NodeProps) {
  const d = data as unknown as MapNodeData;
  const isConcept = d.concept_id !== null;
  const [hovered, setHovered] = useState(false);

  return (
    <>
      <Handle type="target" position={Position.Top} style={{ visibility: "hidden" }} />
      <div
        className="mindmap-node"
        style={{
          border: selected
            ? "2px solid #ff8a00"
            : isConcept
              ? "2px solid #1a1a1a"
              : "2px dashed #999",
          background: isConcept ? "#fff" : "#fafafa",
          boxShadow: selected ? "0 0 0 3px rgba(255,138,0,0.3)" : "none",
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <span className="mindmap-node-label">{d.label}</span>
        {isConcept && (
          <span className="mindmap-node-badge">C</span>
        )}

        {/* Tooltip */}
        {hovered && (
          <div className="mindmap-tooltip">
            <div className="tooltip-title">{d.label}</div>
            {isConcept && <div className="tooltip-domain">概念引用</div>}
            {!isConcept && <div className="tooltip-domain">临时节点</div>}
            {d.note && <div className="tooltip-note">{d.note}</div>}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ visibility: "hidden" }} />
    </>
  );
}
