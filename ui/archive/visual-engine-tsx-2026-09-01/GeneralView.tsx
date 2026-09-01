/**
 * GeneralView（ADR-025 §3.4）：V1 fallback，用于线性查找等简单算法。
 *
 * 展示调用栈 + 各帧变量。与 FrameStackView 的区别：不做堆叠的纵向缩进
 * （没有递归深度可编码），改用平铺的帧列表，数组若存在也一并条形化。
 *
 * 编码通道沿用 §3.6：变量变更 = 橙描边；当前帧 = 橙描边（注意力指针）。
 */
import type { TraceEvent } from "@shared/types/trace";
import { changedKeys, formatValue, pickNumericArray } from "./derive";

interface GeneralViewProps {
  event: TraceEvent | undefined;
  prev: TraceEvent | undefined;
}

export function GeneralView({ event, prev }: GeneralViewProps) {
  const frames = event?.frames ?? [];
  const changed = changedKeys(prev, event);
  const series = pickNumericArray(event);

  if (frames.length === 0) {
    return <div className="ve-viz__empty">无变量可显示</div>;
  }

  return (
    <div className="ve-general">
      {series && (
        <div className="ve-general__series">
          <span className="ve-kv__k">{series.name}</span>
          <span className="ve-general__vals">
            {series.values.map((v, i) => (
              <span
                key={i}
                className={`ve-chip${
                  prev && pickNumericArray(prev)?.values[i] !== v ? " ve-chip--changed" : ""
                }`}
              >
                {v}
              </span>
            ))}
          </span>
        </div>
      )}

      {frames.map((frame, i) => {
        const entries = Object.entries(frame.locals);
        return (
          <div key={`${frame.func}-${i}`} className="ve-frame">
            <div className="ve-frame__head">
              <span className="ve-frame__func">{frame.func}</span>
              <span className="ve-frame__line">L{frame.line}</span>
            </div>
            <div className="ve-frame__locals">
              {entries.length === 0 ? (
                <span className="ve-frame__none">—</span>
              ) : (
                entries.map(([k, v]) => (
                  <span
                    key={k}
                    className={`ve-kv${changed.has(k) ? " ve-kv--changed" : ""}`}
                  >
                    <span className="ve-kv__k">{k}</span>
                    <span className="ve-kv__v">{formatValue(v, 20)}</span>
                  </span>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
