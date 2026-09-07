/**
 * Workbench Shell — Phase 3R release hardening（ADR-031）。
 * 原则：One object in focus. Everything else stays close, contextual, and reversible.
 * 用户层不见 S0–S4；布局由动作派生（model.ts）。颜色全部走 design token。
 * 批注为内存态（持久化 = Phase 4 提案，ADR-031）。
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from "react";
import { computeLayout } from "./layout";
import { buildContextModel, type ContextModel } from "./contextModel";
import { Icon } from "../components/icons/Icon";
import { Button, IconButton } from "../components/ui/Button";
import { SearchField } from "../components/ui/SearchField";
import { Button as IOS27Button } from "../components/ios27/Button";
import { SegmentedControl as IOS27Segmented } from "../components/ios27/SegmentedControl";
import "../components/ios27/tokens-bridge.css";
import "../components/ios27/materials.css";
import "../components/ios27/Button.css";
import "../components/ios27/SegmentedControl.css";
import { listNotes, getNote, type NoteDetail, type NoteSummary } from "../api/notes";
import { searchNotes } from "../api/search";
import { listMastery, listWeakConcepts, type MasteryEntry } from "../api/mastery";
import { getBacklinks, type BacklinkRef } from "../api/notes";
import { getConceptRelatedNotes, type RelatedNote } from "../api/concepts";
import { presentError } from "../api/errors";
import {
  workbenchReducer, initialWorkbench, objectKey, enforceMutualExclusion,
  type WorkObject, type WorkbenchState, type ObjectId,
} from "./model";
import "./workbench.css";
import { WorkState } from "./states";

/* ── 状态组件（Empty/Loading/Error，指令书 §21）────────────── */
/* ── 迷你 Markdown 渲染（阅读环境最小集）────────────────────── */
import { NoteReader } from "./NoteReader";

/* ── Context v2（3C-2）：伴随当前 Work Object 的第二层信息，不是 card column ──
 * 视觉权重递减：Work Object → Primary context → Secondary context → Controls → Meta → Ambient。
 * 验收：不得形成独立 Card Column；项=排版行 + hairline，无背景/圆角卡片。
 */
type Density = "minimal" | "standard" | "research";

function ContextRow({
  primary, secondary, meta, onClick,
}: { primary: string; secondary?: string; meta?: string; onClick?: () => void }) {
  return (
    <button type="button" className="wb-ctx__row" onClick={onClick}>
      <span className="wb-ctx__row-primary">{primary}</span>
      {secondary && <span className="wb-ctx__row-secondary">{secondary}</span>}
      {meta && <span className="wb-ctx__row-meta">{meta}</span>}
    </button>
  );
}

