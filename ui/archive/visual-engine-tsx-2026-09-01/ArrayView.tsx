/**
 * ArrayView（ADR-025 §3.4）：数组图形化，用于排序 / 查找。
 *
 * 编码通道（§3.6）：
 *   - 元素值 = **条高**（长度编码），禁止「条高 + 颜色」双编码
 *   - 本步变化的下标 = 橙描边（§3.6 允许的「变量变更」通道，≤0.3s transition）
 *
 * **不猜「当前指针」**：ADR §3.4 明确 V1 不做算法语义推断（不检测 swap、不做
 * heap diff）。高亮的是「本步相对上一步真的变了的下标」——这是纯数据比较，
 * 不是算法推断，且比猜指针变量名更准（i / j / lo / hi 各有各的叫法）。
 */
import type { TraceEvent } from "@shared/types/trace";
import { changedIndices, normalizeHeights, pickNumericArray } from "./derive";

interface ArrayViewProps {
  event: TraceEvent | undefined;
  prev: TraceEvent | undefined;
}

const W = 320;
const H = 168;
const PAD_TOP = 22; // 值标签
const PAD_BOTTOM = 22; // 下标标签
const GAP = 6;

export function ArrayView({ event, prev }: ArrayViewProps) {
  const series = pickNumericArray(event);
  const prevSeries = pickNumericArray(prev);

  // 空态不 return null：容器预留定高，避免 CLS（异步加载时布局跳动）
  if (!series || series.values.length === 0) {
    return <div className="ve-viz__empty">当前作用域没有数组</div>;
  }

  const values = series.values;
  const heights = normalizeHeights(values);
  const changed =
    prevSeries && prevSeries.name === series.name
      ? changedIndices(prevSeries.values, series.values)
      : new Set<number>();

  const n = values.length;
  const barW = (W - GAP * (n - 1)) / n;
  const plotH = H - PAD_TOP - PAD_BOTTOM;

  return (
    <div className="ve-array">
      <div className="ve-array__label">
        <span className="ve-kv__k">{series.name}</span>
        <span className="ve-array__len">len {n}</span>
      </div>

      <svg
        className="ve-array__svg"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`数组 ${series.name}：${values.join(", ")}`}
      >
        {values.map((v, i) => {
          const h = Math.max(2, heights[i] * plotH);
          const x = i * (barW + GAP);
          const y = H - PAD_BOTTOM - h;
          const isChanged = changed.has(i);
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
                y={H - 6}
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
