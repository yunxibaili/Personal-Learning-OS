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