function ContextPane({
  state, model, density, onOpen, onAnnotateNote, onCloseAnn, onClose, loading, recomposeKey,
}: {
  state: WorkbenchState;
  model: ContextModel | null;
  density: Density;
  onOpen: (obj: WorkObject) => void;
  onAnnotateNote: (id: string, note: string) => void;
  onCloseAnn: (id: string) => void;
  onClose: () => void;
  loading: boolean;
  recomposeKey: string;
}) {
  const active = state.tabs.find((t) => t.key === state.activeKey);
  const anns = state.annotations.filter((a) => a.objKey === active?.key);
  const openNote = (id: number, title: string) => onOpen({ key: objectKey({ kind: "note", id }), obj: { kind: "note", id }, title });

  return (
    <aside className="wb__pane wb__pane--context wb-ctx" data-density={density} aria-label="Context">
      <div className="wb-ctx__head">
        <span className="t-caption">Context</span>
        <IconButton icon="close" label="收起 Context" onClick={onClose} style={{ width: 24, height: 24 }} />
      </div>

      {loading ? <WorkState kind="loading" title="加载中…" /> : !active ? (
        <WorkState kind="empty" title="没有焦点对象" hint="打开一个对象后，这里显示它与你的学习关系。" />
      ) : (
        /* recomposition：焦点对象变化时整层重组（不是追加面板） */
        <div className="wb-ctx__body" key={recomposeKey}>
          {/* Current：Work Object 本身 */}
          <div className="wb-ctx__section wb-ctx__section--current">
            <div className="wb-ctx__current">{active.title}</div>
            {model?.currentConcept ? (
              <div className="wb-ctx__row-secondary">当前概念 · {model.currentConcept.title}</div>
            ) : (
              <div className="wb-ctx__row-meta">尚未建立概念关联</div>
            )}
          </div>

          {/* Mastery（默认） */}
          {model?.currentConcept && (
            <div className="wb-ctx__section">
              <h3>掌握度</h3>
              <div className="wb-ctx__bar">
                <div className="wb-ctx__bar-track"><div className="wb-ctx__bar-fill" style={{ width: `${Math.round(model.currentConcept.effective_now * 100)}%` }} /></div>
                <span className="wb-ctx__row-meta">{Math.round(model.currentConcept.effective_now * 100)}%</span>
              </div>
            </div>
          )}

          {/* Related Concepts（Standard+） */}
          {density !== "minimal" && (model?.relatedConcepts.length ?? 0) > 0 && (
            <div className="wb-ctx__section">
              <h3>相关概念</h3>
              {model!.relatedConcepts.map((c) => (
                <ContextRow key={c.concept_id} primary={c.title} meta={`${Math.round(c.effective_now * 100)}%`} />
              ))}
            </div>
          )}

          {/* Prerequisites（Research；或 Standard 有数据时） */}
          {density === "research" && (model?.prerequisiteConcepts.length ?? 0) > 0 && (
            <div className="wb-ctx__section">
              <h3>前提</h3>
              {model!.prerequisiteConcepts.map((c) => (
                <ContextRow key={c.concept_id} primary={c.title} meta="推导" />
              ))}
            </div>
          )}

          {/* Backlinks（Standard+） */}
          {density !== "minimal" && (model?.backlinks.length ?? 0) > 0 && (
            <div className="wb-ctx__section">
              <h3>回链</h3>
              {model!.backlinks.map((b) => (
                <ContextRow key={b.note_id} primary={b.title} secondary={b.snippet} onClick={() => openNote(b.note_id, b.title)} />
              ))}
            </div>
          )}

          {/* Related notes（Standard+） */}
          {density !== "minimal" && (model?.relatedNotes.length ?? 0) > 0 && (
            <div className="wb-ctx__section">
              <h3>相关笔记</h3>
              {model!.relatedNotes.map((n) => (
                <ContextRow key={n.note_id} primary={n.title} secondary={n.reason} onClick={() => openNote(n.note_id, n.title)} />
              ))}
            </div>
          )}

          {/* Review Due（Standard+） */}
          {density !== "minimal" && (model?.reviewDue.length ?? 0) > 0 && (
            <div className="wb-ctx__section">
              <h3>复习到期</h3>
              {model!.reviewDue.map((r) => (
                <ContextRow key={r.concept_id} primary={r.title} meta={`${Math.round(r.effective_now * 100)}%`} onClick={() => onOpen({ key: "review", obj: { kind: "review" }, title: "Review" })} />
              ))}
            </div>
          )}

          {/* Annotations（Standard+） */}
          {density !== "minimal" && (
            <div className="wb-ctx__section">
              <h3>批注（内存态 · Phase 4 持久化）</h3>
              {anns.length === 0 ? (
                <p className="wb-ctx__row-meta" style={{ margin: 0 }}>选中正文文字即可标注。</p>
              ) : (
                anns.map((a) => (
                  <div key={a.id} className="wb-ann">
                    <div className="wb-ctx__row-secondary">“{a.quote}”</div>
                    <textarea value={a.note} placeholder="为什么重要？" onChange={(e) => onAnnotateNote(a.id, e.target.value)} />
                    <button type="button" className="wb-ctx__row-meta wb-ctx__link" onClick={() => onCloseAnn(a.id)}>删除</button>
                  </div>
                ))
              )}
            </div>
          )}

          {density === "research" && (
            <div className="wb-ctx__section">
              <h3>Sources</h3>
              <p className="wb-ctx__row-meta" style={{ margin: 0 }}>批注来源清单随 Paper 能力（Phase 4）接入。</p>
            </div>
          )}

          {/* Tutor（默认） */}
          <div className="wb-ctx__section">
            <h3>学习动作</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-xs)" }}>
              <Button size="sm" icon="tutor" onClick={() => onOpen({ key: "tutor", obj: { kind: "tutor" }, title: "Tutor" })}>问 Tutor</Button>
              {active.obj.kind !== "review" && (
                <Button size="sm" prominence="plain" onClick={() => onOpen({ key: "review", obj: { kind: "review" }, title: "Review" })}>进入复习</Button>
              )}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

/* ── CommandPalette：L1（↑↓ 预览不替换阅读；焦点还原）──────── */
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
  const [previewLoading, setPreviewLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastFocused = useRef<Element | null>(null);

  useEffect(() => {
    lastFocused.current = document.activeElement;
    inputRef.current?.focus();
    return () => { (lastFocused.current as HTMLElement | null)?.focus?.(); };
  }, []);

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
    setPreviewLoading(true);
    getNote(r.note_id).then((n) => { if (alive) { setPreview(n); setPreviewLoading(false); } }).catch(() => { if (alive) { setPreview(null); setPreviewLoading(false); } });
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
              key={r.note_id} type="button" role="option" aria-selected={i === sel}
              className="wb-palette__item"
              onMouseEnter={() => setSel(i)}
              onClick={(e) => openSel(e.shiftKey)}
            >
              {r.title}
            </button>
          ))}
          {results.length === 0 && <div className="wb-palette__empty"><WorkState kind="empty" title="无结果" hint="换个关键词试试。" /></div>}
        </div>
        <div className="wb-palette__preview">
          {previewLoading ? <WorkState kind="loading" title="加载预览…" />
            : preview ? (
              <>
                <div className="t-caption" style={{ marginBottom: 8 }}>预览 · 不会替换当前阅读</div>
                <div className="t-body-ui" style={{ fontWeight: 600, marginBottom: 8 }}>{preview.title}</div>
                <div className="t-callout" style={{ whiteSpace: "pre-wrap" }}>{preview.content_md.slice(0, 480) || "（空笔记）"}</div>
              </>
            ) : <div className="wb-palette__empty"><WorkState kind="empty" title="↑↓ 选择以预览" /></div>}
        </div>
      </div>
    </>
  );
}

