/**
 * Workbench Shell — Phase 3R release hardening（ADR-031）。
 * 原则：One object in focus. Everything else stays close, contextual, and reversible.
 * 用户层不见 S0–S4；布局由动作派生（model.ts）。颜色全部走 design token。
 * 批注为内存态（持久化 = Phase 4 提案，ADR-031）。
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from "react";
import { computeLayout } from "./layout";
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
import { listMastery, type MasteryEntry } from "../api/mastery";
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

/* ── Context Pane：三档密度（Minimal/Standard/Research）────── */
type Density = "minimal" | "standard" | "research";

function ContextPane({ state, notes, mastery, density, setDensity, onOpen, onAnnotateNote, onCloseAnn, onClose, loading }: {
  state: WorkbenchState;
  notes: NoteSummary[] | null;
  mastery: MasteryEntry[] | null;
  density: Density;
  setDensity: (d: Density) => void;
  onOpen: (obj: WorkObject) => void;
  onAnnotateNote: (id: string, note: string) => void;
  onCloseAnn: (id: string) => void;
  onClose: () => void;
  loading: boolean;
}) {
  const active = state.tabs.find((t) => t.key === state.activeKey);
  const show = {
    mastery: density !== "minimal",
    annotations: density !== "minimal",
    related: density === "standard" || density === "research",
    research: density === "research",
  };

  const title = active?.title ?? "";
  // 3B 精确匹配：概念 title 与对象标题全等优先，其次包含（[指令书 §4]）
  const linked = (mastery ?? []).filter((m) => title === m.title || title.includes(m.title));
  const anns = state.annotations.filter((a) => a.objKey === active?.key);

  return (
    <aside className="wb__pane wb__pane--context wb-ctx" data-density={density} aria-label="Context">
      <div className="wb-ctx__head">
        <span className="t-caption">Context</span>
        <IOS27Segmented
          segments={["简", "标", "研"]}
          selected={(["minimal", "standard", "research"] as const).indexOf(density)}
          onChange={(i) => setDensity((["minimal", "standard", "research"] as const)[i])}
        />
        <IconButton icon="close" label="收起 Context" onClick={onClose} style={{ width: 24, height: 24 }} />
      </div>

      {loading ? <WorkState kind="loading" title="加载中…" /> : !active ? (
        <WorkState kind="empty" title="没有焦点对象" hint="打开一个对象后，这里显示它与你的学习关系。" />
      ) : (
        <>
          <div className="wb-ctx__section">
            <div className="t-body-ui" style={{ fontWeight: 700 }}>{title}</div>
            {active.obj.kind === "note" && <p className="t-caption" style={{ margin: "2px 0 0" }}>note · id {active.obj.id}</p>}
          </div>

          {show.mastery && (
            <div className="wb-ctx__section">
              <h3>提到的概念 · 掌握度</h3>
              {linked.length === 0 ? (
                <p className="t-callout" style={{ margin: 0 }}>未匹配到概念。</p>
              ) : (
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
              )}
            </div>
          )}

          {show.annotations && (
            <div className="wb-ctx__section">
              <h3>批注（内存态 · Phase 4 持久化）</h3>
              {anns.length === 0 ? <p className="t-callout" style={{ margin: 0 }}>选中正文文字即可标注。</p> : null}
              {anns.map((a) => (
                <div key={a.id} className="wb-ann">
                  <div className="t-caption" style={{ marginBottom: 4 }}>“{a.quote}”</div>
                  <textarea value={a.note} placeholder="为什么重要？" onChange={(e) => onAnnotateNote(a.id, e.target.value)} />
                  <button type="button" className="t-caption" style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--color-text-tertiary)", padding: 0 }} onClick={() => onCloseAnn(a.id)}>删除</button>
                </div>
              ))}
            </div>
          )}

          {show.research && (
            <div className="wb-ctx__section">
              <h3>Sources</h3>
              <p className="t-callout" style={{ margin: 0 }}>批注来源清单将随 Paper 能力（Phase 4）接入。</p>
            </div>
          )}

          {(density === "standard" || density === "research") && (
            <div className="wb-ctx__section">
              <h3>相关笔记</h3>
              {notes === null ? <WorkState kind="loading" title="加载中…" /> : (
                <div className="wb-ctx__rel">
                  {notes.slice(0, 4).map((n) => (
                    <button key={n.id} type="button" className="wb-explorer__item" onClick={() => onOpen({ key: objectKey({ kind: "note", id: n.id }), obj: { kind: "note", id: n.id }, title: n.title })}>
                      {n.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="wb-ctx__section">
            <h3>学习动作</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-xs)" }}>
              <Button size="sm" icon="tutor" onClick={() => onOpen({ key: "tutor", obj: { kind: "tutor" }, title: "Tutor" })}>问 Tutor</Button>
              {active.obj.kind !== "review" && (
                <Button size="sm" prominence="plain" onClick={() => onOpen({ key: "review", obj: { kind: "review" }, title: "Review" })}>进入复习</Button>
              )}
            </div>
          </div>
        </>
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
        width: vw,
      }),
    [state.explorerOpen, state.contextOpen, state.side, state.layout, vw],
  );

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
    <div
      className="wb"
      data-layout={state.layout}
      data-scrolled={scrolled ? "true" : "false"}
      style={{ gridTemplateColumns: plan.columns, gridTemplateAreas: plan.areas }}
    >
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
          notes={notes}
          mastery={mastery}
          density={density}
          setDensity={setDensity}
          onOpen={open}
          onAnnotateNote={(id, note) => dispatch({ type: "updateAnnotation", id, note })}
          onCloseAnn={(id) => dispatch({ type: "removeAnnotation", id })}
          onClose={() => dispatch({ type: "toggleContext" })}
          loading={false}
        />
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
