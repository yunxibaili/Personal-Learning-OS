/**
 * ui/visual-engine/GeneralView.tsx
 *
 * 通用帧 + 变量可视化（ADR-025 §3.2 · V1 fallback）。
 *
 * 与 FrameStackView 区别：
 *  - 没有 y 偏移（深度=位置编码不必要，因为不是递归重点）
 *  - 顶部增加数组 chip 化面板（如果当前帧含数值数组）
 *  - 帧按调用顺序自上而下展开
 *
 * 编码通道同 §3.6：变化键 = 橙描边；橙不用于静态分类。
 */
import * as React from "react";
import type { TraceEvent } from "./types";
import {
  changedKeys,
  formatValue,
  pickNumericArray,
} from "./derive";

export interface GeneralViewProps {
  event: TraceEvent;
  prev?: TraceEvent;
}

export function GeneralView({ event, prev }: GeneralViewProps): React.ReactElement {
  const frames = event.frames;
  if (frames.length === 0) return <div className="ve-viz__empty">无变量可显示</div>;

  const changed = changedKeys(prev, event);
  const series = pickNumericArray(event);
  const prevSeries = pickNumericArray(prev);

  return (
    <div className="ve-general">
      {series && (
        <div className="ve-general__series">
          <span className="ve-kv__k">{series.name}</span>
          <span className="ve-general__vals">
            {series.values.map((v, i) => {
              const isChanged = !!(prevSeries && prevSeries.values[i] !== v);
              return (
                <span
                  key={i}
                  className={`ve-chip${isChanged ? " ve-chip--changed" : ""}`}
                >
                  {v}
                </span>
              );
            })}
          </span>
        </div>
      )}

      {frames.map((frame, i) => {
        const entries = Object.keys(frame.locals);
        return (
          <div key={`${i}-${frame.func}`} className="ve-frame">
            <div className="ve-frame__head">
              <span className="ve-frame__func">{frame.func}</span>
              <span className="ve-frame__line">L{frame.line}</span>
            </div>
            <div className="ve-frame__locals">
              {entries.length === 0 ? (
                <span className="ve-frame__none">—</span>
              ) : (
                entries.map((k) => {
                  const isChanged = !!changed[k];
                  return (
                    <span
                      key={k}
                      className={`ve-kv${isChanged ? " ve-kv--changed" : ""}`}
                    >
                      <span className="ve-kv__k">{k}</span>
                      <span className="ve-kv__v">
                        {formatValue(frame.locals[k], 20)}
                      </span>
                    </span>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}