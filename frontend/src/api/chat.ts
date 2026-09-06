// /chat 消费（Phase 1）：统一构造请求 + 唯一 generation path（streaming）。
//
// Phase 1 只有一条路径：buildChatRequest → postStream → SSE parser → STREAMING → done/error/stop。
// 不提供非流式分支——两套 Chat 状态机的维护成本远高于其收益（Owner Q2 拍板）。
//
// 请求契约以 generated schema 为准（ADR-029 L2）：ChatRequest 中 auto_notes / mode /
// stream 三个键在生成类型里都是**必填**（无 `?`），后端虽有默认值但前端不得省略。
// 这与 api/tutor.ts:163 的既有做法一致，不另发明。
//
// TutorMode 从 generated ChatRequest["mode"] 派生，前端不维护第二份枚举。
import { postStream } from "./client";
import { readSseStream } from "./stream";
import type { components } from "./schema";

type ChatRequest = components["schemas"]["ChatRequest"];

/** 唯一的 TutorMode 真相源（generated contract，非手写）。 */
export type TutorMode = ChatRequest["mode"];

/** 供 UI 渲染 mode 选择器；若后端枚举变更，此处赋值会立刻类型报错。 */
export const TUTOR_MODES: readonly TutorMode[] = ["explain", "hint", "review", "debug"];

export const TUTOR_MODE_LABELS: Record<TutorMode, string> = {
  explain: "讲解",
  hint: "提示",
  review: "复习",
  debug: "纠错",
};

/** 与后端 MAX_QUERY_CHARS 对齐（conversations.py）：超限后端返回 422。 */
export const MAX_QUERY_CHARS = 2000;

export interface ChatDraft {
  conversationId: number;
  query: string;
  mode: TutorMode;
  conceptId?: number | null;
  noteIds?: number[];
  autoNotes?: boolean;
}

function chatPath(): "/api/v1/chat" {
  return "/api/v1/chat";
}

export function buildChatRequest(draft: ChatDraft): ChatRequest {
  return {
    conversation_id: draft.conversationId,
    query: draft.query,
    mode: draft.mode,
    stream: true,
    auto_notes: draft.autoNotes === true,
    concept_id: draft.conceptId ?? null,
    note_ids: draft.noteIds !== undefined && draft.noteIds.length > 0 ? draft.noteIds : null,
  };
}

export interface StreamHandlers {
  onText(text: string): void;
  onDone(conversationId: number): void;
  onError(code: string, message: string): void;
}

/**
 * 发起一轮流式对话。
 *
 * 调用方必须先持有 conversationId（Phase 1-A §4.2 NO_CONVERSATION → 先 POST /conversations）：
 * 流式下 conversation_id 只在 event: done 帧返回，中途 Stop 收不到该帧，
 * 而后端 finally 仍会落库——不预建会话就等于丢弃这段已落库内容且无从找回。
 *
 * signal 触发（Stop）时 readSseStream 以 AbortError reject，本函数不吞该异常，
 * 由调用方据此区分 STOPPED 与 ERROR。
 */
export async function streamChat(
  draft: ChatDraft,
  signal: AbortSignal,
  handlers: StreamHandlers,
): Promise<void> {
  const res = await postStream(chatPath(), buildChatRequest(draft), signal);
  await readSseStream(res, (event) => {
    if (event.type === "text") handlers.onText(event.text);
    else if (event.type === "done") handlers.onDone(event.conversationId);
    else handlers.onError(event.code, event.message);
  });
}
