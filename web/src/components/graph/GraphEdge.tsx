/**
 * GraphEdge（P8-002）：Graph 关系边 — 按 relation 类型视觉分层。
 *
 * ADR-023 冻结：
 *   - 默认隐藏 edge label
 *   - hover 显示 relation 标签
 *   - 视觉层次：prerequisite 粗实线 > related 中虚线 > wikilink 细浅线
 *
 * 与 Universe 的区别：
 *   - Universe 边无层次（concept↔concept 统一样式）
 *   - Graph 边有明确的 relation 视觉编码
 */
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@xyflow/react";
import { useState } from "react";

const RELATION_STYLES: Record<string, { strokeWidth: number; dash?: string; color: string }> = {
  wikilink:      { strokeWidth: 1,   color: "#d4d0c8" },
  mentions:      { strokeWidth: 1.5, dash: "4 2", color: "#c4c0b8" },
  related:       { strokeWidth: 1.5, dash: "4 2", color: "#c4c0b8" },
  requires:      { strokeWidth: 2,   color: "#1a1a1a" },
  prerequisite:  { strokeWidth: 2,   color: "#1a1a1a" },
  contains:      { strokeWidth: 1.5, color: "#a0a0a0" },
  contrasts_with:{ strokeWidth: 1.5, dash: "2 2", color: "#b08080" },
  derived_from:  { strokeWidth: 1.5, dash: "6 2", color: "#8a8a8a" },
  implements:    { strokeWidth: 2,   color: "#4a7a4a" },
};

function getRelationStyle(relation: string) {
  return RELATION_STYLES[relation] ?? { strokeWidth: 1.5, color: "#c4c0b8" };
}

export function GraphEdgeComponent({
  id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data,
}: EdgeProps) {
  const relation = (data?.relation as string) ?? "related";
  const style = getRelationStyle(relation);
  const [hovered, setHovered] = useState(false);

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: hovered ? "var(--brand, #ff8a00)" : style.color,
          strokeWidth: hovered ? 2.5 : style.strokeWidth,
          strokeDasharray: style.dash,
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />
      {hovered && (
        <EdgeLabelRenderer>
          <div
            className="gedge-label"
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: "none",
              background: "var(--bg-primary, #fff)",
              padding: "1px 4px",
              borderRadius: 3,
              fontSize: 10,
              border: "1px solid var(--border, #ddd)",
            }}
          >
            {relation}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
