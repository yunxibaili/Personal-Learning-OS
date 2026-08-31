/** Graph Read Model 契约（TECH_DESIGN §9，ADR-008 多态 links 的只读投影）。 */

export type EntityType = "note" | "concept";

export interface GraphNode {
  /** 形如 "note-3" / "concept-7"，React Flow 唯一键 */
  id: string;
  type: EntityType;
  /**
   * 后端字段为 snake_case（`ref_id`），与本项目其余契约一致
   * （`updated_at` / `source_note_id` / `review_due` …）。
   * 曾误写为 camelCase `refId`，导致前端读到 undefined——2026-08-31 修正。
   */
  ref_id: number;
  title: string;
  domain: string | null;
  status: string | null;
  /** M3 接入真实掌握度；M2 恒为 null（评审条件 4：预留字段） */
  learning: { mastery: number | null; review_due: string | null };
}

export interface GraphEdge {
  source: string;
  target: string;
  relation: string;
}

export interface GraphResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface BacklinkItem {
  note_id: number;
  title: string;
}

export interface BacklinksResponse {
  backlinks: BacklinkItem[];
}
