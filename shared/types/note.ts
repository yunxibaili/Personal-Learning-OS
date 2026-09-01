/**
 * API 响应契约的唯一权威定义（docs/adr/separation.md §五）。
 * Python 侧以 pytest 契约测试断言真实响应与此文件一致。
 */

export interface NoteSummary {
  id: number;
  path: string;
  title: string;
  tags: string[];
  updated_at: string;
  /**
   * ADR-024 主/副笔记：父笔记 id，无父则为 null。
   *
   * 由后端唯一 `resolve_hierarchy()` 提供（红线 2/5），**不是** links 派生索引——
   * 前端不得据 wikilink 自行推断层级。仅当关系有效时非 null；
   * orphan / 自指 / 成环一律为 null（前端渲染为根，原始值仍保留在 vault 里）。
   */
  parent_id: number | null;
}

/** B4 自动链接建议契约。 */
export interface LinkSuggestion {
  source_note_id: number;
  target_note_id: number;
  target_title: string;
  score: number;
}

export interface NoteDetail extends NoteSummary {
  content_md: string;
}

export interface NoteListResponse {
  notes: NoteSummary[];
}

export interface NoteDetailResponse {
  note: NoteDetail;
}

/** POST /notes 请求体。parent：创建时一步指定父笔记（ADR-024，无效目标不阻断）。 */
export interface NoteCreateBody {
  title: string;
  content_md?: string;
  parent?: string | null;
}

export interface SearchResult {
  note_id: number;
  title: string;
}

export interface SearchResponse {
  results: SearchResult[];
}

export interface AttachmentUploadResponse {
  url: string;
  name: string;
}

export interface OkResponse {
  ok: boolean;
}

export interface SettingsMapResponse {
  settings: Record<string, string>;
}
