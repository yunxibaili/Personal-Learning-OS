// Conversation CRUD 消费（Phase 1）。
// 只消费既有后端契约，不重新设计会话模型（Phase 1-A §4）。
//
// 端点（server/app/routers/conversations.py）：
//   GET    /conversations                    → ConversationsResponse（id 倒序）
//   POST   /conversations                    → 201 ConversationCreated（空标题回退「新对话」）
//   GET    /conversations/{id}/messages      → MessagesResponse（context 为对象快照）
//   DELETE /conversations/{id}               → OkResponse
//
// 与 /chat 的关系：/chat 负责落库 user/assistant 双消息；本模块只读回放。
// 本模块不感知流式——Stop 之后由调用方重新拉取 messages 以对齐后端已落库内容。
//
// UX-004/008：消息生命周期 status 由后端产生（messages.status），类型取自
// generated schema（ADR-029 L2），前端不手写枚举、不从 content 推断。
import { api, ApiError } from "./client";
import type { components } from "./schema";
import { asString, isRecord } from "./validate";

export interface ConversationSummary {
  id: number;
  title: string;
  created_at: string;
  message_count: number;
}

/** 生命周期状态：唯一真相源是后端 MessageItem.status（generated contract）。 */
export type MessageStatus = components["schemas"]["MessageItem"]["status"];

export interface ChatMessage {
  id: number;
  role: string;
  content: string;
  status: MessageStatus;
  context: Record<string, unknown>;
  created_at: string;
}

type MessagesPath = "/api/v1/conversations/{conversation_id}/messages";
const MESSAGES_PATH: MessagesPath = "/api/v1/conversations/{conversation_id}/messages";
function messagesPath(id: number): MessagesPath {
  return MESSAGES_PATH.replace("{conversation_id}", String(id)) as MessagesPath;
}

type ConversationPath = "/api/v1/conversations/{conversation_id}";
const CONVERSATION_PATH: ConversationPath = "/api/v1/conversations/{conversation_id}";
function conversationPath(id: number): ConversationPath {
  return CONVERSATION_PATH.replace("{conversation_id}", String(id)) as ConversationPath;
}

function asArray(v: unknown, field: string): unknown[] {
  if (!Array.isArray(v)) {
    throw new ApiError(0, "contract_mismatch", `conversations.${field} 非数组`);
  }
  return v;
}

function asConversation(v: unknown): ConversationSummary {
  if (!isRecord(v)) throw new ApiError(0, "contract_mismatch", "conversation 非对象");
  return {
    id: v.id as number,
    title: asString(v.title, "conversation.title"),
    created_at: asString(v.created_at, "conversation.created_at"),
    message_count: (v.message_count as number) ?? 0,
  };
}

const MESSAGE_STATUSES: readonly MessageStatus[] = ["complete", "failed", "stopped"];

/**
 * status 窄化。旧后端 / 字段缺失 → 回退 `complete`：
 * 回放不阻断，但也**不伪造**失败或中断语义（UX-004：状态只能来自后端）。
 */
export function asMessageStatus(v: unknown): MessageStatus {
  return MESSAGE_STATUSES.includes(v as MessageStatus) ? (v as MessageStatus) : "complete";
}

function asMessage(v: unknown): ChatMessage {
  if (!isRecord(v)) throw new ApiError(0, "contract_mismatch", "message 非对象");
  return {
    id: v.id as number,
    role: asString(v.role, "message.role"),
    content: asString(v.content, "message.content"),
    status: asMessageStatus(v.status),
    context: isRecord(v.context) ? v.context : {},
    created_at: asString(v.created_at, "message.created_at"),
  };
}

// ── UX-004/008：status → 呈现（纯函数，便于无 DOM 测试）──────────────

export interface AssistantMessageView {
  /** 主文本；内容为空时是占位文案。 */
  text: string;
  /** 状态提示；null = 不显示。 */
  note: string | null;
}

const EMPTY_FAILED_TEXT = "本次生成失败，无内容";
const EMPTY_STOPPED_TEXT = "生成已中断，无内容";
const PARTIAL_FAILED_NOTE = "本次生成失败";
const PARTIAL_STOPPED_NOTE = "生成已中断，仅显示已生成部分";

/**
 * assistant 消息的呈现视图。user 消息直接回原文、无提示。
 *
 * 三态契约（Owner 冻结）：complete → 正常内容；failed → 失败；stopped → 中断。
 * 文案不声称「用户点击了 Stop」——后端只能证明连接未正常走完。
 */
export function assistantMessageView(message: ChatMessage): AssistantMessageView {
  if (message.role !== "assistant" || message.status === "complete") {
    return { text: message.content, note: null };
  }
  if (message.content === "") {
    return {
      text: message.status === "stopped" ? EMPTY_STOPPED_TEXT : EMPTY_FAILED_TEXT,
      note: null,
    };
  }
  return {
    text: message.content,
    note: message.status === "stopped" ? PARTIAL_STOPPED_NOTE : PARTIAL_FAILED_NOTE,
  };
}

export async function listConversations(): Promise<ConversationSummary[]> {
  const res: unknown = await api.get("/api/v1/conversations");
  const list = (res as { conversations?: unknown }).conversations;
  return asArray(list, "conversations").map(asConversation);
}

/**
 * 新建空会话。title 传空串，由后端回退为「新对话」（前端不自行造标题规则）。
 * 注意：201 响应只有 {id, title}（ConversationCreated），**没有** created_at /
 * message_count——不可复用 asConversation（它要求列表项的四字段）。
 */
export async function createConversation(): Promise<ConversationSummary> {
  const res: unknown = await api.post("/api/v1/conversations", { title: "" });
  if (!isRecord(res)) throw new ApiError(0, "contract_mismatch", "conversation 创建响应非对象");
  return {
    id: res.id as number,
    title: asString(res.title, "conversation.title"),
    created_at: typeof res.created_at === "string" ? res.created_at : "",
    message_count: 0,
  };
}

export async function getMessages(conversationId: number): Promise<ChatMessage[]> {
  const res: unknown = await api.get(messagesPath(conversationId));
  const list = (res as { messages?: unknown }).messages;
  return asArray(list, "messages").map(asMessage);
}

export async function deleteConversation(conversationId: number): Promise<void> {
  await api.delete(conversationPath(conversationId));
}
