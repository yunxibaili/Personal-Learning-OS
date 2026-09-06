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
import { api, ApiError } from "./client";
import { asString, isRecord } from "./validate";

export interface ConversationSummary {
  id: number;
  title: string;
  created_at: string;
  message_count: number;
}

export interface ChatMessage {
  id: number;
  role: string;
  content: string;
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

function asMessage(v: unknown): ChatMessage {
  if (!isRecord(v)) throw new ApiError(0, "contract_mismatch", "message 非对象");
  return {
    id: v.id as number,
    role: asString(v.role, "message.role"),
    content: asString(v.content, "message.content"),
    context: isRecord(v.context) ? v.context : {},
    created_at: asString(v.created_at, "message.created_at"),
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
