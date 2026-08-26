/**
 * API 响应契约的唯一权威定义（docs/architecture/separation.md §五）。
 * Python 侧以 pytest 契约测试断言真实响应与此文件一致。
 */

export interface NoteSummary {
  id: number;
  path: string;
  title: string;
  tags: string[];
  updated_at: string;
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
