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
  assistantMessageView,
  createConversation,
  deleteConversation,
  getMessages,
  listConversations,
  type ChatMessage,
  type ConversationSummary,
} from "../../api/conversations";
import {
  classifyChatError,
  loadProviderState,
  type ProviderReadiness,
} from "../../api/settings";
import {
  clearCurrentConversationId,
  restoreCurrentConversation,
  shouldClearForDeletion,
  writeCurrentConversationId,
} from "../../api/currentConversation";

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
    case "failed":
      return { ...state, status: "error", errorMessage: action.message };
    case "settled":
      return state.status === "streaming" ? { ...state, status: "idle" } : state;
  }
}

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
  // UX-001：就绪状态机只存内存（ADR-030：sessionStorage 只允许 current_conversation_id）。
  const [provider, setProvider] = useState<ProviderReadiness>("UNKNOWN");
  const [mode, setMode] = useState<TutorMode>("explain");
  const [query, setQuery] = useState("");
  const [listError, setListError] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
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
    // ADR-030 §6.1：mount 时恢复「当前会话」。
    // 恢复失败（list / messages）一律显式呈现，**不静默吞掉**。
    void (async () => {
      const outcome = await restoreCurrentConversation({ listConversations, getMessages });
      if (outcome.kind === "list_failed") {
        // 列表失败：key 保留，等下次 mount 再试。
        setListError(`会话列表加载失败：${outcome.message}`);
        return;
      }
      setConversations(outcome.conversations);
      setListError(null);
      if (outcome.kind === "restored") {
        dispatch({ type: "select", conversationId: outcome.conversationId });
        setMessages(outcome.messages);
        setRestoreError(null);
      } else if (outcome.kind === "messages_failed") {
        // 会话存在：保持选中并保留 key，只报消息加载失败。
        dispatch({ type: "select", conversationId: outcome.conversationId });
        setRestoreError(`消息加载失败：${outcome.message}`);
      }
      // stale：key 已在 restoreCurrentConversation 内清除，保持空态、不报错。
    })();
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
    writeCurrentConversationId(id);
    dispatch({ type: "select", conversationId: id });
    setMessages([]);
    await reloadMessages(id);
  }

  async function newConversation() {
    if (state.status === "streaming") return;
    try {
      const created = await createConversation();
      writeCurrentConversationId(created.id);
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
      if (shouldClearForDeletion(id, state.conversationId)) {
        clearCurrentConversationId();
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
    setProvider("GENERATING");
    try {
      await streamChat(
        { conversationId, query: trimmed, mode, conceptId, noteIds, autoNotes },
        controller.signal,
        {
          onText: (text) => dispatch({ type: "chunk", text }),
          onDone: () => {
            setProvider("OK");
            dispatch({ type: "settled" });
          },
          onError: (code, message) => {
            // UX-001：按 code 分类，只给用户中文文案，绝不拼接内部 code。
            const failure = classifyChatError(code, message);
            setProvider(failure.readiness);
            dispatch({ type: "failed", message: failure.message });
          },
        },
      );
    } catch (e) {
      // UX-004/008：abort 不做任何前端断言——「是否中断、中断到哪」以后端
      // messages.status 为准（前端无从证明后端一定完成了持久化）。
      if (!isAbort(e)) {
        const code = e instanceof ApiError ? e.code : "";
        const detail = e instanceof ApiError ? e.message : String(e);
        const failure = classifyChatError(code, detail);
        setProvider(failure.readiness);
        dispatch({ type: "failed", message: failure.message });
      }
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

      {provider === "UNKNOWN" && (
        <p className="chat-provider-warn">模型配置状态未知（读取 /settings 失败）。</p>
      )}
      {provider === "NOT_CONFIGURED" && (
        <p className="chat-provider-warn">
          未配置真实模型：当前回答来自 Mock provider（/chat 仍返回 200，但非真实生成）。
        </p>
      )}
      {provider === "UNREACHABLE" && (
        <p className="state-error">
          连不上模型服务：请求超时或网络不可达。请确认模型服务已启动、base_url 正确。
        </p>
      )}
      {provider === "FAILED" && (
        <p className="state-error">
          模型不可用：已配置，但最近一次生成失败。请检查模型名称与 API key 是否正确。
        </p>
      )}

      <p className="chat-context">
        上下文：
        {conceptLabel !== null ? `概念《${conceptLabel}》` : "未选概念（自由问答）"}
        {noteLabels.length > 0 ? ` · 引用 ${noteLabels.join("、")}` : ""}
        {autoNotes ? " · 自动检索相关笔记" : ""}
      </p>

      {restoreError !== null && <p className="state-error">{restoreError}</p>}

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
            {messages.map((m) => {
              // UX-004/008：生命周期呈现完全由后端 status 决定（不从 content 推断）。
              const view = assistantMessageView(m);
              return (
                <li key={m.id} className={`chat-msg chat-msg-${m.role === "user" ? "user" : "assistant"}`}>
                  <span className="chat-role">{m.role === "user" ? "我" : "Tutor"}</span>
                  <div className="chat-content">
                    {m.role === "assistant" && m.status !== "complete" && m.content === "" ? (
                      <span className="chat-failed">{view.text}</span>
                    ) : (
                      view.text
                    )}
                    {view.note !== null && (
                      <p className="chat-msg-status">{view.note}</p>
                    )}
                  </div>
                </li>
              );
            })}
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

          {state.status === "error" && state.errorMessage !== null && (
            <p className="state-error">{state.errorMessage}</p>
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
