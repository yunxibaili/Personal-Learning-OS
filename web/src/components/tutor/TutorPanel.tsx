/**
 * TutorPanel（M4-D + B7.1-R）：Context-aware Tutor 面板。
 *
 * ADR-013/016 约束：
 *   - Knowledge tool，not chatbot
 *   - 禁止：气泡、头像、打字动画、魔法按钮
 *   - 允许：context panel、structured answer、action suggestion
 *
 * B7.1-R：走 POST /chat（conversation_id 持久化 + extractor 触发）；
 * B2：stream=true SSE 流式，增量渲染 + 用户可「停止」（AbortController）。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet, apiPost, apiPostStream, ApiError } from "../../lib/api";
import type { TutorStreamFrame } from "@shared/types/tutor";
import { useUi } from "../../stores/ui";
import { SuggestionList } from "../suggestions/SuggestionList";
import { MemoryList } from "../memories/MemoryList";
import "./TutorPanel.css";

type TutorMode = "explain" | "hint" | "review";

interface ConceptContext {
  id: number;
  title: string;
}

interface MasteryContext {
  knowledge: number;
  practice: number;
  recall: number;
  transfer: number;
  effective: number;
}

interface MistakeContext {
  id: number;
  description: string;
  occurred_at: string;
}

interface RelatedContext {
  id: number;
  title: string;
  relation: string;
}

interface ReviewContext {
  next_review: string;
  priority: number;
  last_result: string | null;
}

interface TutorContextData {
  concept: ConceptContext | null;
  mastery: MasteryContext | null;
  mistakes: MistakeContext[];
  related: RelatedContext[];
  review: ReviewContext | null;
  recent_events: unknown[];
  notes?: TutorNoteRef[];
}

/** 用户显式引用的笔记（P8-003D，≤2 篇） */
interface TutorNoteRef {
  note_id: number;
  title: string;
  /** 从未渲染（P8-006 起可选）；/chat 只透传 note_ids */
  excerpt?: string;
}

interface Props {
  /** 当前活跃 concept ID（显式传入优先；否则消费 store 跳转目标） */
  conceptId?: number | null;
}

const MODE_LABELS: Record<TutorMode, string> = {
  explain: "解释",
  hint: "提示",
  review: "复习",
};

const MODE_DESCRIPTIONS: Record<TutorMode, string> = {
  explain: "清楚地解释这个概念",
  hint: "给我提示，不要直接说答案",
  review: "加入复习队列",
};

/** 掌握度条形 */
function MasteryBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  const color =
    value >= 0.7 ? "var(--ok)" : value >= 0.4 ? "var(--brand)" : "var(--err)";
  return (
    <div className="mastery-row">
      <span className="mastery-label">{label}</span>
      <div className="mastery-bar-wrap">
        <div className="mastery-bar" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="mastery-pct">{pct}%</span>
    </div>
  );
}

