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
 * 纯逻辑模块（stepping/derive/highlight）与其单测同目录存放：
 * web/src/components/ui/visual-engine/，经深路径导入复用。
 */
export { VisualEngine } from "./visual-engine/VisualEngine";
export { CodePane } from "./visual-engine/CodePane";
export { DebugToolbar, KEY_BINDINGS } from "./visual-engine/DebugToolbar";
export { FrameStackView } from "./visual-engine/FrameStackView";
export { ArrayView } from "./visual-engine/ArrayView";
export { GeneralView } from "./visual-engine/GeneralView";
export {
  canStep,
  nextStepIndex,
  stackDepth,
  type StepAction,
} from "./visual-engine/stepping";
export {
  computeHitCounts,
  formatValue,
  inlineValuesForLine,
  changedKeys,
  pickNumericArray,
  changedIndices,
  normalizeHeights,
} from "./visual-engine/derive";
export { tokenizePython, tokenizePythonLine } from "./visual-engine/highlight";
