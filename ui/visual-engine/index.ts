/**
 * ui/visual-engine/index.ts
 *
 * Visual Engine UI 库入口（M9 · ADR-025）。
 *
 * 这是**唯一**对项目外（`web/src/components/ui/`）暴露面。
 * 项目内不直接 import 本目录下的组件——`web/src/components/ui/index.ts`
 * 按所有者裁定（2026-09-01）**不导出** M9 组件，回灌时再解冻。
 *
 * 典型消费（M9-007）：
 *   import { VisualEngine } from "ui/visual-engine";
 *   // 由 Concept 页按 concepts.title 匹配 ExampleDefinition 后传入
 *   <VisualEngine example={ex} run={traceRun} onVisualize={recordEvent} />
 */

export { VisualEngine } from "./VisualEngine";
export { CodePane } from "./CodePane";
export { DebugToolbar, KEY_BINDINGS } from "./DebugToolbar";
export { ArrayView } from "./ArrayView";
export { FrameStackView } from "./FrameStackView";
export { GeneralView } from "./GeneralView";

// 纯逻辑层（项目内 tracer / 测试可复用）
export {
  // stepping
  nextStepIndex,
  canStep,
  stackDepth,
} from "./stepping";
export {
  // derive
  formatValue,
  computeHitCounts,
  inlineValuesForLine,
  changedKeys,
  pickNumericArray,
  changedIndices,
  normalizeHeights,
  isArrayView,
  isFrameView,
} from "./derive";
export {
  // highlight
  tokenizePython,
  tokenizePythonLine,
} from "./highlight";

export type {
  TraceValue,
  TraceFrame,
  TraceEvent,
  TraceRun,
  TraceRunStatus,
  TraceRunError,
  TraceTemplate,
  ExampleDefinition,
  StepAction,
  VisualEngineProps,
} from "./types";

export type { Token, TokenizeResult, QuoteState, HighlightKind } from "./highlight";

// CSS 入口（按需在 web/global.css 后追加 import "./visual-engine/visual-engine.css"）
export const CSS_PATH = "./visual-engine.css";