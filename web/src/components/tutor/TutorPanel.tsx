/**
 * TutorPanel（M4-D）：Context-aware Tutor 面板。
 *
 * ADR-013/016 约束：
 *   - Knowledge tool，not chatbot
 *   - 禁止：气泡、头像、打字动画、魔法按钮
 *   - 允许：context panel、structured answer、action suggestion
 */
import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost } from "../../lib/api";
import { useUi } from "../../stores/ui";
import "./TutorPanel.css";

type TutorMode = "explain" | "hint" | "review";

interface TutorAnswer {
  answer: string;
  metadata: {
    mode: string;
    concept: string | null;
    mastery_effective: number | null;
    provider: string;
  };
}

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
  excerpt: string;
}

interface Props {
  /** 当前活跃 concept ID（显式传入优先；否则消费 store 跳转目标） */
  conceptId?: number | null;
}

const MODE_LABELS: Record<TutorMode, string> = {
  explain: "Explain",
  hint: "Hint",
  review: "Review",
};

const MODE_DESCRIPTIONS: Record<TutorMode, string> = {
  explain: "Explain this concept clearly",
  hint: "Give me a hint, don't tell the answer",
  review: "Add to review queue",
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

  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<TutorMode>("explain");
  const [answer, setAnswer] = useState<TutorAnswer | null>(null);
  const [context, setContext] = useState<TutorContextData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 笔记引用（P8-003D：用户显式选择，≤2 篇）
  const [selectedNotes, setSelectedNotes] = useState<TutorNoteRef[]>([]);
  const [noteSearch, setNoteSearch] = useState("");
  const [noteResults, setNoteResults] = useState<Array<{ note_id: number; title: string }>>([]);
  const [showNotePicker, setShowNotePicker] = useState(false);

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

  /** 提交问题 */
  const handleSubmit = useCallback(async () => {
    if (!conceptId || !query.trim()) return;
    setLoading(true);
    setError("");
    try {
      const data = await apiPost<TutorAnswer>("/tutor/test", {
        concept_id: conceptId,
        query: query.trim(),
        mode,
      });
      setAnswer(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [conceptId, query, mode]);

  /** 无 concept 选中 */
  if (conceptId == null) {
    return (
      <div className="tutor-panel">
        <div className="tutor-header">Tutor</div>
        <div className="tutor-empty">Select a concept to start</div>
      </div>
    );
  }

  return (
    <div className="tutor-panel">
      <div className="tutor-header">Tutor</div>

      {/* Concept Info */}
      {context?.concept && (
        <div className="tutor-section">
          <div className="tutor-section-title">Concept</div>
          <div className="tutor-concept-name">{context.concept.title}</div>
        </div>
      )}

      {/* Mastery */}
      {context?.mastery && (
        <div className="tutor-section">
          <div className="tutor-section-title">Mastery</div>
          <MasteryBar label="Knowledge" value={context.mastery.knowledge} />
          <MasteryBar label="Practice" value={context.mastery.practice} />
          <MasteryBar label="Recall" value={context.mastery.recall} />
          <MasteryBar label="Transfer" value={context.mastery.transfer} />
        </div>
      )}

      {/* Weakness */}
      {context?.mistakes && context.mistakes.length > 0 && (
        <div className="tutor-section">
          <div className="tutor-section-title">Past Mistakes</div>
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
          <div className="tutor-section-title">Related</div>
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
          Notes
          <button
            className="tutor-note-toggle"
            onClick={() => setShowNotePicker((v) => !v)}
          >
            {showNotePicker ? "Close" : "Reference notes"}
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
                  aria-label={`remove ${n.title}`}
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
              placeholder="Search notes to reference"
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
        <div className="tutor-section-title">Action</div>
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
          <button
            className="tutor-ask-btn"
            onClick={() => void handleSubmit()}
            disabled={loading || !query.trim()}
          >
            {loading ? "..." : "Ask"}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && <div className="tutor-error">{error}</div>}

      {/* Answer */}
      {answer && (
        <div className="tutor-section">
          <div className="tutor-section-title">
            {MODE_LABELS[mode as TutorMode] ?? "Response"}
          </div>
          <div className="tutor-answer">{answer.answer}</div>
        </div>
      )}
    </div>
  );
}
