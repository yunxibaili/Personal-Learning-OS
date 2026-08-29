/**
 * GraphEdge（P8-002）：Graph 关系边 — 两级中性灰，hover 才启用品牌橙。
 *
 * ADR-023 冻结：
 *   - 默认隐藏 edge label
 *   - hover 显示 relation 标签
 *
 * 简约化（2026-08-29）：
 *   旧版用 9 种关系 × 3 个视觉通道（色相 + 线宽 + 虚线），其中 #b08080 粉红、
 *   #4a7a4a 绿与「白空间 + 橙色生命线」冲突，且同一维度被三个通道重复编码。
 *   现收敛为两个中性层级，hover 才启用品牌橙 ——
 *   橙色是全站唯一强调色，不该被 9 种色相稀释。
 *
 * 参照（数值均取自官方实现，非转述）：
 *   - Obsidian Graph View：默认单色，箭头默认关闭，边无常显标签
 *   - React Flow 官方默认：--xy-edge-stroke-default #b1b1b7 / 1px，不按类型分色
 */
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@xyflow/react";
import { useState } from "react";

/** 依赖类关系（有向学习依赖）提升一级权重；其余关系统一为最轻层级 */
const STRONG_RELATIONS = new Set(["prerequisite", "requires"]);

const EDGE_BASE = "#e5e5e5";
const EDGE_STRONG = "#a3a3a3";

export function GraphEdgeComponent({
  id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data,
}: EdgeProps) {
  const relation = (data?.relation as string) ?? "related";
  const strong = STRONG_RELATIONS.has(relation);
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
          stroke: hovered ? "var(--brand, #ff8a00)" : strong ? EDGE_STRONG : EDGE_BASE,
          strokeWidth: hovered ? 2 : strong ? 1.5 : 1,
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
            }}
          >
            {relation}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
