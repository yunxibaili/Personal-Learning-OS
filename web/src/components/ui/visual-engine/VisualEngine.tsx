/**
 * VisualEngine：算法可视化面板（ADR-025 · M9-005 + M9-006 合并交付）
 *
 * 布局（所有者裁定）：**左代码 / 右图形**——借鉴 VS Code「编辑器 + 侧边面板」，
 * 视线左右移动幅度小。代码是主体，图形是同步的解释器，不是装饰。
 *
 * 时间维度用**调试器语义**而非播放器：步进状态是这个面板的局部 useState
 * （ui store 的约定是「业务数据一律来自 API，不进 store」，轨迹属业务数据）。
 *
 * §4.4：非 completed 状态仍回放已录得的部分轨迹——UI 错误态不是空态，
 * 用户能看到程序卡在哪一步，这本身就是诊断信息。
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import type { TraceRun } from "@shared/types/trace";
import { Badge } from "..";
import { CodePane } from "./CodePane";
import { DebugToolbar, KEY_BINDINGS } from "./DebugToolbar";
import { ArrayView } from "./ArrayView";
import { FrameStackView } from "./FrameStackView";
import { GeneralView } from "./GeneralView";
import { nextStepIndex, type StepAction } from "./stepping";
import "./visual-engine.css";

interface VisualEngineProps {
  trace: TraceRun | null;
  /** 示例源码；为空时代码 pane 显示空态而不是崩溃 */
  source: string;
  filename?: string;
  title?: string;
}

const STATUS_TONE = {
  completed: "ok",
  timeout: "warn",
  trace_limit: "warn",
  output_limit: "warn",
  error: "err",
} as const;

const STATUS_TEXT = {
  completed: "执行完成",
  timeout: "执行超时",
  trace_limit: "轨迹超限",
  output_limit: "输出超限",
  error: "执行出错",
} as const;

export function VisualEngine({ trace, source, filename, title }: VisualEngineProps) {
  const [current, setCurrent] = useState(0);
  const events = trace?.events ?? [];

  // 换示例/重跑 → 回到起点（否则会停在上一条轨迹的步号上）
  useEffect(() => {
    setCurrent(0);
  }, [trace]);

  const step = useCallback(
    (action: StepAction) => {
      setCurrent((c) => nextStepIndex(events, c, action));
    },
    [events],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // 面板内的输入控件优先（本面板无输入框，但防御性保留）
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const hit = KEY_BINDINGS.find((b) => b.key === e.key);
      if (!hit) return;
      e.preventDefault();
      step(hit.action);
    },
    [step],
  );

  const template = trace?.metadata.template;
  const event = events[current];
  const prev = current > 0 ? events[current - 1] : undefined;

  // 累积到当前步的 stdout（TraceEvent.stdout 是「本步新增」）
  const stdout = useMemo(
    () => events.slice(0, current + 1).map((e) => e.stdout).join(""),
    [events, current],
  );

  const status = trace?.status;

  return (
    <div
      className="ve"
      tabIndex={0}
      onKeyDown={onKeyDown}
      role="group"
      aria-label="算法可视化"
    >
      <header className="ve__head">
        <span className="ve__title">{title ?? trace?.metadata.example_id ?? "算法可视化"}</span>
        {template && <Badge tone="ink">{template}</Badge>}
        {status && (
          <Badge tone={STATUS_TONE[status]}>{STATUS_TEXT[status]}</Badge>
        )}
      </header>

      {trace && status !== "completed" && trace.error && (
        <div className="ve__notice">
          {trace.error.type}：{trace.error.message}
          {events.length > 0 && " · 以下为已录得的部分轨迹"}
        </div>
      )}

      <div className="ve__grid">
        <CodePane
          source={source}
          events={events}
          current={current}
          filename={filename}
        />

        <aside className="ve__side">
          <div className="ve__viz">
            {!template || !event ? (
              <div className="ve-viz__empty">暂无可视化数据</div>
            ) : template === "ArrayView" ? (
              <ArrayView event={event} prev={prev} />
            ) : template === "FrameStackView" ? (
              <FrameStackView event={event} prev={prev} />
            ) : (
              <GeneralView event={event} prev={prev} />
            )}
          </div>

          <div className="ve__out">
            <div className="ve__out-head">输出</div>
            <pre className="ve__out-body">
              {stdout || <span className="ve__out-empty">（无输出）</span>}
            </pre>
          </div>
        </aside>
      </div>

      <DebugToolbar events={events} current={current} onStep={step} />
    </div>
  );
}
