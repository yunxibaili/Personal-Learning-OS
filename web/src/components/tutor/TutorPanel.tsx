/**
 * TutorPanel（M4-D）：Context-aware Tutor 面板。
 *
 * ADR-013/016 约束：
 *   - Knowledge tool，not chatbot
 *   - 禁止：气泡、头像、打字动画、魔法按钮
 *   - 允许：context panel、structured answer、action suggestion
 */
import { useCallback, useState } from "react";
import { apiPost } from "../../lib/api";
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
}

interface Props {
  /** 当前活跃 concept ID（从 NoteEditor 或 Graph 传入） */
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

export function TutorPanel({ conceptId }: Props) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<TutorMode>("explain");
  const [answer, setAnswer] = useState<TutorAnswer | null>(null);
  const [context, setContext] = useState<TutorContextData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /** 加载 concept context */
  const loadContext = useCallback(async (cid: number) => {
    try {
      const { apiGet } = await import("../../lib/api");
      const data = await apiGet<TutorContextData>(`/tutor/context/${cid}`);
      setContext(data);
    } catch {
      setContext(null);
    }
  }, []);

  /** 当 conceptId 变化时加载 context */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  if (conceptId != null && context?.concept?.id !== conceptId && !loading) {
    void loadContext(conceptId);
  }

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
