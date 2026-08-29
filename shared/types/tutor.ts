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

/** 用户长期记忆条目（B8，≤5 条，importance×新近度排序） */
export interface TutorMemory {
  kind: string;
  content: string;
  importance: number;
  last_used_at: string;
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

/** B2 流式输出（SSE）事件契约。POST /chat 请求体 stream=true 时返回 text/event-stream。
 * 帧格式与 server/app/routers/conversations.py `_sse`/`_chat_stream` 对齐。 */
export type TutorStreamFrame =
  | { event: "data"; text: string }
  | { event: "done"; conversation_id: number }
  | { event: "error"; code: string; message: string };