/* ── Work Surface 对象渲染器（含状态）───────────────────────── */
function WorkSurfaceObject({ obj, onLink, onAnnotate }: { obj: ObjectId; onLink: (title: string, el: HTMLElement) => void; onAnnotate?: (quote: string) => void }) {
  const [detail, setDetail] = useState<NoteDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (obj.kind !== "note") return;
    let alive = true;
    setDetail(null); setError(null);
    getNote(obj.id).then((n) => { if (alive) setDetail(n); }).catch((e) => { if (alive) setError(presentError(e)); });
    return () => { alive = false; };
  }, [obj]);

  if (obj.kind === "review") return <ReviewSlot />;
  if (obj.kind === "tutor") return <TutorSlot />;
  if (error) return <div className="wb-empty"><WorkState kind="error" title="无法打开对象" hint={error} /></div>;
  if (!detail) return <div className="wb-empty"><WorkState kind="loading" title="加载中…" /></div>;
  if (!detail.content_md.trim()) return <div className="wb-empty"><WorkState kind="empty" title="空笔记" hint="写下第一段，或从 ⌘K 打开别的对象。" /></div>;
  return <NoteReader note={detail} onLink={onLink} onAnnotate={onAnnotate ?? (() => {})} />;
}

function ReviewSlot() {
  const [ReviewView, setReviewView] = useState<React.ComponentType | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    import("../features/review/ReviewView").then((m) => setReviewView(() => m.default)).catch(() => setErr(true));
  }, []);
  if (err) return <div className="wb-empty"><WorkState kind="error" title="复习模块加载失败" /></div>;
  return ReviewView ? <ReviewView /> : <div className="wb-empty"><WorkState kind="loading" title="加载复习…" /></div>;
}

