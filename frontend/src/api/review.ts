// Review 消费端（MVP-05）。
// 契约（源码 + 隔离探针已核查，2026-09-05）：
//   GET /review/today → {reviews: [...]}——due_at<=now 且 pending，后端已排好序
//     （错答优先 → effective_now 升序 → due_at 升序），前端不重排。
//   POST /review/{id}/answer {quality:0-5} → 200 {mastery, next_review, ease_factor,
//     interval}——SM-2 全部后端计算，前端只展示返回值；quality 合法范围由后端
//     契约定义（越界 400 invalid_body，E1），前端只提供 0–5 六个合法输入。
//   GET /review/history?limit=20 → {history: [...]}，created_at DESC。
//   GET /review/stats → {stats: {total_reviews, correct, wrong, accuracy,
//     current_streak, by_concept: [...]}}，全部后端派生值。
//   mastery/review 状态变更（event 写入、队列重排、mistakes 桥接）全在 backend。
// 响应体在 OpenAPI 中为自由 schema（后端 `-> dict`），窄化策略同 notes.ts。
import { api, ApiError } from "./client";
import { asString, isRecord } from "./validate";

export interface ReviewQueueItem {
  concept_id: number;
  title: string;
  due_at: string;
  priority: number;
  status: string;
  last_result: string | null;
  effective_now: number;
}

export interface AnswerResult {
  next_review: string;
  ease_factor: number;
  interval: number;
}

export interface ReviewStats {
  total_reviews: number;
  correct: number;
  wrong: number;
  accuracy: number;
  current_streak: number;
  by_concept: { concept_id: number; title: string; count: number; correct: number; wrong: number }[];
}

export interface ReviewHistoryItem {
  id: number;
  concept_id: number;
  event_type: string;
  title: string;
  created_at: string;
}

function asQueueItem(v: unknown): ReviewQueueItem {
  if (!isRecord(v)) {
    throw new ApiError(0, "contract_mismatch", "review 队列项非对象");
  }
  return {
    concept_id: v.concept_id as number,
    title: asString(v.title, "review.title"),
    due_at: asString(v.due_at, "review.due_at"),
    priority: v.priority as number,
    status: asString(v.status, "review.status"),
    last_result: typeof v.last_result === "string" ? v.last_result : null,
    effective_now: v.effective_now as number,
  };
}

export async function getTodayQueue(): Promise<ReviewQueueItem[]> {
  const res: unknown = await api.get("/api/v1/review/today");
  if (!isRecord(res) || !Array.isArray(res.reviews)) {
    throw new ApiError(0, "contract_mismatch", "review/today 响应缺 reviews 数组");
  }
  return (res.reviews as unknown[]).map(asQueueItem);
}

export async function submitAnswer(conceptId: number, quality: number): Promise<AnswerResult> {
  const path = "/api/v1/review/{concept_id}/answer" as const;
  const res: unknown = await api.post(
    path.replace("{concept_id}", String(conceptId)) as typeof path,
    { quality },
  );
  if (!isRecord(res)) {
    throw new ApiError(0, "contract_mismatch", "answer 响应非对象");
  }
  return {
    next_review: asString(res.next_review, "answer.next_review"),
    ease_factor: res.ease_factor as number,
    interval: res.interval as number,
  };
}

export async function getReviewStats(): Promise<ReviewStats> {
  const res: unknown = await api.get("/api/v1/review/stats");
  const stats = isRecord(res) ? res.stats : undefined;
  if (
    !isRecord(stats) ||
    !Array.isArray(stats.by_concept)
  ) {
    throw new ApiError(0, "contract_mismatch", "review/stats 响应缺 stats/by_concept");
  }
  return {
    total_reviews: stats.total_reviews as number,
    correct: stats.correct as number,
    wrong: stats.wrong as number,
    accuracy: stats.accuracy as number,
    current_streak: stats.current_streak as number,
    by_concept: (stats.by_concept as unknown[]).map((b) => {
      if (!isRecord(b)) {
        throw new ApiError(0, "contract_mismatch", "by_concept 项非对象");
      }
      return {
        concept_id: b.concept_id as number,
        title: asString(b.title, "by_concept.title"),
        count: b.count as number,
        correct: b.correct as number,
        wrong: b.wrong as number,
      };
    }),
  };
}

export async function getReviewHistory(limit = 20): Promise<ReviewHistoryItem[]> {
  const res: unknown = await api.get("/api/v1/review/history", { limit: String(limit) });
  if (!isRecord(res) || !Array.isArray(res.history)) {
    throw new ApiError(0, "contract_mismatch", "review/history 响应缺 history 数组");
  }
  return (res.history as unknown[]).map((h) => {
    if (!isRecord(h)) {
      throw new ApiError(0, "contract_mismatch", "history 项非对象");
    }
    return {
      id: h.id as number,
      concept_id: h.concept_id as number,
      event_type: asString(h.event_type, "history.event_type"),
      title: asString(h.title, "history.title"),
      created_at: asString(h.created_at, "history.created_at"),
    };
  });
}
