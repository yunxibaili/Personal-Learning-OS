/**
 * ConceptNode（M3b-002）：Universe 节点渲染。
 *
 * ADR-018 冻结：
 *   - 节点 = Concept
 *   - 颜色 = mastery.effective（灰 → 橙 → 深）
 *   - 半径 = mastery.effective
 *   - 禁止：游戏化 / XP / 徽章
 */
import { Handle, Position, type NodeProps } from "@xyflow/react";

export interface ConceptNodeData extends Record<string, unknown> {
  id: number;
  label: string;
  domain: string | null;
  mastery: {
    effective: number;
    knowledge: number;
    practice: number;
    recall: number;
    transfer: number;
  } | null;
}

/** mastery → 节点半径（16px ~ 32px） */
function masteryRadius(effective: number): number {
  return Math.round(16 + effective * 16);
}

/** mastery → 节点颜色 */
function masteryColor(effective: number): string {
  if (effective <= 0) return "#e5e5e5";       // 灰色：未学习
  if (effective < 0.7) return "#ff8a00";      // 橙色：学习中
  return "#1a1a1a";                            // 深色：已掌握
}

/** mastery → 边框颜色 */
function masteryBorder(effective: number): string {
  if (effective <= 0) return "#d4d4d4";
  if (effective < 0.7) return "#e67300";
  return "#000000";
}

export function ConceptNode({ data, selected }: NodeProps) {
  const d = data as unknown as ConceptNodeData;
  const effective = d.mastery?.effective ?? 0;
  const r = masteryRadius(effective);
  const bg = masteryColor(effective);
  const border = masteryBorder(effective);
  const textColor = effective >= 0.7 ? "#ffffff" : "#1a1a1a";

  return (
    <>
      <Handle type="target" position={Position.Top} style={{ visibility: "hidden" }} />
      <div
        className="universe-node"
        style={{
          width: r * 2,
          height: r * 2,
          borderRadius: "50%",
          background: bg,
          border: `2px solid ${border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          transition: "background 150ms, border-color 150ms",
          boxShadow: selected ? "0 0 0 3px rgba(255,138,0,0.3)" : "none",
        }}
      >
        <span
          className="universe-node-label"
          style={{
            color: textColor,
            fontSize: effective > 0.5 ? "11px" : "12px",
            fontWeight: 600,
            textAlign: "center",
            lineHeight: 1.2,
            padding: "0 4px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: r * 2 - 8,
          }}
        >
          {d.label}
        </span>
      </div>
      <Handle type="source" position={Position.Bottom} style={{ visibility: "hidden" }} />
    </>
  );
}