function TutorSlot() {
  const [TutorView, setTutorView] = useState<React.ComponentType | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    import("../features/tutor/TutorView").then((m) => setTutorView(() => m.default)).catch(() => setErr(true));
  }, []);
  if (err) return <div className="wb-empty"><WorkState kind="error" title="Tutor 模块加载失败" /></div>;
  return TutorView ? <TutorView /> : <div className="wb-empty"><WorkState kind="loading" title="加载 Tutor…" /></div>;
}

/* ── Workbench Shell ─────────────────────────────────────── */
/* ── 数据 hook ───────────────────────────────────────────── */
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

export default function Workbench() {
  const [rawState, dispatch] = useReducer(workbenchReducer, initialWorkbench);
  const { notes, error } = useNotes();
  const mastery = useMastery();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const [density, setDensity] = useState<Density>("standard");
  const [scrolled, setScrolled] = useState(false);
  const [vw, setVw] = useState(() => (typeof window === "undefined" ? 1440 : window.innerWidth));
  const surfaceRef = useRef<HTMLElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLButtonElement>(null);
  const [indicator, setIndicator] = useState({ x: 0, w: 0, ready: false });
  // 3C-2 Context v2 数据源
  const [weak, setWeak] = useState<MasteryEntry[]>([]);
  const [noteContent, setNoteContent] = useState("");
  const [related, setRelated] = useState<RelatedNote[]>([]);
  const [backlinks, setBacklinks] = useState<BacklinkRef[]>([]);
  // 3C-3：五区模型 —— D Inspector（≥1440 属性栏）+ F Bottom Panel（Tutor/Review/Trace）
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [panel, setPanel] = useState<null | "tutor" | "review" | "trace">(null);
  const [panelHeight, setPanelHeight] = useState(320);
  const state = enforceMutualExclusion(rawState, narrow);
  const active = state.tabs.find((t) => t.key === state.activeKey);
  const side = state.side;

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1440px)");
    const apply = () => setNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    listWeakConcepts().then(setWeak).catch(() => setWeak([]));
  }, []);

  // 当前笔记正文（用于解析 [[链接]]）+ 回链
  const activeNoteId = active?.obj.kind === "note" ? active.obj.id : null;
  useEffect(() => {
    if (activeNoteId === null) { setNoteContent(""); setBacklinks([]); return; }
    let alive = true;
    getNote(activeNoteId).then((n) => { if (alive) setNoteContent(n.content_md); }).catch(() => { if (alive) setNoteContent(""); });
    getBacklinks(activeNoteId).then((b) => { if (alive) setBacklinks(b); }).catch(() => { if (alive) setBacklinks([]); });
    return () => { alive = false; };
  }, [activeNoteId]);


  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // 3C-1：布局引擎（D-01 修订）—— Work Surface 优先，Context/Explorer 可让位
  const plan = useMemo(
    () =>
      computeLayout({
        explorer: state.explorerOpen,
        context: state.contextOpen,
        compare: !!state.side,
        focus: state.layout === "S4",
        inspector: inspectorOpen,
        width: vw,
      }),
    [state.explorerOpen, state.contextOpen, state.side, state.layout, inspectorOpen, vw],
  );

  // 底部面板拖拽改高（200–680）
  function startPanelDrag(e: React.PointerEvent) {
    const startY = e.clientY;
    const startH = panelHeight;
    const onMove = (ev: PointerEvent) => {
      const next = startH + (startY - ev.clientY);
      setPanelHeight(Math.max(200, Math.min(680, Math.round(next))));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  // Inspector 数据：当前笔记元数据 + 批注数
  const noteMeta = useMemo(() => {
    const n = notes?.find((x) => active && active.obj.kind === "note" && x.id === (active.obj as { id: number }).id);
    return {
      tags: n?.tags?.join(" · ") ?? "",
      updated: n ? new Date(n.updated_at).toLocaleDateString("zh-CN") : "",
    };
  }, [notes, active]);
  const annCountForActive = state.annotations.filter((a) => a.objKey === active?.key).length;

  // 3C-2：Context 合成（companion data）
  const contextModel = useMemo<ContextModel | null>(() => {
    if (!active) return null;
    return buildContextModel({
      noteTitle: active.title,
      contentMd: noteContent,
      mastery: mastery ?? [],
      weakConcepts: weak,
      relatedNotes: related,
      backlinks,
      currentNoteId: activeNoteId ?? undefined,
      annotationCount: state.annotations.filter((a) => a.objKey === active.key).length,
    });
  }, [active, noteContent, mastery, weak, related, backlinks, activeNoteId, state.annotations]);

  // 相关笔记（按当前概念的邻接关系）
  useEffect(() => {
    if (!contextModel?.currentConcept) { setRelated([]); return; }
    let alive = true;
    getConceptRelatedNotes(contextModel.currentConcept.concept_id)
      .then((r) => { if (alive) setRelated(r); }).catch(() => { if (alive) setRelated([]); });
    return () => { alive = false; };
  }, [contextModel?.currentConcept?.concept_id]);
  // Tab Morph Indicator（3C-1）：选中态=持续存在的空间实体（支持 retarget）
  useLayoutEffect(() => {
    const move = () => {
      const tab = activeTabRef.current;
      if (!tab) return;
      setIndicator({ x: tab.offsetLeft, w: tab.offsetWidth, ready: true });
    };
    move();
    const ro = new ResizeObserver(move);
    if (tabsRef.current) ro.observe(tabsRef.current);
    return () => ro.disconnect();
  }, [state.activeKey, state.tabs.length, vw]);

  // 默认对象：跳过测试/未命名残留，选最近更新的真实笔记（[C] 启发式）
  useEffect(() => {
    if (notes && notes.length > 0 && state.tabs.length === 0) {
      const real = notes.filter((n) => !/^(未命名|BadPath|Untitled)/i.test(n.title.trim()));
      const pick = (real.length ? real : notes)
        .slice()
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
      if (pick) {
        dispatch({ type: "open", object: { key: objectKey({ kind: "note", id: pick.id }), obj: { kind: "note", id: pick.id }, title: pick.title } });
      } else {
        dispatch({ type: "toggleExplorer" }); // 无可选笔记 → 直接给 Explorer
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "i") { e.preventDefault(); setInspectorOpen((v) => !v); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") { e.preventDefault(); setPanel((cur) => (cur ? null : "tutor")); }
      if (e.key === "Escape" && panel) { setPanel(null); }

    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // [A] scroll edge：内容滚入浮层之下时，边缘效果与紧凑态出现（HIG Scroll Views）
  const onSurfaceScroll = useCallback((e: React.UIEvent<HTMLElement>) => {
    setScrolled(e.currentTarget.scrollTop > 8);
  }, []);

  const open = useCallback((obj: WorkObject) => { dispatch({ type: "open", object: obj }); if (surfaceRef.current) surfaceRef.current.scrollTop = 0; setScrolled(false); }, []);
  const openRight = useCallback((obj: WorkObject) => dispatch({ type: "openRight", object: obj }), []);

  const [peek, setPeek] = useState<{ title: string; x: number; y: number; obj: WorkObject | null } | null>(null);
  useEffect(() => {
    if (!peek) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPeek(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [peek]);

  const onLink = useCallback((title: string, el: HTMLElement) => {
    const found = (notes ?? []).find((n) => n.title === title);
    const rect = el.getBoundingClientRect();
    const obj: WorkObject | null = found
      ? { key: objectKey({ kind: "note", id: found.id }), obj: { kind: "note", id: found.id }, title: found.title }
      : null;
    setPeek({ title, x: rect.left, y: rect.bottom + 6, obj });
  }, [notes]);

  return (
    <div className="wb" data-layout={state.layout} data-scrolled={scrolled ? "true" : "false"} data-panel={panel ?? "none"}>
      {/* A. TopBar（全局，44px，玻璃） */}
      <header className="wb__topbar">
        <span className="wb__topbar__mark">OLOS</span>
        <span className="wb__topbar__title">{active?.title ?? "Learning Workbench"}</span>
        <span className="wb__topbar__spacer" />
        <IOS27Segmented
          segments={["极简", "标准", "研究"]}
          selected={(["minimal", "standard", "research"] as const).indexOf(density)}
          onChange={(i) => setDensity((["minimal", "standard", "research"] as const)[i])}
        />
        <IconButton icon="search" label="全局搜索 ⌘K" onClick={() => setPaletteOpen(true)} />
        <IconButton icon="settings" label="Inspector ⌘I" className={inspectorOpen ? "is-active" : ""} onClick={() => setInspectorOpen((v) => !v)} />
        <IconButton icon="tutor" label="底部面板 ⌘J" className={panel ? "is-active" : ""} onClick={() => setPanel((cur) => (cur ? null : "tutor"))} />
      </header>

      <div className="wb__main" style={{ gridTemplateColumns: plan.columns, gridTemplateAreas: plan.areas }}>
      <nav className="wb__rail" style={{ gridArea: "rail" }} aria-label="Activity Rail">
        <IconButton icon="notes" label="笔记（开关 Explorer）" className={state.explorerOpen ? "is-active" : ""} onClick={() => dispatch({ type: "toggleExplorer" })} />
        <IconButton icon="search" label="全局搜索 ⌘K" onClick={() => setPaletteOpen(true)} />
        <IconButton icon="review" label="复习（进入专注）" className={active?.obj.kind === "review" ? "is-active" : ""} onClick={() => { open({ key: "review", obj: { kind: "review" }, title: "Review" }); dispatch({ type: "enterFocus" }); }} />
        <IconButton icon="tutor" label="Tutor" className={active?.obj.kind === "tutor" ? "is-active" : ""} onClick={() => open({ key: "tutor", obj: { kind: "tutor" }, title: "Tutor" })} />
        <span className="wb__rail__spacer" />
      </nav>

      {state.explorerOpen && (
        <aside
          className={`wb__pane wb__pane--explorer${plan.explorerMode === "drawer" ? " wb__pane--drawer" : ""}`}
          style={{ gridArea: "explorer" }}
          aria-label="Explorer"
        >
          <ExplorerPane notes={notes} error={error} activeKey={state.activeKey} onOpen={open} onOpenRight={openRight} />
        </aside>
      )}

      <main
        ref={surfaceRef}
        className="wb__pane wb__pane--surface"
        style={{ gridArea: "surface" }}
        aria-label="Work Surface"
        onScroll={onSurfaceScroll}
      >
        <div className={`wb__header${scrolled ? " is-scrolled" : ""}`}>
          {/* leading：Explorer 开关（导航属于前缘，且始终可用 [A] HIG Toolbars） */}
          {/* leading：紧凑标题（Explorer 开合已在 Rail，避免重复控件） */}
          <div className="wb__header__lead">
            <span className="wb__header__title" aria-hidden={!scrolled}>{active?.title ?? ""}</span>
          </div>
          {/* center：tabs（含 morph indicator） */}
          <div className="wb__tabs" role="tablist" aria-label="打开的工作对象" ref={tabsRef} style={{ position: "relative" }}>
            <span
              className="wb__tabs__indicator"
              aria-hidden="true"
              style={{ transform: `translateX(${indicator.x}px)`, width: indicator.w, opacity: indicator.ready && state.tabs.length > 0 ? 1 : 0 }}
            />
            {state.tabs.map((t) => (
              <span key={t.key} style={{ display: "inline-flex" }}>
                <button
                  ref={t.key === state.activeKey ? activeTabRef : undefined}
                  type="button" role="tab" className="wb__tab"
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
          <span className="wb__header__divider" aria-hidden="true" />
          <div className="wb__actions">
            {active?.obj.kind === "note" && state.layout !== "S3" && (
              <IconButton icon="search" label="在本文档中查找 ⌘F" onClick={() => window.dispatchEvent(new CustomEvent("wb-find"))} />
            )}
            {state.layout !== "S3" && (
              <IconButton icon="graph" label={state.contextOpen ? "收起 Context" : "打开 Context"} className={state.contextOpen ? "is-active" : ""} onClick={() => dispatch({ type: "toggleContext" })} />
            )}
            {state.layout === "S4"
              ? <Button size="sm" onClick={() => dispatch({ type: "exitFocus" })}>退出专注</Button>
              : active?.obj.kind === "review"
                ? <IOS27Button variant="filled" size="small" onClick={() => dispatch({ type: "enterFocus" })}>进入专注</IOS27Button>
                : null}
          </div>
        </div>
        {active ? (
          <WorkSurfaceObject
            obj={active.obj}
            onLink={onLink}
            onAnnotate={(quote) => dispatch({ type: "addAnnotation", quote, note: "", objKey: active.key })}
          />
        ) : (
          <div className="wb-empty"><WorkState kind="empty" title="没有打开的对象" hint="从 Explorer 选择，或按 ⌘K 搜索。" /></div>
        )}
      </main>

      {side && (
        <section className={`wb__side${plan.compareMode === "drawer" ? " wb__side--drawer" : ""}`} style={{ gridArea: "side" }} aria-label="并置对象">
          <span className="wb__gap">
            <IconButton icon="forward" label="交换为主对象" onClick={() => { const s = side; dispatch({ type: "closeSide" }); open(s); }} />
            <IconButton icon="close" label="关闭并置" onClick={() => dispatch({ type: "closeSide" })} />
          </span>
          <div className="wb__side__bar">
            <span className="t-caption">并置 · {side.title}</span>
            <Button size="sm" prominence="plain" onClick={() => {
              window.dispatchEvent(new CustomEvent("wb-demo-link", { detail: side.title }));
            }}>Link</Button>
          </div>
          <div className="wb__side__body" onScroll={(e) => {
            const bar = e.currentTarget.parentElement?.querySelector(".wb__side__bar");
            if (bar) bar.classList.toggle("is-scrolled", e.currentTarget.scrollTop > 8);
          }}>
            <WorkSurfaceObject obj={side.obj} onLink={() => { /* 副对象内链接 3A 不展开 */ }} />
          </div>
        </section>
      )}

      {(plan.contextMode === "column" || plan.contextMode === "drawer") && state.contextOpen && (
        <ContextPane
          state={state}
          model={contextModel}
          density={density}
          onOpen={open}
          onAnnotateNote={(id, note) => dispatch({ type: "updateAnnotation", id, note })}
          onCloseAnn={(id) => dispatch({ type: "removeAnnotation", id })}
          onClose={() => dispatch({ type: "toggleContext" })}
          loading={false}
          recomposeKey={active?.key ?? "none"}
        />
      )}

      {/* E. Inspector（≥1440；Xcode 模式：元数据 / 批注列表 / 导出） */}
      {plan.inspectorMode === "column" && inspectorOpen && (
        <aside className="wb__inspector" style={{ gridArea: "inspector" }} aria-label="Inspector">
          <div className="wb-ctx__head"><span className="t-caption">Inspector</span></div>
          <div className="wb-ctx__section">
            <h3>属性</h3>
            <div className="wb-ctx__row"><span className="wb-ctx__row-primary">类型</span><span className="wb-ctx__row-meta">{active?.obj.kind ?? "-"}</span></div>
            <div className="wb-ctx__row"><span className="wb-ctx__row-primary">标签</span><span className="wb-ctx__row-meta">{noteMeta.tags || "—"}</span></div>
            <div className="wb-ctx__row"><span className="wb-ctx__row-primary">更新</span><span className="wb-ctx__row-meta">{noteMeta.updated || "—"}</span></div>
          </div>
          <div className="wb-ctx__section">
            <h3>批注（内存态）</h3>
            <p className="wb-ctx__row-meta" style={{ margin: 0 }}>{annCountForActive > 0 ? `${annCountForActive} 条` : "暂无"}</p>
          </div>
          <div className="wb-ctx__section">
            <h3>动作</h3>
            <div style={{ display: "flex", gap: "var(--space-xs)", flexWrap: "wrap" }}>
              <Button size="sm" prominence="plain">导出</Button>
              <Button size="sm" prominence="plain">复制链接</Button>
            </div>
          </div>
        </aside>
      )}
      </div>

      {/* F. Bottom Panel（默认收起；Tutor / Review / Trace） */}
      {panel && (
        <section className="wb__panel" style={{ height: panelHeight }} aria-label="Bottom Panel">
          <div className="wb__panel__bar" onPointerDown={startPanelDrag}>
            <span className="t-caption">{panel === "tutor" ? "Tutor" : panel === "review" ? "Review Focus" : "Trace"}</span>
            <span className="wb__topbar__spacer" />
            <Button size="sm" prominence="plain" onClick={() => setPanel(panel === "tutor" ? "review" : panel === "review" ? "trace" : "tutor")}>切换</Button>
            <IconButton icon="close" label="关闭面板" style={{ width: 24, height: 24 }} onClick={() => setPanel(null)} />
          </div>
          <div className="wb__panel__body">
            {panel === "tutor" && <TutorSlot />}
            {panel === "review" && <ReviewSlot />}
            {panel === "trace" && <div className="wb-empty"><WorkState kind="empty" title="Trace 待接入" hint="算法可视化在 Algorithm Lab 阶段接入（backend trace 已存在）。" /></div>}
          </div>
        </section>
      )}

      {peek && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 999 }} onClick={() => setPeek(null)} />
          <div className="wb-peek" style={{ left: Math.min(peek.x, window.innerWidth - 316), top: peek.y }} role="dialog" aria-label={`Peek ${peek.title}`}>
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
        <CommandPalette notes={notes ?? []} onClose={() => setPaletteOpen(false)} onOpen={open} onOpenRight={openRight} />
      )}
    </div>
  );
}

/* ── Explorer ───────────────────────────────────────────── */
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
    <aside className="wb__pane" aria-label="Explorer inner">
      <div className="wb-explorer__search">
        <SearchField placeholder="在当前工作集中搜索…" shortcutHint="" value={q} onValueChange={setQ} aria-label="工作集过滤" />
      </div>
      {error && <div className="wb-empty"><WorkState kind="error" title="无法加载笔记" hint={error} /></div>}
      {notes === null && !error && <WorkState kind="loading" title="加载笔记…" />}
      {notes !== null && filtered.length === 0 && <WorkState kind="empty" title="没有匹配的笔记" hint="换个关键词。" />}
      <div className="wb-explorer__list">
        {filtered.map((n) => {
          const key = objectKey({ kind: "note", id: n.id });
          return (
            <button
              key={n.id} type="button"
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
      </div>
    </aside>
  );
}
