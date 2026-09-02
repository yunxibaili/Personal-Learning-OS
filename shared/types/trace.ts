/**
 * TraceRun v1 契约（ADR-025 §4）
 * 前后端唯一接口，版本化
 */

// --- TraceValue（ADR-025 §4.3）---

/** 基础类型直接输出 */
export type TracePrimitive = null | boolean | number | string;

/** 截断后的容器 */
export interface TraceTruncated {
  type: "truncated";
  n: number;
}

/** 不可序列化的对象 */
export interface TraceObject {
  type: "object";
  class: string;
}

/** 超限容器 */
export interface TraceDepthLimit {
  type: "depth_limit";
  class: string;
}

/**
 * 类型封闭联合（ADR-025 §4.3 + §8 守护 2）：未知类型在 snapshot 层已归一为
 * `{"type":"object","class":...}`，不存在裸 dict 形态——
 * 曾混入 `Record<string, unknown>` 分支破坏封闭性，M9-007 收口移除。
 */
export type TraceValue =
  | TracePrimitive
  | TraceValue[]
  | TraceTruncated
  | TraceObject
  | TraceDepthLimit;

// --- TraceFrame（ADR-025 §4.2）---

export interface TraceFrame {
  func: string;
  line: number;
  locals: Record<string, TraceValue>;
}

// --- TraceEvent（ADR-025 §4.2）---

export interface TraceEvent {
  step: number;
  line: number;
  frames: TraceFrame[];
  stdout: string;
  metadata: Record<string, unknown>;
}

// --- TraceRun（ADR-025 §4.1）---

export type TraceStatus =
  | "completed"
  | "timeout"
  | "error"
  | "trace_limit"
  | "output_limit";

export interface TraceError {
  type: string;
  message: string;
}

export interface TraceMetadata {
  example_id: string;
  template: "FrameStackView" | "ArrayView" | "GeneralView";
  [key: string]: unknown;
}

export interface TraceRun {
  version: "1";
  language: "python";
  events: TraceEvent[];
  status: TraceStatus;
  error?: TraceError;
  metadata: TraceMetadata;
}

// --- API Request（ADR-025 §4.5）---

export interface TraceRunRequest {
  example_id: string;
  mode?: "trace" | "vta";
}

// --- Example Manifest（ADR-025 §3.3）---

/** `GET /api/v1/trace/examples` 的清单条目（不含源码） */
export interface ExampleEntry {
  example_id: string;
  title: string;
  concept_title: string;
  template: "FrameStackView" | "ArrayView" | "GeneralView";
  /** 示例文件名，仅供 UI 显示（CodePane 标题）；绝不参与路径拼接（ADR-025 §3.3 规则 1） */
  file: string;
}

/** `GET /api/v1/trace/examples/{example_id}` 的响应：条目 + 源码 */
export interface ExampleDetail extends ExampleEntry {
  /** 示例源码全文，代码 pane 与 trace 事件按行号对齐（1-based） */
  source: string;
}

export interface ExampleListResponse {
  examples: ExampleEntry[];
}
