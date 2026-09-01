/**
 * CodePane：IDE 风格代码面板（M9-005/006）
 *
 * 借鉴 VS Code Debug 的信息布局，但**不做播放器**：
 *   - 当前执行行：品牌橙底纹（ADR-025 §3.6 唯一通道）
 *   - 调用者所在行：淡墨蓝底 + gutter 竖条——调用栈里每一帧停在哪，代码里看得到
 *   - gutter 左侧：执行次数热力（静态全貌，越多次越实）
 *   - 行尾 inline values：本行出现的变量在本步的值（VS Code inline values）
 *
 * 不用 zustand：步进状态是这个面板的局部状态，由容器持有并传入
 * （ui store 的约定是「业务数据一律来自 API，不进 store」，轨迹数据不进全局）。
 */
import { useEffect, useMemo, useRef } from "react";
import type { TraceEvent } from "@shared/types/trace";
import { tokenizePython } from "./highlight";
import { changedKeys, computeHitCounts, inlineValuesForLine } from "./derive";

interface CodePaneProps {
  source: string;
  events: readonly TraceEvent[];
  /** 当前步（0-based，指向 events） */
  current: number;
  /** 文件名，仅作展示 */
  filename?: string;
}

export function CodePane({ source, events, current, filename }: CodePaneProps) {
  const activeRef = useRef<HTMLDivElement | null>(null);

  const lines = useMemo(() => source.split("\n"), [source]);
  const tokenLines = useMemo(() => tokenizePython(source), [source]);
  const hits = useMemo(() => computeHitCounts(events), [events]);

  const event: TraceEvent | undefined = events[current];
  const prev: TraceEvent | undefined = current > 0 ? events[current - 1] : undefined;
  const activeLine = event?.line ?? 0;
  // 栈顶之外的帧：调用者当前停在哪一行
  const callerLines = useMemo(
    () => new Set((event?.frames ?? []).slice(1).map((f) => f.line)),
    [event],
  );
  const changed = useMemo(() => changedKeys(prev, event), [prev, event]);

  const maxHit = useMemo(() => Math.max(1, ...hits.values()), [hits]);

  // 当前行滚入视野：block:"nearest" 避免整页跳动；只在换步时触发一次
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [current]);

  return (
    <section className="ve-code" aria-label="代码">
      <header className="ve-code__head">
        <span className="ve-code__file">{filename ?? "example.py"}</span>
        <span className="ve-code__meta">
          {events.length > 0 ? `第 ${current + 1} / ${events.length} 步` : "无轨迹"}
        </span>
      </header>

      <div className="ve-code__body">
        {lines.map((text, idx) => {
          const lineNo = idx + 1;
          const isActive = lineNo === activeLine;
          const isCaller = !isActive && callerLines.has(lineNo);
          const hit = hits.get(lineNo) ?? 0;

          return (
            <div
              key={lineNo}
              ref={isActive ? activeRef : undefined}
              className={[
                "ve-line",
                isActive ? "ve-line--active" : "",
                isCaller ? "ve-line--caller" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              data-line={lineNo}
            >
              <span className="ve-line__gutter" aria-hidden="true">
                <span
                  className="ve-line__heat"
                  style={{ opacity: hit === 0 ? 0 : 0.25 + 0.75 * (hit / maxHit) }}
                />
                <span className="ve-line__no">{lineNo}</span>
              </span>

              <code className="ve-line__code">
                {tokenLines[idx]?.map((t, ti) => (
                  <span key={ti} className={`ve-t ve-t--${t.kind}`}>
                    {t.text}
                  </span>
                ))}
                {text.length === 0 ? "\u00A0" : null}
              </code>

              {isActive && (
                <span className="ve-line__inline">
                  {inlineValuesForLine(text, event).map((v) => (
                    <span
                      key={v.name}
                      className={`ve-inline${changed.has(v.name) ? " ve-inline--changed" : ""}`}
                    >
                      {v.name} = {v.text}
                    </span>
                  ))}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
