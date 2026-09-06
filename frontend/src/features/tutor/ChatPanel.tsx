import { useEffect, useReducer, useRef, useState } from "react";
import { ApiError } from "../../api/client";
import {
  MAX_QUERY_CHARS,
  TUTOR_MODE_LABELS,
  TUTOR_MODES,
  streamChat,
  type TutorMode,
} from "../../api/chat";
import {
  createConversation,
  deleteConversation,
  getMessages,
  listConversations,
  type ChatMessage,
  type ConversationSummary,
} from "../../api/conversations";
import { loadProviderState, type ProviderState } from "../../api/settings";

// Phase 1：Tutor Generation Consumer（MVP-06 是 context preview，本组件才是真正提问 AI）。
//
// 与 TutorView 的关系：concept / notes / auto_notes 由父组件持有并在本组件只读回显，
// 本组件**不构建** TutorContext、不计算 mastery——context 构建完全 backend-owned（L1/L3）。
//
// 状态机（Phase 1-A §4.2）：
//   NO_CONVERSATION →（POST /conversations）→ HAS_CONVERSATION →（send）→ STREAMING
//     → done 帧 / abort() / event: error → 统一 reload messages（以 backend persistence 为准）

type ChatStatus =
  | "no_conversation"
  | "idle"
  | "streaming"
  | "stopped"
  | "error";

interface ChatState {
  status: ChatStatus;
  conversationId: number | null;
  streamingText: string;
  errorMessage: string | null;
}

type ChatAction =
  | { type: "select"; conversationId: number }
  | { type: "deselect" }
  | { type: "start" }
  | { type: "chunk"; text: string }
  | { type: "stopped" }
  | { type: "failed"; message: string }
  | { type: "settled" };

function reducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "select":
      return { status: "idle", conversationId: action.conversationId, streamingText: "", errorMessage: null };
    case "deselect":
      return { status: "no_conversation", conversationId: null, streamingText: "", errorMessage: null };
    case "start":
      return { ...state, status: "streaming", streamingText: "", errorMessage: null };
    case "chunk":
      return state.status === "streaming"
        ? { ...state, streamingText: state.streamingText + action.text }
        : state;
    case "stopped":
      return { ...state, status: "stopped" };
    case "failed":
      return { ...state, status: "error", errorMessage: action.message };
    case "settled":
      return state.status === "streaming" ? { ...state, status: "idle" } : state;
  }
}

const EMPTY_ASSISTANT_PLACEHOLDER = "本次生成失败，无内容";

function errText(e: unknown): string {
  return e instanceof ApiError ? `${e.status} ${e.code}: ${e.message}` : String(e);
}

function isAbort(e: unknown): boolean {
  return e instanceof DOMException && e.name === "AbortError";
}

export interface ChatPanelProps {
  conceptId: number | null;
  conceptLabel: string | null;
  noteIds: number[];
  noteLabels: string[];
  autoNotes: boolean;
}

