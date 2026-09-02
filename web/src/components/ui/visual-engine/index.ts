/**
 * ui/visual-engine/index.ts
 *
 * Visual Engine UI 库入口（M9 · ADR-025）。
 *
 * **2026-09-02 解冻（M9-007）**：本目录已回灌至 `web/src/components/ui/visual-engine/`
 * （逐字节一致），`web/src/components/ui/index.ts` 导出本入口的组件与类型。
 * **维护规则**：改本目录文件后必须同步复制到 web 侧副本，两边保持逐字节一致；
 * 样式定稿处仍是 `ui/visual-engine.html`。
 *
 * 典型消费（M9-007 已落地）：
 *   import { VisualEngine } from "components/ui/visual-engine";
 *   // 由图谱 Inspector 按 concepts.title 匹配 ExampleDefinition 后传入
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