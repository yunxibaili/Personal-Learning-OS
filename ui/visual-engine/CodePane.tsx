/**
 * ui/visual-engine/CodePane.tsx
 *
 * 代码主体（ADR-025 §3.2 · IDE 调试器面板样式）。
 *
 *  - gutter：行号 + 执行次数热力竖条（静态全貌通道）
 *  - 当前执行行：品牌橙底纹 + 2px 左侧橙竖条（§3.6 唯一通道）
 *  - 调用栈里外层所在行：中性淡底 + 墨蓝竖条（不与橙抢）
 *  - 行尾 inline values：VS Code 风格，本步变化的名 = 橙描边
 *
 * 着色是零依赖纯函数（6 类记号，复用 tokens.css 既有色相）。
 * 跨行三引号 docstring 由 tokenizePython 自动跨行传递 state。
 *
 * 性能：useMemo 缓存 hits/tokenLines；当前行 useEffect scrollIntoView。
 */
import * as React from "react";
import type { TraceEvent } from "./types";
import {
  computeHitCounts,
  inlineValuesForLine,
  changedKeys,
} from "./derive";
import { tokenizePython } from "./highlight";

export interface CodePaneProps {
  /** 源码（含换行符） */
  source: string;
  /** 当前事件 */
  event: TraceEvent | undefined;
  /** 上一事件（用于 inline diff） */
  prev?: TraceEvent;
  /** 显示文件名（仅 UI，不参与路径拼接） */
  file: string;
  /** 元信息（如「第 12 / 100 步」/「无轨迹」） */
  stepMeta: string;
}

export function CodePane({
  source,
  event,
  prev,
  file,
  stepMeta,
}: CodePaneProps): React.ReactElement {
  // 切分源码 + 命中数 + tokenize：仅当 source 或 events 变化时重算
  const lines = React.useMemo(() => source.split("\n"), [source]);
  const tokenLines = React.useMemo(() => tokenizePython(source), [source]);

  const activeLine = event ? event.line : 0;
  const callerLines = React.useMemo(() => {
    const set: Record<number, true> = {};
    if (event) event.frames.slice(1).forEach((f) => { set[f.line] = true; });
    return set;
  }, [event]);

  const changed = React.useMemo(() => changedKeys(prev, event), [prev, event]);

  const containerRef = React.useRef<HTMLDivElement>(null);

  // 当前行不在可视区时滚到视野（CLS 铁律：容器定高，滚动即可）
  React.useEffect(() => {
    if (!event || !containerRef.current) return;
    const row = containerRef.current.querySelector<HTMLElement>(
      `[data-line="${activeLine}"]`
    );
    if (!row) return;
    const box = containerRef.current.getBoundingClientRect();
    const rb = row.getBoundingClientRect();
    if (rb.top < box.top || rb.bottom > box.bottom) {
      row.scrollIntoView({ block: "nearest" });
    }
  }, [event, activeLine]);

  return (
    <section className="ve-code" aria-label="代码">
      <header className="ve-code__head">
        <span className="ve-code__file">{file}</span>
        <span>{stepMeta}</span>
      </header>
      <div className="ve-code__body" ref={containerRef}>
        {lines.map((text, idx) => {
          const lineNo = idx + 1;
          const isActive = lineNo === activeLine;
          const isCaller = !isActive && !!callerLines[lineNo];
          return (
            <div
              key={lineNo}
              data-line={lineNo}
              className={
                "ve-line" +
                (isActive ? " ve-line--active" : "") +
                (isCaller ? " ve-line--caller" : "")
              }
            >
              <span className="ve-line__gutter" aria-hidden="true">
                <span className="ve-line__heat" />
                <span className="ve-line__no">{lineNo}</span>
              </span>
              <code className="ve-line__code">
                {(tokenLines[idx] || []).map((t, i) => (
                  <span key={i} className={`ve-t ve-t--${t.kind}`}>
                    {t.text}
                  </span>
                ))}
                {text.length === 0 && "\u00A0"}
              </code>
              {isActive && (
                <span className="ve-line__inline">
                  {inlineValuesForLine(text, event).map((v) => {
                    const isChanged = !!changed[v.name];
                    return (
                      <span
                        key={v.name}
                        className={`ve-inline${isChanged ? " ve-inline--changed" : ""}`}
                      >
                        {v.name} = {v.text}
                      </span>
                    );
                  })}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/**
 * 暴露给 VisualEngine 用的命中数计算器：
 * CodePane 自身按事件列表算（执行热力），但需要把 useMemo 留在父组件里以便复用。
 */
export function useHitLines(events: TraceEvent[]): { counts: Record<number, number>; max: number } {
  return React.useMemo(() => computeHitCounts(events), [events]);
}