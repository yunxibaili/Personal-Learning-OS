/** Home 聚合响应（P8-003 D1 · GET /api/v1/home） */
export interface RecentNote {
  id: number;
  title: string;
  updated_at: string;
}

export interface WeakConcept {
  concept_id: number;
  title: string;
  effective: number;
}

export interface HomeResponse {
  recent_notes: RecentNote[];
  weak_concepts: WeakConcept[];
  review_due: number;
}
