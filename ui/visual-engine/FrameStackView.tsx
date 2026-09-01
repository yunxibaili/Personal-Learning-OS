/**
 * ui/visual-engine/FrameStackView.tsx
 *
 * 调用栈可视化（ADR-025 §3.2 · 递归场景）。
 *
 * 编码通道：
 *  - 栈顶在上（i=0）
 *  - 深度 = y 偏移（位置编码，不引入颜色深浅）
 *  - 栈顶帧 = 橙描边（注意力指针）
 *  - 当前帧相对上一帧变化的 locals = 橙底 + 橙描边
 */
import * as React from "react";
import type { TraceEvent } from "./types";
import { changedKeys, formatValue } from "./derive";

export interface FrameStackViewProps {
  event: TraceEvent;
  prev?: TraceEvent;
}

export function FrameStackView({ event, prev }: FrameStackViewProps): React.ReactElement {
  const frames = event.frames;
  if (frames.length === 0) return <div className="ve-viz__empty">调用栈为空</div>;

  const changed = changedKeys(prev, event);

  return (
    <div className="ve-stack" role="list" aria-label="调用栈">
      {frames.map((frame, i) => {
        const isTop = i === 0;
        const entries = Object.keys(frame.locals);
        return (
          <div
            key={`${i}-${frame.func}`}
            className={`ve-frame${isTop ? " ve-frame--top" : ""}`}
            role="listitem"
            style={{ marginLeft: i * 10 }}
          >
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