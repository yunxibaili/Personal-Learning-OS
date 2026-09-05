import { useEffect, useState, type ReactNode } from "react";
import { ApiError } from "../../api/client";
import { listConcepts, type ConceptSummary } from "../../api/concepts";
import { listNotes, type NoteSummary } from "../../api/notes";
import { postTutorContext, type TutorContext } from "../../api/tutor";

// MVP-06：最小 Tutor Context Consumer（ADR-029 §8 第 6 项）。
// 概念选择（/concepts active）+ 可选笔记引用（≤2，来自 /notes）+ auto_notes 开关
// （默认关）→ POST /tutor/context → 9 个 section 结构化展示。
// 零 AI 调用（/tutor/test、/chat、query、mode 均不做）；上下文全部为后端投影，
// 前端不拼接学习语义（L1）。双模型不进入本轮。

const MAX_NOTES = 2;

type FetchState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "done"; context: TutorContext }
  | { kind: "error"; message: string };

function errText(e: unknown): string {
  return e instanceof ApiError ? `${e.status} ${e.code}: ${e.message}` : String(e);
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="tutor-section">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

function Empty() {
  return <span className="state-empty">无</span>;
}

export default function TutorView() {
  const [concepts, setConcepts] = useState<ConceptSummary[]>([]);
  const [notes, setNotes] = useState<NoteSummary[]>([]);
  const [conceptId, setConceptId] = useState<number | null>(null);
  const [selectedNoteIds, setSelectedNoteIds] = useState<number[]>([]);
  const [autoNotes, setAutoNotes] = useState(false);
  const [state, setState] = useState<FetchState>({ kind: "idle" });
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listConcepts({ status: "active", limit: 100, offset: 0 }), listNotes()])
      .then(([cs, ns]) => {
        setConcepts(cs);
        setNotes(ns);
      })
      .catch((e: unknown) => setLoadError(errText(e)));
  }, []);

  function toggleNote(noteId: number) {
    setSelectedNoteIds((prev) => {
      if (prev.includes(noteId)) return prev.filter((id) => id !== noteId);
      if (prev.length >= MAX_NOTES) return prev; // 后端契约 ≤2，UI 到顶禁选
      return [...prev, noteId];
    });
  }

  async function fetchContext() {
    if (conceptId === null || state.kind === "loading") return;
    setState({ kind: "loading" });
    try {
      const context = await postTutorContext({
        concept_id: conceptId,
        note_ids: selectedNoteIds,
        auto_notes: autoNotes,
      });
      setState({ kind: "done", context });
    } catch (e) {
      setState({ kind: "error", message: errText(e) });
    }
  }

  const ctx = state.kind === "done" ? state.context : null;

  return (
    <div className="tutor-layout">
      <section className="tutor-controls">
        <h2>Tutor 上下文</h2>
        {loadError !== null && <p className="state-error">基础数据加载失败：{loadError}</p>}
        <div className="tutor-form">
          <label>
            概念：
            <select
              value={conceptId ?? ""}
              onChange={(e) => {
                setConceptId(e.target.value === "" ? null : Number(e.target.value));
                setState({ kind: "idle" });
              }}
            >
              <option value="">选择概念…</option>
              {concepts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="tutor-notes-picker">
            <legend>
              引用笔记（≤{MAX_NOTES}，已选 {selectedNoteIds.length}）
            </legend>
            {notes.length === 0 && <span className="state-empty">无笔记可选</span>}
            {notes.map((n) => {
              const checked = selectedNoteIds.includes(n.id);
              const disabled = !checked && selectedNoteIds.length >= MAX_NOTES;
              return (
                <label key={n.id} className={disabled ? "disabled" : ""}>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => toggleNote(n.id)}
                  />
                  {n.title}
                </label>
              );
            })}
          </fieldset>
          <label className="stub-toggle">
            <input
              type="checkbox"
              checked={autoNotes}
              onChange={(e) => setAutoNotes(e.target.checked)}
            />
            自动检索相关笔记（auto_notes）
          </label>
          <button
            type="button"
            onClick={fetchContext}
            disabled={conceptId === null || state.kind === "loading"}
          >
            {state.kind === "loading" ? "获取中…" : "获取上下文"}
          </button>
        </div>
      </section>

      {state.kind === "error" && (
        <p className="state-error">上下文获取失败：{state.message}</p>
      )}
      {ctx !== null && (
        <section className="tutor-context">
          <Section title="概念">
            {ctx.concept.title}（id {ctx.concept.id}）
          </Section>
          <Section title="掌握度">
            effective {ctx.mastery.effective}（knowledge {ctx.mastery.knowledge} · practice{" "}
            {ctx.mastery.practice} · recall {ctx.mastery.recall} · transfer{" "}
            {ctx.mastery.transfer}）
          </Section>
          <Section title="错误本">
            {ctx.mistakes.length === 0 ? (
              <Empty />
            ) : (
              <ul>
                {ctx.mistakes.map((m) => (
                  <li key={m.id}>
                    {m.description}（{m.occurred_at}）
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section title="关联概念">
            {ctx.related.length === 0 ? (
              <Empty />
            ) : (
              <ul>
                {ctx.related.map((r) => (
                  <li key={r.id}>
                    {r.title}（{r.relation}）
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section title="复习状态">
            {ctx.review === null ? (
              <Empty />
            ) : (
              <>
                next_review {ctx.review.next_review} · priority {ctx.review.priority} · 上次{" "}
                {ctx.review.last_result ?? "—"}
              </>
            )}
          </Section>
          <Section title="近期事件">
            {ctx.recent_events.length === 0 ? (
              <Empty />
            ) : (
              <ul>
                {ctx.recent_events.map((e, i) => (
                  <li key={i}>
                    {e.event_type}（{e.source}）· {e.created_at}
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section title="引用笔记">
            {ctx.notes.length === 0 ? (
              <Empty />
            ) : (
              <ul>
                {ctx.notes.map((n) => (
                  <li key={n.note_id}>
                    <strong>{n.title}</strong>：{n.excerpt}
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section title="记忆">
            {ctx.memories.length === 0 ? (
              <Empty />
            ) : (
              <ul>
                {ctx.memories.map((m, i) => (
                  <li key={i}>
                    [{m.kind}] {m.content}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </section>
      )}
      {state.kind === "idle" && (
        <p className="state-empty">选择概念后点击「获取上下文」。</p>
      )}
    </div>
  );
}
