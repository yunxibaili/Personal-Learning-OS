// Mastery 消费端（MVP-04）。
// 契约（源码 + 隔离探针已核查，2026-09-05）：
//   GET /mastery → {mastery: [...]}，core 侧 effective DESC，无分页/筛选参数；
//   GET /mastery/weak/list → {weak: [...]}，effective > 0 升序，limit 固定 10；
//   两端点同构：{concept_id, title, dimensions{4}, effective, effective_now,
//   next_review, ease_factor, interval, review_count}。
//   effective_now 是后端每次请求现算的衰减值（tau=14 天），前端原样展示，
//   不做任何衰减/聚合/排序计算（L1）。
//   next_review 等 review 字段本轮不消费（MVP-05 语义）。
// 响应体在 OpenAPI 中为自由 schema（后端 `-> dict`），窄化策略同 notes.ts。
import { api, ApiError } from "./client";
import { asString, isRecord } from "./validate";

export interface MasteryDimensions {
  knowledge: number;
  practice: number;
  recall: number;
  transfer: number;
}

export interface MasteryEntry {
  concept_id: number;
  title: string;
  dimensions: MasteryDimensions;
  effective: number;
  effective_now: number;
}

function asDimensions(v: unknown): MasteryDimensions {
  if (!isRecord(v)) {
    throw new ApiError(0, "contract_mismatch", "mastery.dimensions 非对象");
  }
  return {
    knowledge: v.knowledge as number,
    practice: v.practice as number,
    recall: v.recall as number,
    transfer: v.transfer as number,
  };
}

function asMasteryEntry(v: unknown): MasteryEntry {
  if (!isRecord(v)) {
    throw new ApiError(0, "contract_mismatch", "mastery 非对象");
  }
  return {
    concept_id: v.concept_id as number,
    title: asString(v.title, "mastery.title"),
    dimensions: asDimensions(v.dimensions),
    effective: v.effective as number,
    effective_now: v.effective_now as number,
  };
}

function asEntryList(container: unknown, field: string): MasteryEntry[] {
  if (!isRecord(container) || !Array.isArray(container[field])) {
    throw new ApiError(0, "contract_mismatch", `mastery 响应缺 ${field} 数组`);
  }
  return (container[field] as unknown[]).map(asMasteryEntry);
}

export async function listMastery(): Promise<MasteryEntry[]> {
  const res: unknown = await api.get("/api/v1/mastery");
  return asEntryList(res, "mastery");
}

export async function listWeakConcepts(): Promise<MasteryEntry[]> {
  const res: unknown = await api.get("/api/v1/mastery/weak/list");
  return asEntryList(res, "weak");
}
