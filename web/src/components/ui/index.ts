/**
 * P1/P2/P3 基础组件层（FE-001 Phase 1）。
 * 每个组件内建 variant/size/disabled/loading/error 五态中的相关态。
 * 样式全部由 styles/tokens.css 令牌驱动（见 global.css「P1 基础组件」区）。
 */
export {
  Button,
  Input,
  Tag,
  Badge,
  Skeleton,
  Progress,
} from "./primitives";
export { ProgressRing, FadeInUp, CountUp, WaveLink } from "../motion";
export { Select } from "./Select";
export { Textarea, Checkbox, Avatar } from "./basics";
export { Modal, Tooltip, SegmentedControl, Tabs, Switch } from "./controls";
export { ToastProvider, useToast } from "./Toast";

/**
 * Visual Engine 组件集（M9，ADR-025）。
 *
 * **2026-09-02 M9-007 解冻**：已从 `ui/visual-engine/`（样式定稿处
 * `ui/visual-engine.html` 的等值转写）回灌至本目录 `./visual-engine/`，
 * 与 ui 库**逐字节一致**。维护规则：改 ui 库侧文件后必须同步复制过来，
 * 两边不得漂移（与 tokens.css 镜像同一纪律）。纯逻辑测试（stepping 19 /
 * derive 37 / highlight 12）随副本进入 web vitest。
 */
export {
  VisualEngine,
  CodePane,
  DebugToolbar,
  ArrayView,
  FrameStackView,
  GeneralView,
} from "./visual-engine";
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
} from "./visual-engine";
