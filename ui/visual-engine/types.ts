/**
 * ui/visual-engine/types.ts
 *
 * TraceRun v1 契约（ADR-025 §4 冻结）。
 *
 * 这是前后端共享契约在前端 ui 库中的镜像——
 * 与 `shared/types/trace.ts`（计划中，M9-002 落点）形状一致。
 * 一旦契约字段变动，须同步：
 *   1. server/app/core/tracer/snapshot.py
 *   2. shared/types/trace.ts
 *   3. ui/visual-engine/types.ts（本文件）
 *   4. ui/visual-engine.smoke.js（HTML 原型冒烟测试）
 */

// ---------------------------------------------------------------- TraceValue
// §4.3：V1 不做对象图，无 heap_id、无 $ref 去重。
export type TraceValue =
  | null
  | boolean
  | number
  | string
  | TraceValue[]
  | { type: "object"; class: string }
  | { type: "depth_limit"; class: string }
  | { type: "truncated"; n: number };

// ---------------------------------------------------------------- TraceFrame
// §4.2
export interface TraceFrame {
  func: string;
  line: number;
  locals: Record<string, TraceValue>;
}

// ---------------------------------------------------------------- TraceEvent
// §4.2 · V1 的 `metadata: {}` 恒为空，是 M9.5 VTA 扩展位
export interface TraceEvent {
  step: number;
  line: number;
  frames: TraceFrame[]; // frames[0] 为当前帧
  stdout: string;
  metadata: Record<string, unknown>;
}

// ---------------------------------------------------------------- TraceRun
// §4.1 · 顶层六字段
export type TraceRunStatus =
  | "completed"
  | "timeout"
  | "error"
  | "trace_limit"
  | "output_limit";

export type TraceTemplate =
  | "FrameStackView"
  | "ArrayView"
  | "GeneralView";

export interface TraceRunError {
  type: string; // SYNTAX / IMPORT_DENIED / RUNTIME / ...
  message: string;
}

export interface TraceRun {
  version: "1"; // 契约版本字符串；新增字段须升 "2" 并经附录裁决
  language: "python"; // V1 唯一取值
  events: TraceEvent[]; // ≤ MAX_TRACE_EVENTS
  status: TraceRunStatus;
  error?: TraceRunError;
  metadata: {
    example_id: string;
    template: TraceTemplate;
    // M9.5 VTA 扩展位：V1 不写任何额外字段
    [key: string]: unknown;
  };
}

// ---------------------------------------------------------------- ExampleRegistry
// §3.3 · Trusted Example Registry。
// `example_id` 是清单枚举键，绝不参与文件路径拼接（防 `../../` 穿透）。
// `concept_title → example_id` 在 registry 构建期保证唯一。
export interface ExampleDefinition {
  example_id: string; // 枚举键（非路径）
  title: string; // UI 显示名
  concept_title: string; // 与 concepts.title 匹配
  template: TraceTemplate;
  file: string; // 仅供 UI 显示文件名，**不参与**路径拼接
  source: string; // UI 渲染所需的源码（M9-007 由后端 TraceRun.source 提供）
}

// ---------------------------------------------------------------- 步进动作
// §8 · 步进语义：into / over / out / back / restart / continue
// 纯函数 stepping.nextStepIndex 消费此枚举
export type StepAction =
  | "into"
  | "over"
  | "out"
  | "back"
  | "continue"
  | "restart";

// ---------------------------------------------------------------- 公共 props
// ADR-025 §8 · 验收 #3：StepPlayer 支持播放、暂停、前进、后退。
// 暂停语义由 `playing` state 控制；前进/后退/进入等通过 `onStep(action)` 暴露。
export interface VisualEngineProps {
  /** 当前示例（含 source）。Concept 页按 concepts.title 匹配后传入。 */
  example: ExampleDefinition;
  /** 该示例的 TraceRun。V1 由 useTraceRun(exampleId) hook 注入（M9-007）。 */
  run: TraceRun;
  /** 初始步号；受控模式必须与 current 同步 */
  initialStep?: number;
  /** 受控当前步号（M9 后可由路由/记忆接管）。不传则组件内自管 */
  current?: number;
  /** 步号变化回调（受控模式必传） */
  onStepChange?: (step: number) => void;
  /** 触发 visualize 学习事件（M9-007 接入 mastery） */
  onVisualize?: () => void;
  /** 可选 className 加到根 */
  className?: string;
}