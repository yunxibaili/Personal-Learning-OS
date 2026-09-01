/**
 * FrameStackView（ADR-025 §3.4）：调用栈图形化，用于递归 / factorial / fibonacci。
 *
 * 编码通道（§3.6）：
 *   - 递归深度 = **y 偏移**（位置编码），禁止用颜色深浅表示深度
 *   - 当前帧（栈顶）= 品牌橙描边（注意力指针）
 *   - 变量变更 = 橙描边 + ≤0.3s transition
 *
 * 堆叠方向：栈顶在上（与 VS Code CALL STACK、Python Tutor 一致），
 * 越深的调用者越靠下——深度即纵向位置。
 */
import type { TraceEvent } from "@shared/types/trace";
import { changedKeys, formatValue } from "./derive";

interface FrameStackViewProps {
  event: TraceEvent | undefined;
  prev: TraceEvent | undefined;
}

export function FrameStackView({ event, prev }: FrameStackViewProps) {
  const frames = event?.frames ?? [];
  const changed = changedKeys(prev, event);

  if (frames.length === 0) {
    return <div className="ve-viz__empty">调用栈为空</div>;
  }

  return (
    <div className="ve-stack" role="list" aria-label="调用栈">
      {frames.map((frame, i) => {
        const isTop = i === 0;
        const entries = Object.entries(frame.locals);
        return (
          <div
            key={`${frame.func}-${i}`}
            role="listitem"
            className={`ve-frame${isTop ? " ve-frame--top" : ""}`}
            /* 深度 = y 方向的堆叠次序，颜色不参与深度编码 */
            style={{ marginLeft: `${i * 10}px` }}
          >
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
