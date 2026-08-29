/** 用户记忆契约（B28 管理面）。 */

/**
 * 记忆类型。与后端 `core/memories.py: VALID_KINDS` 一一对应，改此枚举须同步后端。
 *
 * 冻结条款：后端 `upsert_memory` 的 kind 取值集合是应用层校验（表无 CHECK 约束），
 * 前端枚举仅用于展示与表单，不做唯一校验源。
 */
export type MemoryKind = "fact" | "preference" | "goal" | "mistake_pattern";

/** 管理面记忆条目（B28：`GET /api/v1/memories` 返回形态）。 */
export interface MemoryAdmin {
  id: number;
  kind: MemoryKind;
  content: string;
  /** [0, 1] */
  importance: number;
  /** [0, 1] */
  confidence: number;
  /** `concepts_json` 解析后的数组 */
  concepts: string[];
  /** 原始 JSON 字符串，改写时回传用 concepts（数组）即可 */
  concepts_json: string;
  last_used_at: string;
  created_at: string;
  updated_at: string;
}

/** `GET /api/v1/memories` 响应。`total` 是过滤后总数，非当页条数。 */
export interface MemoryListResponse {
  memories: MemoryAdmin[];
  total: number;
}

/**
 * `PATCH /api/v1/memories/{id}` 请求体——全部可选，未提供的字段保持不变。
 *
 * 与 `TutorMemory`（B8 消费面）的区别：本接口面向「用户查看与管理」，
 * 后端**不做敏感前缀过滤**；`TutorMemory` 面向「进 prompt」，需过滤。
 */
export interface MemoryPatch {
  kind?: MemoryKind;
  content?: string;
  importance?: number;
  confidence?: number;
  concepts?: string[];
}
