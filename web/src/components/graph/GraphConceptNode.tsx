/**
 * GraphConceptNode（P8-002）：Graph 概念节点 — 圆形。
 *
 * ADR-023 冻结：
 *   - Graph 中 Concept = 圆形
 *   - mastery 仅 tooltip 展示（不投射到视觉）
 *   - 禁止：mastery 环 / 颜色编码（那是 Universe 的事）
 *
 * 与 Universe ConceptNode 的区别：
 *   - 固定尺寸（不随 mastery 变化）
 *   - 无 mastery ring / weak ring
 *   - 仅 hover tooltip 显示 mastery 详情
 */
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useState } from "react";

export interface GraphConceptData extends Record<string, unknown> {
  refId: number;
  label: string;
  domain: string | null;
  mastery: number | null;
  selected?: boolean;
}

function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

function masteryLabel(effective: number): string {
  if (effective <= 0) return "Unlearned";
  if (effective < 0.3) return "Weak";
  if (effective < 0.7) return "Learning";
  return "Mastered";
}

export function GraphConceptNode({ data }: NodeProps) {
  const d = data as unknown as GraphConceptData;
  const effective = d.mastery ?? 0;
  const [hovered, setHovered] = useState(false);

  return (
    <>
      <Handle type="target" position={Position.Top} style={{ visibility: "hidden" }} />
      <div
        className={`gnode concept${d.selected ? " selected" : ""}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <span className="gnode-label">{d.label}</span>

        {hovered && (
          <div className="gnode-tooltip">
            <div className="gnode-tooltip-title">{d.label}</div>
            {d.domain && <div className="gnode-tooltip-domain">{d.domain}</div>}
            <div className="gnode-tooltip-status">{masteryLabel(effective)}</div>
            <div className="gnode-tooltip-bar-wrap">
              <div className="gnode-tooltip-bar" style={{ width: pct(effective) }} />
            </div>
            <div className="gnode-tooltip-effective">Effective {pct(effective)}</div>
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ visibility: "hidden" }} />
    </>
  );
}
