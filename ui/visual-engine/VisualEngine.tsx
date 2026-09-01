/**
 * ui/visual-engine/VisualEngine.tsx
 *
 * 组合壳：CodePane（左 6）+ Renderer（右 4）+ DebugToolbar + 输出区 + 状态头。
 *
 * 状态：
 *   - 步号 current 既可受控（current/onStepChange），也可自管（initialStep → useState）
 *   - 业务数据完全来自 props.run（API 返回的 TraceRun），不进 ui store
 *
 * 交互：
 *   - 键盘绑定挂在根 div 的 keydown 上（避开 input/textarea 焦点元素）
 *   - onVisualize 在挂载时触发一次（点击即记录，§6.3）
 *
 * 模板路由：run.metadata.template → ArrayView | FrameStackView | GeneralView
 *   路由逻辑只读模板字段，不做任何语义分析（§3.4 禁止算法推断）。
 */
import * as React from "react";
import type { TraceRun, TraceTemplate, StepAction, VisualEngineProps } from "./types";
import { nextStepIndex } from "./stepping";
import { CodePane } from "./CodePane";
import { DebugToolbar, KEY_BINDINGS } from "./DebugToolbar";
import { ArrayView } from "./ArrayView";
import { FrameStackView } from "./FrameStackView";
import { GeneralView } from "./GeneralView";

const STATUS_TONE: Record<TraceRun["status"], string> = {
  completed: "ok",
  timeout: "warn",
  trace_limit: "warn",
  output_limit: "warn",
  error: "err",
};

const STATUS_TEXT: Record<TraceRun["status"], string> = {
  completed: "执行完成",
  timeout: "执行超时",
  trace_limit: "轨迹超限",
  output_limit: "输出超限",
  error: "执行出错",
};

function Renderer(props: {
  template: TraceTemplate;
  event: TraceRun["events"][number];
  prev?: TraceRun["events"][number];
}): React.ReactElement {
  const { template, event, prev } = props;
  if (template === "ArrayView")      return <ArrayView event={event} prev={prev} />;
  if (template === "FrameStackView") return <FrameStackView event={event} prev={prev} />;
  return <GeneralView event={event} prev={prev} />;
}

export function VisualEngine(props: VisualEngineProps): React.ReactElement {
  const {
    example,
    run,
    initialStep = 0,
    current,
    onStepChange,
    onVisualize,
    className,
  } = props;

  // 受控 / 非受控模式
  const [internalCurrent, setInternalCurrent] = React.useState(initialStep);
  const isControlled = current !== undefined;
  const actualCurrent = isControlled ? current : internalCurrent;

  const events = run.events;
  const ev = events[actualCurrent];
  const prev = actualCurrent > 0 ? events[actualCurrent - 1] : undefined;

  const setCurrent = React.useCallback(
    (next: number) => {
      if (!isControlled) setInternalCurrent(next);
      onStepChange?.(next);
    },
    [isControlled, onStepChange]
  );

  const handleStep = React.useCallback(
    (action: StepAction) => {
      const next = nextStepIndex(events, actualCurrent, action);
      if (next !== actualCurrent) setCurrent(next);
    },
    [events, actualCurrent, setCurrent]
  );

  // 键盘绑定（挂在根上，避开 input/textarea）
  const rootRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    function onKeyDown(e: KeyboardEvent): void {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase() ?? "";
      if (tag === "input" || tag === "textarea") return;
      const hit = KEY_BINDINGS.find((b) => b.key === e.key);
      if (!hit) return;
      e.preventDefault();
      handleStep(hit.action);
    }
    root.addEventListener("keydown", onKeyDown);
    return () => root.removeEventListener("keydown", onKeyDown);
  }, [handleStep]);

  // 点击即记录 visualize（M9-007 接入 mastery；本组件只负责触发）
  const visualizedRef = React.useRef(false);
  React.useEffect(() => {
    if (visualizedRef.current) return;
    visualizedRef.current = true;
    onVisualize?.();
    // 仅挂载时触发一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 切换 example 时把步号重置为 0
  React.useEffect(() => {
    setInternalCurrent(0);
  }, [example.example_id]);

  const template = run.metadata.template;
  const total = events.length;
  const stepMeta = total > 0 ? `第 ${actualCurrent + 1} / ${total} 步` : "无轨迹";

  // 输出：累计到当前步（含当前步）的 stdout
  const stdout = React.useMemo(() => {
    let buf = "";
    for (let i = 0; i <= actualCurrent && i < events.length; i++) {
      buf += events[i].stdout;
    }
    return buf;
  }, [events, actualCurrent]);

  return (
    <div
      className={`ve${className ? " " + className : ""}`}
      ref={rootRef}
      tabIndex={0}
      role="group"
      aria-label="算法可视化"
    >
      <header className="ve__head">
        <span className="ve__title">
          {example.title} · {example.concept_title}
        </span>
        <span className="ve-badge ve-badge--ink">{template}</span>
        <span className={`ve-badge ve-badge--${STATUS_TONE[run.status]}`}>
          {STATUS_TEXT[run.status] ?? run.status}
        </span>
      </header>

      {run.status !== "completed" && run.error && (
        <div className={`ve__notice${run.status === "error" ? " ve__notice--err" : ""}`}>
          {run.error.type}：{run.error.message}
          {run.events.length > 0 ? " ·以下为已录得的部分轨迹" : ""}
        </div>
      )}

      <div className="ve__grid">
        <CodePane
          source={example.source}
          event={ev}
          prev={prev}
          file={example.file}
          stepMeta={stepMeta}
        />

        <aside className="ve__side">
          <div className="ve__viz">
            {template && ev ? (
              <Renderer template={template} event={ev} prev={prev} />
            ) : (
              <div className="ve-viz__empty">暂无可视化数据</div>
            )}
          </div>
          <div className="ve__out">
            <div className="ve__out-head">输出 · stdout</div>
            <pre className="ve__out-body">
              {stdout ? stdout : <span className="ve__out-empty">（无输出）</span>}
            </pre>
          </div>
        </aside>
      </div>

      <DebugToolbar events={events} current={actualCurrent} onStep={handleStep} />
    </div>
  );
}