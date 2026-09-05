// Search 消费端（MVP-02）。
// 契约（源码 + 运行时探针已核查，2026-09-05）：GET /api/v1/search?q=
//   200 {"results": [{note_id, title}]}；FTS5 rank 排序，limit 固定 50（core 侧，
//   前端不可控）；空 q → 400 missing_q（统一错误形状，UI 不发空查询）。
// 响应体在 OpenAPI 中为自由 schema（后端 `-> dict`），窄化策略同 notes.ts；
// 前端不做任何 FTS/LIKE/排序逻辑（L3）。
import { api, ApiError } from "./client";
import { asString, isRecord } from "./validate";

export interface SearchResult {
  note_id: number;
  title: string;
}

export async function searchNotes(q: string): Promise<SearchResult[]> {
  const res = await api.get("/api/v1/search", { q });
  const results = (res as { results?: unknown }).results;
  if (!Array.isArray(results)) {
    throw new ApiError(0, "contract_mismatch", "search 响应缺 results 数组");
  }
  return results.map((r) => {
    if (!isRecord(r)) {
      throw new ApiError(0, "contract_mismatch", "search result 非对象");
    }
    return { note_id: r.note_id as number, title: asString(r.title, "search.title") };
  });
}