export function TutorPanel({ conceptId: conceptIdProp }: Props) {
  const focusConceptId = useUi((s) => s.focusConceptId);
  const clearConceptFocus = useUi((s) => s.clearConceptFocus);
  // 显式 props 优先；否则消费跨视图跳转目标（消费即清除，与 focusNoteId 同构）
  const conceptId = conceptIdProp ?? focusConceptId;
  useEffect(() => {
    if (conceptIdProp == null && focusConceptId != null) clearConceptFocus();
  }, [conceptIdProp, focusConceptId, clearConceptFocus]);

  // P8-006：消费一次性 tutorSeed（预填 mode/query/concept/笔记引用）。
  // 语义：seed 只减少重复输入，绝不触发自动提问（ADR-022「你问，我答」）。
  const consumeTutorSeed = useUi((s) => s.consumeTutorSeed);
  const [seedApplied, setSeedApplied] = useState(false);
  useEffect(() => {
    if (seedApplied) return;
    const seed = consumeTutorSeed();
    setSeedApplied(true);
    if (!seed) return;
    if (seed.mode) setMode(seed.mode);
    if (seed.query) setQuery(seed.query);
    // seed.noteIds → 直接作为已选笔记引用（有 title，面板可渲染 chip；
    // context 随下方 useEffect 的 selectedNotes 依赖自动带上 note_ids 重载）
    if (seed.noteIds && seed.noteIds.length > 0) setSelectedNotes(seed.noteIds);
    if (seed.conceptId != null && focusConceptId == null && conceptIdProp == null) {
      useUi.setState({ focusConceptId: seed.conceptId });
    }
    // 仅在挂载时消费一次；依赖刻意只含一次性标记
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedApplied]);

  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<TutorMode>("explain");
  const [context, setContext] = useState<TutorContextData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // B7.1-R：对话持久化（conversation_id 持续对话链）
  const [conversationId, setConversationId] = useState<number | null>(null);

  // B2 前端接线：流式回答逐块渲染 + 用户可中止（「停止」语义依赖流式）。
  // 流式期为增量全文；结束后保持非 null 即为定稿答案（单状态源，无双轨同步）；
  // null = 本轮会话尚无回答。用户中止时保留已到部分（不丢字）。
  const [streamText, setStreamText] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // 笔记引用（P8-003D：用户显式选择，≤2 篇）
  const [selectedNotes, setSelectedNotes] = useState<TutorNoteRef[]>([]);
  const [noteSearch, setNoteSearch] = useState("");
  const [noteResults, setNoteResults] = useState<Array<{ note_id: number; title: string }>>([]);
  const [showNotePicker, setShowNotePicker] = useState(false);

  // B7.1：对话后刷新 Extractor 产物面板（B3.2 概念建议 + B28 记忆）
  const [extractionRefreshKey, setExtractionRefreshKey] = useState(0);

  /** 加载 concept context（有笔记引用时走 POST，携带 note_ids） */
  const loadContext = useCallback(async (cid: number, noteIds: number[] = []) => {
    try {
      const data =
        noteIds.length > 0
          ? await apiPost<TutorContextData>("/tutor/context", {
              concept_id: cid,
              note_ids: noteIds,
            })
          : await apiGet<TutorContextData>(`/tutor/context/${cid}`);
      setContext(data);
    } catch {
      setContext(null);
    }
  }, []);

  /** conceptId 变化或笔记引用变化时重新加载 context */
  useEffect(() => {
    if (conceptId != null) void loadContext(conceptId, selectedNotes.map((n) => n.note_id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conceptId, selectedNotes, loadContext]);

  /** 笔记搜索（复用 FTS /search） */
  const searchNotes = useCallback(async (q: string) => {
    if (!q.trim()) { setNoteResults([]); return; }
    try {
      const data = await apiGet<{ results: Array<{ note_id: number; title: string }> }>(
        `/search?q=${encodeURIComponent(q.trim())}`,
      );
      setNoteResults(data.results.slice(0, 5));
    } catch {
      setNoteResults([]);
    }
  }, []);

  const toggleNote = useCallback((n: { note_id: number; title: string }) => {
    setSelectedNotes((prev) => {
      if (prev.some((p) => p.note_id === n.note_id)) {
        return prev.filter((p) => p.note_id !== n.note_id);
      }
      if (prev.length >= 2) return prev; // 上限 2 篇（后端 400 契约）
      return [...prev, { note_id: n.note_id, title: n.title, excerpt: "" }];
    });
  }, []);

  /**
   * 提交问题（B2 前端接线：走 /chat stream=true SSE 流式）。
   * 增量即时渲染（ADR-016：逐字显示，非打字机动画/气泡）；
   * event:done → conversation_id 续链 + extractor 产物刷新；
   * event:error → 与非流式同款错误条；用户「停止」→ AbortError 静默收尾
   * （后端 try/finally 已保证增量拼装落库，不丢消息）。
   */
  const handleSubmit = useCallback(async () => {
    if (!query.trim()) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError("");
    setStreamText(""); // 本轮新回答从空串开始（上一轮答案即刻被替换）
    try {
      const body: Record<string, unknown> = {
        query: query.trim(),
        mode,
        stream: true,
      };
      // concept_id 可选：有则传，无则不传（/chat 支持 concept_id=None）
      if (conceptId != null) body.concept_id = conceptId;
      // note_ids 透传（P8-003D，≤2 篇）
      const noteIds = selectedNotes.map((n) => n.note_id);
      if (noteIds.length > 0) body.note_ids = noteIds;
      // conversation_id 持续对话链
      if (conversationId != null) body.conversation_id = conversationId;

      await apiPostStream<TutorStreamFrame>("/chat", body, {
        signal: controller.signal,
        onFrame: (f) => {
          if (f.event === "data" && typeof f.text === "string") {
            setStreamText((t) => (t ?? "") + f.text);
          } else if (f.event === "done") {
            if (typeof f.conversation_id === "number") {
              setConversationId(f.conversation_id);
            }
          } else if (f.event === "error") {
            throw new ApiError(
              typeof f.code === "string" ? f.code : "provider_error",
              typeof f.message === "string" ? f.message : "流式中断",
              200,
            );
          }
        },
      });
      // 正常收尾：streamText 保持非 null，全文即定稿答案。
      // B7.1：对话后刷新 Extractor 产物（可能新增概念建议与记忆）
      setExtractionRefreshKey((k) => k + 1);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        // 用户主动停止：后端 try/finally 仍会落库；streamText 保留已到部分
      } else {
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      abortRef.current = null;
      setLoading(false);
      // 不清 streamText：非 null 即答案（增量/定稿/中止保留，同一状态源）
    }
  }, [conceptId, query, mode, selectedNotes, conversationId]);

  /** 停止当前流式回答（用户显式动作；后端落库由 try/finally 保证） */
  const handleStop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  // B7.1-R：移除 conceptId==null 早退，表单始终可见（/chat 支持无 concept 对话）

  return (
    <div className="tutor-panel">
      <div className="tutor-header">AI 导师</div>

      {/* Concept Info */}
      {context?.concept && (
        <div className="tutor-section">
          <div className="tutor-section-title">概念</div>
          <div className="tutor-concept-name">{context.concept.title}</div>
        </div>
      )}

      {/* Mastery */}
      {context?.mastery && (
        <div className="tutor-section">
          <div className="tutor-section-title">掌握度</div>
          <MasteryBar label="掌握" value={context.mastery.knowledge} />
          <MasteryBar label="练习" value={context.mastery.practice} />
          <MasteryBar label="回忆" value={context.mastery.recall} />
          <MasteryBar label="迁移" value={context.mastery.transfer} />
        </div>
      )}

      {/* Weakness */}
      {context?.mistakes && context.mistakes.length > 0 && (
        <div className="tutor-section">
          <div className="tutor-section-title">历史错题</div>
          <ul className="tutor-mistakes">
            {context.mistakes.map((m) => (
              <li key={m.id}>{m.description}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Related */}
      {context?.related && context.related.length > 0 && (
        <div className="tutor-section">
          <div className="tutor-section-title">关联</div>
          <ul className="tutor-related">
            {context.related.map((r) => (
              <li key={r.id}>
                {r.title} <span className="tutor-relation">({r.relation})</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Referenced Notes（P8-003D：显式选择 ≤2 篇） */}
      <div className="tutor-section">
        <div className="tutor-section-title">
          引用笔记
          <button
            className="tutor-note-toggle"
            onClick={() => setShowNotePicker((v) => !v)}
          >
            {showNotePicker ? "关闭" : "引用笔记"}
          </button>
        </div>
        {selectedNotes.length > 0 && (
          <ul className="tutor-note-list">
            {selectedNotes.map((n) => (
              <li key={n.note_id}>
                {n.title}
                <button
                  className="tutor-note-remove"
                  onClick={() => toggleNote({ note_id: n.note_id, title: n.title })}
                  aria-label={`移除 ${n.title}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        {showNotePicker && (
          <div className="tutor-note-picker">
            <input
              className="tutor-input"
              value={noteSearch}
              onChange={(e) => {
                setNoteSearch(e.target.value);
                void searchNotes(e.target.value);
              }}
              placeholder="搜索要引用的笔记"
            />
            <ul className="tutor-note-results">
              {noteResults.map((n) => {
                const picked = selectedNotes.some((p) => p.note_id === n.note_id);
                return (
                  <li key={n.note_id}>
                    <button
                      className={`tutor-note-option ${picked ? "picked" : ""}`}
                      onClick={() => toggleNote(n)}
                    >
                      {n.title}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {/* Mode Selector */}
      <div className="tutor-section">
        <div className="tutor-section-title">操作</div>
        <div className="tutor-modes">
          {(Object.keys(MODE_LABELS) as TutorMode[]).map((m) => (
            <button
              key={m}
              className={`tutor-mode-btn ${mode === m ? "active" : ""}`}
              onClick={() => setMode(m)}
              title={MODE_DESCRIPTIONS[m]}
            >
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="tutor-section">
        <div className="tutor-input-row">
          <input
            className="tutor-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void handleSubmit()}
            placeholder={MODE_DESCRIPTIONS[mode]}
            disabled={loading}
          />
          {loading ? (
            <button className="tutor-ask-btn" onClick={handleStop}>
              停止
            </button>
          ) : (
            <button
              className="tutor-ask-btn"
              onClick={() => void handleSubmit()}
              disabled={!query.trim()}
            >
              提问
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && <div className="tutor-error">{error}</div>}

      {/* Streaming answer（B2：流式期增量渲染，结束后同区定格为全文；
          用户中止保留已到部分。ADR-016 合规：逐字显示非打字机动画，无气泡） */}
      {streamText != null && (
        <div className="tutor-section">
          <div className="tutor-section-title">
            {MODE_LABELS[mode as TutorMode] ?? "Response"}
          </div>
          <div className="tutor-answer">{streamText}</div>
        </div>
      )}

      {/* B3.2: AI Concept Suggestions */}
      <SuggestionList refreshKey={extractionRefreshKey} />

      {/* B28: AI Memories — Extractor 自动写入记忆的可见/可改/可删兜底 */}
      <MemoryList refreshKey={extractionRefreshKey} />
    </div>
  );
}
