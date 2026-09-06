/**
 * Workbench Shell — Phase 3A（ADR-031）。
 * 最小 Shell，以 6 条真实 Workflow 为验收标准（UI-WORKBENCH-IA §11 / 指令书 §0）。
 * 用户层不见 S0–S4；布局由动作派生（model.ts）。颜色全部走 design token。
 * 批注为内存态（持久化 = Phase 4 提案，ADR-031 §决策 5）。
 */
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Icon } from "../components/icons/Icon";
import { Button, IconButton } from "../components/ui/Button";
import { SearchField } from "../components/ui/SearchField";
import { listNotes, getNote, type NoteDetail, type NoteSummary } from "../api/notes";
import { searchNotes } from "../api/search";
import { listMastery, type MasteryEntry } from "../api/mastery";
import { presentError } from "../api/errors";
import {
  workbenchReducer, initialWorkbench, objectKey, enforceMutualExclusion,
  type WorkObject, type WorkbenchState, type ObjectId,
} from "./model";

/* ── 数据 hook：笔记清单 + 掌握度 ─────────────────────────── */
function useNotes() {
  const [notes, setNotes] = useState<NoteSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    listNotes().then(setNotes).catch((e) => setError(presentError(e)));
  }, []);
  return { notes, error };
}

function useMastery() {
  const [mastery, setMastery] = useState<MasteryEntry[] | null>(null);
  useEffect(() => {
    listMastery().then(setMastery).catch(() => setMastery([]));
  }, []);
  return mastery;
}

/* ── NoteReader：[[链接]] 可点，选区出批注气泡 ────────────── */
function NoteReader({ note, onLink, onAnnotate }: {
  note: NoteDetail;
  onLink: (title: string, el: HTMLElement) => void;
  onAnnotate: (quote: string) => void;
}) {
  const parts = useMemo(() => {
    const out: Array<{ t: "text" | "link"; v: string }> = [];
    const re = /\[\[([^\]]+)\]\]/g;
    let last = 0;
    for (const m of note.content_md.matchAll(re)) {
      if (m.index > last) out.push({ t: "text", v: note.content_md.slice(last, m.index) });
      out.push({ t: "link", v: m[1] });
      last = m.index + m[0].length;
    }
    if (last < note.content_md.length) out.push({ t: "text", v: note.content_md.slice(last) });
    return out;
  }, [note.content_md]);

  const [bubble, setBubble] = useState<{ x: number; y: number; quote: string } | null>(null);
  const onMouseUp = () => {
    const sel = window.getSelection();
    const text = sel?.toString().trim() ?? "";
    if (sel && text.length > 1 && !sel.isCollapsed) {
      const range = sel.getRangeAt(0).getBoundingClientRect();
      setBubble({ x: range.left + range.width / 2, y: range.bottom + 6, quote: text.slice(0, 200) });
    } else {
      setBubble(null);
    }
  };

  return (
    <div className="wb-reader" onMouseUp={onMouseUp}>
      <h1>{note.title}</h1>
      {parts.map((p, i) =>
        p.t === "text" ? (
          p.v.split("\n").map((line, j) =>
            line.trim() ? <p key={`${i}-${j}`}>{line}</p> : null,
          )
        ) : (
          <button key={i} type="button" className="wb-link" onClick={(e) => onLink(p.v, e.currentTarget)}>{p.v}</button>
        ),
      )}
      {bubble && (
        <div className="wb-bubble" style={{ left: bubble.x, top: bubble.y }}>
          <Button size="sm" prominence="plain" onClick={() => { onAnnotate(bubble.quote); setBubble(null); }}>标注</Button>
          <Button size="sm" prominence="plain" onClick={() => { navigator.clipboard?.writeText(bubble.quote); setBubble(null); }}>复制</Button>
        </div>
      )}
    </div>
  );
}

