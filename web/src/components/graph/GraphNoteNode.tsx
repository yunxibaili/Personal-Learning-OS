/**
 * GraphNoteNode（P8-002）：Graph 笔记节点 — 方形卡片。
 *
 * ADR-023 冻结：
 *   - Graph 中 Note = 方形
 *   - 视觉与 Concept 明确分离（形状 = 语义）
 *   - 禁止：mastery 投射
 *
 * 设计约束：
 *   - 方形卡片，document 风格
 *   - 标题文字截断
 *   - hover 显示 domain（如有）
 */
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useState } from "react";

export interface GraphNoteData extends Record<string, unknown> {
  refId: number;
  label: string;
  domain: string | null;
  selected?: boolean;
}

export function GraphNoteNode({ data }: NodeProps) {
  const d = data as unknown as GraphNoteData;
  const [hovered, setHovered] = useState(false);

  return (
    <>
      <Handle type="target" position={Position.Top} style={{ visibility: "hidden" }} />
      <div
        className={`gnode note${d.selected ? " selected" : ""}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <span className="gnode-icon">📄</span>
        <span className="gnode-label">{d.label}</span>

        {hovered && (
          <div className="gnode-tooltip">
            <div className="gnode-tooltip-title">{d.label}</div>
            {d.domain && <div className="gnode-tooltip-domain">{d.domain}</div>}
            <div className="gnode-tooltip-type">Note</div>
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ visibility: "hidden" }} />
    </>
  );
}
