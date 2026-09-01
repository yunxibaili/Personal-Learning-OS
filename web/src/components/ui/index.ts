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
 * **2026-09-01 所有者裁定：M9 组件不直接合入项目。**
 * 样式与交互先在 `ui/visual-engine.html`（ui 库）定稿，再按定稿稿回灌本目录。
 * 先前已合入的实现（35c3ef4）连同 58 项纯逻辑测试一并移出，归档在
 * `ui/archive/visual-engine-tsx-2026-09-01/`，回灌时作为实现参考取回。
 *
 * 本文件**不再导出** M9 组件——避免出现「ui 库一套样式、项目里另一套」的双份来源。
 */