/* ── Context Pane：跟当前对象的学习关系（Standard 密度）────── */
function ContextPane({ state, notes, mastery, onOpen, onAnnotateNote, onCloseAnn }: {
  state: WorkbenchState;
  notes: NoteSummary[] | null;
  mastery: MasteryEntry[] | null;
  onOpen: (obj: WorkObject) => void;
  onAnnotateNote: (id: string, note: string) => void;
  onCloseAnn: (id: string) => void;
}) {
  const active = state.tabs.find((t) => t.key === state.activeKey);
  if (!active) return <aside className="wb__pane"><p className="t-callout">打开一个对象后，这里显示它与你的学习关系。</p></aside>;

  const title = active.title;
  const linked = (mastery ?? []).filter((m) => title.includes(m.title));
  const anns = state.annotations.filter((a) => a.objKey === active.key);

  return (
    <aside className="wb__pane" aria-label="Context">
      <div className="wb-ctx__section">
        <h3>当前对象</h3>
        <div className="t-body-ui" style={{ fontWeight: 600 }}>{title}</div>
        {active.obj.kind === "note" && <p className="t-caption" style={{ margin: 0 }}>note · id {active.obj.id}</p>}
      </div>

      {active.obj.kind === "note" && (
        <div className="wb-ctx__section">
          <h3>提到的概念 · 掌握度</h3>
          {linked.length === 0 && <p className="t-callout">未匹配到概念（可从 [[链接]] 建立关联）。</p>}
          <div className="wb-ctx__mastery">
            {linked.slice(0, 6).map((m) => (
              <div key={m.concept_id} className="wb-ctx__bar">
                <div>
                  <div className="t-caption">{m.title}</div>
                  <div className="wb-ctx__bar-track"><div className="wb-ctx__bar-fill" style={{ width: `${Math.round(m.effective_now * 100)}%` }} /></div>
                </div>
                <span className="t-caption">{Math.round(m.effective_now * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="wb-ctx__section">
        <h3>批注（内存态 · Phase 4 持久化）</h3>
        {anns.length === 0 && <p className="t-callout">选中正文文字即可标注。</p>}
        {anns.map((a) => (
          <div key={a.id} className="wb-ann">
            <div className="t-caption" style={{ marginBottom: 4 }}>“{a.quote}”</div>
            <textarea
              value={a.note}
              placeholder="为什么重要？"
              onChange={(e) => onAnnotateNote(a.id, e.target.value)}
            />
            <button type="button" className="t-caption" style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--color-text-tertiary)", padding: 0 }} onClick={() => onCloseAnn(a.id)}>删除</button>
          </div>
        ))}
      </div>

      <div className="wb-ctx__section">
        <h3>学习动作</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-xs)" }}>
          <Button size="sm" icon="tutor" onClick={() => onOpen({ key: "tutor", obj: { kind: "tutor" }, title: "Tutor" })}>问 Tutor</Button>
          {active.obj.kind !== "review" && (
            <Button size="sm" prominence="plain" onClick={() => onOpen({ key: "review", obj: { kind: "review" }, title: "Review" })}>进入复习</Button>
          )}
        </div>
      </div>

      <div className="wb-ctx__section">
        <h3>相关笔记</h3>
        {(notes ?? []).slice(0, 4).map((n) => (
          <button key={n.id} type="button" className="wb-explorer__item" onClick={() => onOpen({ key: objectKey({ kind: "note", id: n.id }), obj: { kind: "note", id: n.id }, title: n.title })}>
            {n.title}
          </button>
        ))}
      </div>
    </aside>
  );
}

/* ── CommandPalette：L1 全局（↑↓ 预览不替换阅读）──────────── */
function CommandPalette({ notes, onClose, onOpen, onOpenRight }: {
  notes: NoteSummary[];
  onClose: () => void;
  onOpen: (obj: WorkObject) => void;
  onOpenRight: (obj: WorkObject) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Array<{ note_id: number; title: string }>>([]);
  const [sel, setSel] = useState(0);
  const [preview, setPreview] = useState<NoteDetail | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    if (!q.trim()) { setResults(notes.slice(0, 6).map((n) => ({ note_id: n.id, title: n.title }))); return; }
    const t = window.setTimeout(() => {
      searchNotes(q).then((r) => setResults(r)).catch(() => setResults([]));
    }, 200);
    return () => window.clearTimeout(t);
  }, [q, notes]);
  useEffect(() => {
    const r = results[sel];
    if (!r) { setPreview(null); return; }
    let alive = true;
    getNote(r.note_id).then((n) => { if (alive) setPreview(n); }).catch(() => { if (alive) setPreview(null); });
    return () => { alive = false; };
  }, [sel, results]);

  const openSel = (right: boolean) => {
    const r = results[sel];
    if (!r) return;
    const obj: WorkObject = { key: objectKey({ kind: "note", id: r.note_id }), obj: { kind: "note", id: r.note_id }, title: r.title };
    right ? onOpenRight(obj) : onOpen(obj);
    onClose();
  };

  return (
    <>
      <div className="wb-palette-scrim" onClick={onClose} />
      <div className="wb-palette" role="dialog" aria-label="全局搜索">
        <div className="wb-palette__input-wrap">
          <Icon name="search" size={18} />
          <input
            ref={inputRef}
            className="wb-palette__input"
            placeholder="搜索全部笔记…（↑↓ 预览 · Enter 打开 · ⇧Enter 右侧打开 · Esc）"
            value={q}
            onChange={(e) => { setQ(e.target.value); setSel(0); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, results.length - 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
              if (e.key === "Enter") { e.preventDefault(); openSel(e.shiftKey); }
              if (e.key === "Escape") onClose();
            }}
          />
          <kbd className="search__hint">Esc</kbd>
        </div>
        <div className="wb-palette__list" role="listbox">
          {results.map((r, i) => (
            <button
              key={r.note_id}
              type="button"
              role="option"
              aria-selected={i === sel}
              className="wb-palette__item"
              onMouseEnter={() => setSel(i)}
              onClick={(e) => { openSel(e.shiftKey); }}
            >
              {r.title}
            </button>
          ))}
          {results.length === 0 && <div className="wb-palette__empty t-callout">无结果</div>}
        </div>
        <div className="wb-palette__preview">
          {preview ? (
            <>
              <div className="t-caption" style={{ marginBottom: 8 }}>预览 · 不会替换当前阅读</div>
              <div className="t-body-ui" style={{ fontWeight: 600, marginBottom: 8 }}>{preview.title}</div>
              <div className="t-callout" style={{ whiteSpace: "pre-wrap" }}>{preview.content_md.slice(0, 480) || "（空笔记）"}</div>
            </>
          ) : (
            <div className="wb-palette__empty t-callout">↑↓ 选择以预览</div>
          )}
        </div>
      </div>
    </>
  );
}

/* ── Work Surface：对象渲染器 ─────────────────────────────── */
function WorkSurfaceObject({ obj, onLink, onAnnotate }: { obj: ObjectId; onLink: (title: string, el: HTMLElement) => void; onAnnotate?: (quote: string) => void }) {
  const [detail, setDetail] = useState<NoteDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (obj.kind !== "note") return;
    let alive = true;
    setDetail(null);
    getNote(obj.id).then((n) => { if (alive) setDetail(n); }).catch((e) => { if (alive) setError(presentError(e)); });
    return () => { alive = false; };
  }, [obj]);

  if (obj.kind === "review") return <ReviewSlot />;
  if (obj.kind === "tutor") return <TutorSlot />;
  if (error) return <div className="wb-empty"><p className="t-callout">{error}</p></div>;
  if (!detail) return <div className="wb-empty"><p className="t-callout">加载中…</p></div>;
  return <NoteReader note={detail} onLink={onLink} onAnnotate={onAnnotate ?? (() => {})} />;
}

function ReviewSlot() {
  const [ReviewView, setReviewView] = useState<React.ComponentType | null>(null);
  useEffect(() => {
    import("../features/review/ReviewView").then((m) => setReviewView(() => m.default));
  }, []);
  return ReviewView ? <ReviewView /> : <div className="wb-empty"><p className="t-callout">加载复习…</p></div>;
}

function TutorSlot() {
  const [TutorView, setTutorView] = useState<React.ComponentType | null>(null);
  useEffect(() => {
    import("../features/tutor/TutorView").then((m) => setTutorView(() => m.default));
  }, []);
  return TutorView ? <TutorView /> : <div className="wb-empty"><p className="t-callout">加载 Tutor…</p></div>;
}

/* ── Workbench Shell ─────────────────────────────────────── */
export default function Workbench() {
  const [rawState, dispatch] = useReducer(workbenchReducer, initialWorkbench);
  const { notes, error } = useNotes();
  const mastery = useMastery();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const state = enforceMutualExclusion(rawState, narrow);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1440px)");
    const apply = () => setNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // 首个对象：打开第一篇笔记（真实数据）
  useEffect(() => {
    if (notes && notes.length > 0 && state.tabs.length === 0) {
      const n = notes[0];
      dispatch({ type: "open", object: { key: objectKey({ kind: "note", id: n.id }), obj: { kind: "note", id: n.id }, title: n.title } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes]);

  // ⌘K / Ctrl+K 全局
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const open = useCallback((obj: WorkObject) => dispatch({ type: "open", object: obj }), []);
  const openRight = useCallback((obj: WorkObject) => dispatch({ type: "openRight", object: obj }), []);

  // [[链接]] 解析：同名笔记 → Peek；否则提示不创建（3A 不写数据）
  const [peek, setPeek] = useState<{ title: string; x: number; y: number; obj: WorkObject | null } | null>(null);
  const onLink = useCallback((title: string, el: HTMLElement) => {
    const found = (notes ?? []).find((n) => n.title === title);
    const rect = el.getBoundingClientRect();
    const obj: WorkObject | null = found
      ? { key: objectKey({ kind: "note", id: found.id }), obj: { kind: "note", id: found.id }, title: found.title }
      : null;
    setPeek({ title, x: rect.left, y: rect.bottom + 6, obj });
  }, [notes]);

  const active = state.tabs.find((t) => t.key === state.activeKey);
  const side = state.side;

  return (
    <div className="wb" data-layout={state.layout}>
      {/* Rail */}
      <nav className="wb__rail" aria-label="Activity Rail">
        <IconButton icon="notes" label="笔记（开关 Explorer）" className={state.explorerOpen ? "is-active" : ""} onClick={() => dispatch({ type: "toggleExplorer" })} />
        <IconButton icon="search" label="全局搜索 ⌘K" onClick={() => setPaletteOpen(true)} />
        <IconButton icon="review" label="复习（进入专注）" className={active?.obj.kind === "review" ? "is-active" : ""} onClick={() => { const o = { key: "review", obj: { kind: "review" } as const, title: "Review" }; open(o); dispatch({ type: "enterFocus" }); }} />
        <IconButton icon="tutor" label="Tutor" className={active?.obj.kind === "tutor" ? "is-active" : ""} onClick={() => open({ key: "tutor", obj: { kind: "tutor" }, title: "Tutor" })} />
        <span className="wb__rail__spacer" />
        <IconButton icon="settings" label="设置（Phase 4）" disabled />
      </nav>

      {/* Explorer（S1/S2，非常驻） */}
      {state.explorerOpen && (
        <aside className="wb__pane" aria-label="Explorer">
          <ExplorerPane notes={notes} error={error} activeKey={state.activeKey} onOpen={open} onOpenRight={openRight} />
        </aside>
      )}

      {/* Work Surface（primary + tabs） */}
      <main className="wb__pane wb__pane--surface" aria-label="Work Surface">
        {state.tabs.length > 0 && (
          <div className="wb__tabs" role="tablist" aria-label="打开的工作对象">
            {state.tabs.map((t) => (
              <span key={t.key} style={{ display: "inline-flex" }}>
                <button
                  type="button"
                  role="tab"
                  className="wb__tab"
                  aria-current={t.key === state.activeKey}
                  onClick={() => dispatch({ type: "activate", key: t.key })}
                >
                  {t.title}
                </button>
                <button type="button" className="wb__tab__close" aria-label={`关闭 ${t.title}`} onClick={() => dispatch({ type: "closeTab", key: t.key })}>
                  <Icon name="close" size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
        {active ? (
          <div style={{ position: "relative" }}>
            <div style={{ display: "flex", gap: "var(--space-xs)", marginBottom: "var(--space-sm)" }}>
              <IconButton
                icon="graph"
                label={state.contextOpen ? "收起 Context" : "打开 Context"}
                className={state.contextOpen ? "is-active" : ""}
                onClick={() => dispatch({ type: "toggleContext" })}
              />
              {active.obj.kind === "review" && state.layout !== "S4" && (
                <Button size="sm" prominence="prominent" onClick={() => dispatch({ type: "enterFocus" })}>进入专注</Button>
              )}
              {state.layout === "S4" && (
                <Button size="sm" onClick={() => dispatch({ type: "exitFocus" })}>退出专注</Button>
              )}
            </div>
            <WorkSurfaceObject
              obj={active.obj}
              onLink={onLink}
              onAnnotate={(quote) => dispatch({ type: "addAnnotation", quote, note: "", objKey: active.key })}
            />
          </div>
        ) : (
          <div className="wb-empty">
            <p className="t-callout">从左侧选择一篇笔记开始。</p>
          </div>
        )}
      </main>

      {/* Compare 右槽（S3，天然 locked） */}
      {side && (
        <section className="wb__side" aria-label="并置对象">
          <span className="wb__gap">
            <IconButton icon="forward" label="交换为主对象" onClick={() => { const s = side; dispatch({ type: "closeSide" }); open(s); }} />
            <IconButton icon="close" label="关闭并置" onClick={() => dispatch({ type: "closeSide" })} />
          </span>
          <div className="wb__side__bar">
            <span className="t-caption">并置 · {side.title}</span>
            <Button size="sm" prominence="plain" onClick={() => {
              // 3A 演示：Link 写入内存内容（不落盘），诚实标注
              window.dispatchEvent(new CustomEvent("wb-demo-link", { detail: side.title }));
            }}>Link</Button>
          </div>
          <div style={{ overflow: "auto" }}>
            <WorkSurfaceObject obj={side.obj} onLink={() => { /* 副对象内链接 3A 不展开 */ }} />
          </div>
        </section>
      )}

      {/* Context（S2 起，非常驻） */}
      {state.contextOpen && (
        <ContextPane
          state={state}
          notes={notes}
          mastery={mastery}
          onOpen={open}
          onAnnotateNote={(id, note) => dispatch({ type: "updateAnnotation", id, note })}
          onCloseAnn={(id) => dispatch({ type: "removeAnnotation", id })}
        />
      )}

      {/* Peek */}
      {peek && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 999 }} onClick={() => setPeek(null)} />
          <div className="wb-peek" style={{ left: peek.x, top: peek.y }} role="dialog" aria-label={`Peek ${peek.title}`}>
            <div className="t-body-ui" style={{ fontWeight: 600, marginBottom: 4 }}>{peek.title}</div>
            {peek.obj ? (
              <>
                <p className="t-callout" style={{ margin: "0 0 var(--space-sm)" }}>
                  {mastery?.find((m) => peek.title.includes(m.title))
                    ? `掌握度 ${Math.round((mastery.find((m) => peek.title.includes(m.title))!.effective_now) * 100)}%`
                    : "未建立掌握度记录"}
                </p>
                <div style={{ display: "flex", gap: "var(--space-xs)", flexWrap: "wrap" }}>
                  <Button size="sm" prominence="prominent" onClick={() => { if (peek.obj) open(peek.obj); setPeek(null); }}>打开</Button>
                  <Button size="sm" onClick={() => { if (peek.obj) openRight(peek.obj); setPeek(null); }}>在右侧打开</Button>
                </div>
              </>
            ) : (
              <p className="t-callout" style={{ margin: 0 }}>没有同名笔记。3A 不创建新对象。</p>
            )}
          </div>
        </>
      )}

      {paletteOpen && (
        <CommandPalette
          notes={notes ?? []}
          onClose={() => setPaletteOpen(false)}
          onOpen={open}
          onOpenRight={openRight}
        />
      )}
    </div>
  );
}

/* Explorer（动态分区精简版：Current 由 tabs 表达，这里为全量+过滤） */
function ExplorerPane({ notes, error, activeKey, onOpen, onOpenRight }: {
  notes: NoteSummary[] | null;
  error: string | null;
  activeKey: string;
  onOpen: (obj: WorkObject) => void;
  onOpenRight: (obj: WorkObject) => void;
}) {
  const [q, setQ] = useState("");
  const filtered = (notes ?? []).filter((n) => n.title.toLowerCase().includes(q.toLowerCase()));
  return (
    <aside className="wb__pane" aria-label="Explorer">
      <div className="wb-explorer__search">
        <SearchField placeholder="在当前工作集中搜索…" shortcutHint="" value={q} onValueChange={setQ} aria-label="工作集过滤" />
      </div>
      {error && <p className="t-callout">{error}</p>}
      <div className="wb-explorer__list">
        {filtered.map((n) => {
          const key = objectKey({ kind: "note", id: n.id });
          return (
            <button
              key={n.id}
              type="button"
              className="wb-explorer__item"
              aria-current={key === activeKey}
              onClick={() => onOpen({ key, obj: { kind: "note", id: n.id }, title: n.title })}
              onAuxClick={(e) => { if (e.button === 1) onOpenRight({ key, obj: { kind: "note", id: n.id }, title: n.title }); }}
              title="点击打开 · 中键在右侧打开"
            >
              {n.title}
            </button>
          );
        })}
        {filtered.length === 0 && !error && <p className="t-callout">没有匹配的笔记。</p>}
      </div>
    </aside>
  );
}
