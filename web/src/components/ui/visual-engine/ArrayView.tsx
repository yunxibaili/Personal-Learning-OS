/**
 * ui/visual-engine/ArrayView.tsx
 *
 * 数组条形化（ADR-025 §3.2 · 排序/二分场景）。
 *
 * 编码通道：元素值 = 条高（长度编码，唯一通道）；
 * 本步相对上一步变化的下标 = 橙描边（不填充变色——避免双编码）。
 *
 * 严格遵循 §3.4：不猜指针、不做语义推断——变化是纯数据比较。
 */
import * as React from "react";
import type { TraceEvent } from "./types";
import { pickNumericArray, changedIndices, normalizeHeights } from "./derive";

export interface ArrayViewProps {
  /** 当前事件 */
  event: TraceEvent;
  /** 上一事件（用于 diff 高亮） */
  prev?: TraceEvent;
}

const VIEW_W = 320;
const VIEW_H = 168;
const PAD_TOP = 22;
const PAD_BOTTOM = 22;
const GAP = 6;

export function ArrayView({ event, prev }: ArrayViewProps): React.ReactElement {
  const series = pickNumericArray(event);
  if (!series || series.values.length === 0) {
    return <div className="ve-viz__empty">当前作用域没有数组</div>;
  }
  const prevSeries = pickNumericArray(prev);
  const changed =
    prevSeries && prevSeries.name === series.name
      ? changedIndices(prevSeries.values, series.values)
      : {};

  const values = series.values;
  const heights = normalizeHeights(values);
  const n = values.length;
  const barW = (VIEW_W - GAP * (n - 1)) / n;
  const plotH = VIEW_H - PAD_TOP - PAD_BOTTOM;

  return (
    <div className="ve-array">
      <div className="ve-array__label">
        <span className="ve-kv__k">{series.name}</span>
        <span className="ve-array__len">len {n}</span>
      </div>
      <svg
        className="ve-array__svg"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`数组 ${series.name}：${values.join(", ")}`}
      >
        {values.map((v, i) => {
          const h = Math.max(2, heights[i] * plotH);
          const x = i * (barW + GAP);
          const y = VIEW_H - PAD_BOTTOM - h;
          const isChanged = !!changed[i];
          return (
            <g key={i}>
              <rect
                className={`ve-bar${isChanged ? " ve-bar--changed" : ""}`}
                x={x}
                y={y}
                width={barW}
                height={h}
                rx={3}
              />
              <text
                className="ve-bar__val"
                x={x + barW / 2}
                y={y - 6}
                textAnchor="middle"
              >
                {v}
              </text>
              <text
                className="ve-bar__idx"
                x={x + barW / 2}
                y={VIEW_H - 6}
                textAnchor="middle"
              >
                {i}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}