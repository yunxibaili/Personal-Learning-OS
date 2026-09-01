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

export type TraceValue =
  | TracePrimitive
  | TraceValue[]
  | Record<string, unknown>
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

export interface ExampleEntry {
  example_id: string;
  title: string;
  concept_title: string;
  template: "FrameStackView" | "ArrayView" | "GeneralView";
  path: string;
}
