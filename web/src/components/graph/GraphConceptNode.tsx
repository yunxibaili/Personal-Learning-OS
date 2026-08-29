/**
 * GraphConceptNode（P8-002）：Graph 概念节点 — 圆形 + mastery 环。
 *
 * ADR-023 冻结（视觉编码）：
 *   - Graph 中 Concept = 圆形 + mastery 环
 *   - Note = 方形，形状即语义
 *
 * 简约化（2026-08-29）：
 *   - 边框由绿色 --ok 改为中性 --border：概念节点的语义色改由 mastery 环承载，
 *     一个节点不再同时出现两个色相。
 *   - tooltip 由 5 层（标题 / 域 / 状态词 / 进度条 / 百分比）精简为 2 层：
 *     环已给出 mastery 的视觉近似，tooltip 只补精确数值与域。
 *
 * 关于 ADR-023 的原内部矛盾（2026-08-29 已裁决）：
 *   数据流表曾标注 Graph mastery「仅 tooltip」，与视觉编码条款的 mastery 环互斥。
 *   裁决取视觉编码条款 —— 保留 mastery 环，且这是 Graph 中 mastery 的唯一视觉出口。
 *   见 ADR-023 变更记录 2026-08-29。
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

/** 环半径（viewBox 0 0 100 100）与周长，起笔在 12 点方向 */
const RING_R = 47;
const RING_C = 2 * Math.PI * RING_R;

function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
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

        {d.mastery !== null && (
          <svg className="gnode-ring" viewBox="0 0 100 100" aria-hidden="true">
            <circle className="gnode-ring-track" cx="50" cy="50" r={RING_R} />
            <circle
              className="gnode-ring-value"
              cx="50" cy="50" r={RING_R}
              strokeDasharray={`${(RING_C * effective).toFixed(1)} ${RING_C.toFixed(1)}`}
            />
          </svg>
        )}

        {hovered && (
          <div className="gnode-tooltip">
            <div className="gnode-tooltip-mastery">Mastery {pct(effective)}</div>
            {d.domain && <div className="gnode-tooltip-domain">{d.domain}</div>}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ visibility: "hidden" }} />
    </>
  );
}