export default function ChatPanel({
  conceptId,
  conceptLabel,
  noteIds,
  noteLabels,
  autoNotes,
}: ChatPanelProps) {
  const [state, dispatch] = useReducer(reducer, {
    status: "no_conversation",
    conversationId: null,
    streamingText: "",
    errorMessage: null,
  } satisfies ChatState);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [provider, setProvider] = useState<ProviderState>("UNKNOWN");
  const [mode, setMode] = useState<TutorMode>("explain");
  const [query, setQuery] = useState("");
  const [listError, setListError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  async function refreshConversations() {
    try {
      setConversations(await listConversations());
      setListError(null);
    } catch (e) {
      setListError(errText(e));
    }
  }

  useEffect(() => {
    void refreshConversations();
    void loadProviderState().then(setProvider);
    return () => controllerRef.current?.abort();
  }, []);

  async function reloadMessages(conversationId: number) {
    try {
      setMessages(await getMessages(conversationId));
    } catch {
      // 回放失败不阻断：流式结果已在 streamingText 中可见
    }
  }

  async function selectConversation(id: number) {
    if (state.status === "streaming") return; // STREAMING 期间禁止切换会话
    dispatch({ type: "select", conversationId: id });
    setMessages([]);
    await reloadMessages(id);
  }

  async function newConversation() {
    if (state.status === "streaming") return;
    try {
      const created = await createConversation();
      await refreshConversations();
      dispatch({ type: "select", conversationId: created.id });
      setMessages([]);
    } catch (e) {
      setListError(errText(e));
    }
  }

  async function removeConversation(id: number) {
    if (state.status === "streaming") return;
    if (!window.confirm("删除该会话及其全部消息？此操作不可撤销。")) return;
    try {
      await deleteConversation(id);
      if (state.conversationId === id) {
        dispatch({ type: "deselect" });
        setMessages([]);
      }
      await refreshConversations();
    } catch (e) {
      setListError(errText(e));
    }
  }

  function stop() {
    controllerRef.current?.abort();
  }

  async function send() {
    const trimmed = query.trim();
    if (state.conversationId === null || trimmed === "" || state.status === "streaming") return;
    const conversationId = state.conversationId;
    const controller = new AbortController();
    controllerRef.current = controller;
    dispatch({ type: "start" });
    try {
      await streamChat(
        { conversationId, query: trimmed, mode, conceptId, noteIds, autoNotes },
        controller.signal,
        {
          onText: (text) => dispatch({ type: "chunk", text }),
          onDone: () => dispatch({ type: "settled" }),
          onError: (code, message) => dispatch({ type: "failed", message: `${code}: ${message}` }),
        },
      );
    } catch (e) {
      if (isAbort(e)) dispatch({ type: "stopped" });
      else dispatch({ type: "failed", message: errText(e) });
    } finally {
      controllerRef.current = null;
      setQuery("");
      dispatch({ type: "settled" });
      // Q3 拍板：无论 done / stop / error，都以 backend persistence 为准重载。
      // 后端在 finally 中落库（含 Stop 后的部分内容、error 后的空消息），前端必须对齐。
      await reloadMessages(conversationId);
      await refreshConversations();
    }
  }

  const streaming = state.status === "streaming";
  const canSend = state.conversationId !== null && query.trim() !== "" && !streaming;

  return (
    <section className="chatPanel" aria-label="Tutor 对话">
      <h2>提问</h2>

      {provider !== "READY" && (
        <p className="chat-provider-warn">
          {provider === "UNKNOWN"
            ? "模型配置状态未知（读取 /settings 失败）。"
            : "未配置真实模型：当前回答来自 Mock provider（/chat 仍返回 200，但非真实生成）。"}
        </p>
      )}

      <p className="chat-context">
        上下文：
        {conceptLabel !== null ? `概念《${conceptLabel}》` : "未选概念（自由问答）"}
        {noteLabels.length > 0 ? ` · 引用 ${noteLabels.join("、")}` : ""}
        {autoNotes ? " · 自动检索相关笔记" : ""}
      </p>

      <div className="chat-conversations">
        <button type="button" onClick={newConversation} disabled={streaming}>
          新建会话
        </button>
        {listError !== null && <span className="state-error">{listError}</span>}
        <ul className="chat-conv-list">
          {conversations.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className={state.conversationId === c.id ? "active" : ""}
                onClick={() => void selectConversation(c.id)}
                disabled={streaming}
                aria-current={state.conversationId === c.id}
              >
                {c.title}（{c.message_count}）
              </button>
              <button
                type="button"
                className="chat-conv-del"
                onClick={() => void removeConversation(c.id)}
                disabled={streaming}
                aria-label={`删除会话 ${c.title}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      </div>

      {state.conversationId === null ? (
        <p className="state-empty">先新建一个会话，再提问。</p>
      ) : (
        <>
          <ol className="chat-messages" aria-live="polite" aria-label="消息记录">
            {messages.map((m) => (
              <li key={m.id} className={`chat-msg chat-msg-${m.role === "user" ? "user" : "assistant"}`}>
                <span className="chat-role">{m.role === "user" ? "我" : "Tutor"}</span>
                <div className="chat-content">
                  {m.role === "assistant" && m.content === "" ? (
                    <span className="chat-failed">{EMPTY_ASSISTANT_PLACEHOLDER}</span>
                  ) : (
                    m.content
                  )}
                </div>
              </li>
            ))}
            {streaming && (
              <li className="chat-msg chat-msg-assistant">
                <span className="chat-role">Tutor</span>
                <div className="chat-content">
                  {state.streamingText === "" ? (
                    <span className="state-loading">生成中…</span>
                  ) : (
                    state.streamingText
                  )}
                </div>
              </li>
            )}
          </ol>

          {state.status === "stopped" && (
            <p className="chat-stopped">已停止（后端已保存已生成部分）</p>
          )}
          {state.status === "error" && state.errorMessage !== null && (
            <p className="state-error">生成失败：{state.errorMessage}</p>
          )}

          <div className="chat-input">
            <label>
              模式：
              <select value={mode} onChange={(e) => setMode(e.target.value as TutorMode)} disabled={streaming}>
                {TUTOR_MODES.map((m) => (
                  <option key={m} value={m}>
                    {TUTOR_MODE_LABELS[m]}
                  </option>
                ))}
              </select>
            </label>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              maxLength={MAX_QUERY_CHARS}
              rows={3}
              placeholder="输入问题…"
              aria-label="问题内容"
            />
            <div className="chat-actions">
              <span className="chat-counter">
                {query.length}/{MAX_QUERY_CHARS}
              </span>
              {streaming ? (
                <button type="button" onClick={stop}>
                  停止
                </button>
              ) : (
                <button type="button" onClick={() => void send()} disabled={!canSend}>
                  发送
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
