/** Learning Graph 契约（M3）。 */

export interface MasteryDimensions {
  knowledge: number;
  practice: number;
  recall: number;
  transfer: number;
}

export interface MasteryDetail {
  concept_id: number;
  title: string | null;
  dimensions: MasteryDimensions;
  effective: number;
  effective_now: number;
  next_review: string | null;
  ease_factor: number;
  interval: number;
  review_count: number;
}

export interface MasteryListResponse {
  mastery: MasteryDetail[];
}

export interface ReviewItem {
  concept_id: number;
  title: string;
  due_at: string;
  priority: number;
  last_result: string | null;
  effective: number;
  effective_now: number;
}

export interface ReviewTodayResponse {
  reviews: ReviewItem[];
}

export interface AnswerResponse {
  mastery: MasteryDetail;
  next_review: string;
  ease_factor: number;
  interval: number;
}

/** B12 错题本契约（mistakes 表消费面）。 */
export interface Mistake {
  id: number;
  concept_id: number;
  concept_title: string | null;
  concept_status: string | null;
  description: string;
  resolved: boolean;
  occurred_at: string;
}

export interface MistakeListResponse {
  mistakes: Mistake[];
  total?: number;
}

export interface MistakeStats {
  total: number;
  unresolved: number;
  resolved: number;
  by_concept: Array<{
    concept_id: number;
    title: string;
    count: number;
    unresolved: number;
  }>;
}

/** B13 复习历史分析契约。 */
export interface ReviewStats {
  total_reviews: number;
  correct: number;
  wrong: number;
  accuracy: number;
  current_streak: number;
  by_concept: Array<{
    concept_id: number;
    title: string;
    count: number;
    correct: number;
    wrong: number;
  }>;
}
