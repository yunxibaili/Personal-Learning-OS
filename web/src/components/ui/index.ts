/**
 * P1/P2 基础组件层（FE-001 Phase 1）。
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
export { Select } from "./Select";
export { Modal, Tooltip, SegmentedControl, Tabs, Switch } from "./controls";
export { ToastProvider, useToast } from "./Toast";
