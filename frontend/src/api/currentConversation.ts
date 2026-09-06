// ADR-030 §5.1：本模块位于 ADR-029 §6.1 所禁的 wrapper **之外**。
// 只持久化一个 id 指针（`current_conversation_id`），不持久化任何核心数据（AGENTS.md:330）。
//
// Conversation / message 的持久化由 backend 管理；前端只记住「在看哪一个」。
// 禁止顺带持久化：messages / title / draft / mode / conceptId / 选中笔记 / auto_notes /
// streamingText / 滚动位置。
//
// 生成生命周期（start / done / error / stopped）不得触碰本模块的 key —— 与 UX-004 / UX-008
// （message lifecycle，尚未裁决）保持隔离（ADR-030 §6.2、§8）。
import type { ChatMessage, ConversationSummary } from "./conversations";

export const CURRENT_CONVERSATION_KEY = "current_conversation_id";

function storage(): Storage | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    // 存储不可用（非浏览器环境 / 隐私模式）：退化为不持久化，不抛错。
    return null;
  }
}

export function readCurrentConversationId(): number | null {
  const store = storage();
  if (store === null) return null;
  const raw = store.getItem(CURRENT_CONVERSATION_KEY);
  if (raw === null || raw === "") return null;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function writeCurrentConversationId(id: number): void {
  storage()?.setItem(CURRENT_CONVERSATION_KEY, String(id));
}

export function clearCurrentConversationId(): void {
  storage()?.removeItem(CURRENT_CONVERSATION_KEY);
}

// ── 恢复判定（纯函数，可单测；ADR-030 §6.1 / §6.3）──────────────────────────

export type RestoreOutcome =
  /** 无 key：正常空态 */
  | { kind: "empty"; conversations: ConversationSummary[] }
  /** key 保存的 id 已不存在：清 key + 空态（不报错） */
  | { kind: "stale"; conversations: ConversationSummary[] }
  /** 恢复成功 */
  | { kind: "restored"; conversationId: number; messages: ChatMessage[]; conversations: ConversationSummary[] }
  /** 列表请求失败：保留 key + 调用方须显示错误（不静默） */
  | { kind: "list_failed"; message: string }
  /** 消息请求失败：保留 key + 调用方须显示错误（不静默），会话保持选中 */
  | { kind: "messages_failed"; conversationId: number; message: string; conversations: ConversationSummary[] };

export interface RestoreIo {
  listConversations: () => Promise<ConversationSummary[]>;
  getMessages: (conversationId: number) => Promise<ChatMessage[]>;
}

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function isStale(list: ConversationSummary[], conversationId: number): boolean {
  return !list.some((c) => c.id === conversationId);
}

/**
 * mount 时恢复「当前会话」。
 *
 * 只用已有的 `listConversations()` 做成员校验 —— 不新增 `GET /conversations/{id}`
 * （该 path 只注册 DELETE，`GET` 返回 405），也不把 messages 的 404 当正常恢复机制。
 *
 * 失败一律以 outcome 显式返回，由调用方决定是否展示：**不得静默吞掉**。
 */
export async function restoreCurrentConversation(io: RestoreIo): Promise<RestoreOutcome> {
  const saved = readCurrentConversationId();

  let conversations: ConversationSummary[];
  try {
    conversations = await io.listConversations();
  } catch (e) {
    // 列表失败 ≠ id 失效：保留 key，等下次 mount 再试。
    return { kind: "list_failed", message: messageOf(e) };
  }

  if (saved === null) return { kind: "empty", conversations };

  if (isStale(conversations, saved)) {
    clearCurrentConversationId();
    return { kind: "stale", conversations };
  }

  try {
    const messages = await io.getMessages(saved);
    return { kind: "restored", conversationId: saved, messages, conversations };
  } catch (e) {
    // 消息失败同样保留 key（会话本身存在），错误交由调用方显示。
    return { kind: "messages_failed", conversationId: saved, message: messageOf(e), conversations };
  }
}

/**
 * 删除会话时是否应清除 key：只清除「被删除的是当前会话」，
 * 删除非当前会话不动（ADR-030 §6.2）。
 */
export function shouldClearForDeletion(deletedId: number, currentId: number | null): boolean {
  return currentId !== null && currentId === deletedId;
}
