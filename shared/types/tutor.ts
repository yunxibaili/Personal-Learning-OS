/** AI Tutor 契约（M4-A）。 */

export interface TutorConcept {
  id: number;
  title: string;
}

export interface TutorMastery {
  knowledge: number;
  practice: number;
  recall: number;
  transfer: number;
  effective: number;
}

export interface TutorMistake {
  id: number;
  description: string;
  occurred_at: string;
}

export interface TutorRelated {
  id: number;
  title: string;
  relation: string;
}

export interface TutorReview {
  next_review: string;
  priority: number;
  last_result: string | null;
}

export interface TutorEvent {
  event_type: string;
  source: string;
  created_at: string;
}

/** 用户显式引用的笔记片段（P8-003D，≤2 篇，excerpt ≤600 字符） */
export interface TutorNote {
  note_id: number;
  title: string;
  excerpt: string;
}

export interface TutorContext {
  concept: TutorConcept;
  mastery: TutorMastery;
  mistakes: TutorMistake[];
  related: TutorRelated[];
  review: TutorReview | null;
  recent_events: TutorEvent[];
  notes?: TutorNote[];
}
