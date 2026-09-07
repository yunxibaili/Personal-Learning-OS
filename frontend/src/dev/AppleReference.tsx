/**
 * AppleReference — 系统级场景基准页（?design=apple-reference，Phase 3R.2 §42）。
 * 不是组件 Gallery：用**真实中文长文**驱动全场景（Reading / Note+Context / Compare / Peek / Review）。
 * 每个场景 = 真实组件 + 真实数据 + default/focused 状态。
 */
import { useState } from "react";
import { NoteReader } from "../workbench/NoteReader";
import { Button, IconButton } from "../components/ui/Button";
import { Icon } from "../components/icons/Icon";
import ReviewView from "../features/review/ReviewView";
import type { IconName } from "../components/icons/Icon";
import { RICH_NOTE, RICH_NOTE_TITLE } from "./richNoteFixture";

function Scene({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: "var(--space-2xl)" }}>
      <h2 className="t-caption" style={{ textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-text-tertiary)", margin: "0 0 var(--space-sm)" }}>
        {title} · {note}
      </h2>
      <div style={{ border: "1px solid var(--color-border-subtle)", borderRadius: "var(--radius-lg)", overflow: "hidden", background: "var(--color-background)" }}>
        {children}
      </div>
    </section>
  );
}

const railIcons: IconName[] = ["notes", "search", "review", "tutor"];

function MiniRail({ active }: { active: string }) {
  return (
    <nav className="wb__rail" style={{ minHeight: 560 }} aria-label="Rail">
      {railIcons.map((ic) => (
        <IconButton key={ic} icon={ic} label={ic} className={ic === active ? "is-active" : ""} />
      ))}
    </nav>
  );
}

function MiniContext({ density, note }: { density: string; note: string }) {
  return (
    <aside className="wb__pane wb__pane--context wb-ctx" data-density={density} aria-label="Context">
      <div className="wb-ctx__head">
        <span className="t-caption">Context</span>
        <span className="wb-ctx__density">
          {(["minimal", "standard", "research"] as const).map((d) => (
            <button key={d} type="button" aria-pressed={d === density}>{d === "minimal" ? "简" : d === "standard" ? "标" : "研"}</button>
          ))}
        </span>
      </div>
      <div className="wb-ctx__section">
        <div className="t-body-ui" style={{ fontWeight: 700 }}>{note}</div>
        <p className="t-caption" style={{ margin: "2px 0 0" }}>note · 机器学习 / 优化</p>
      </div>
      <div className="wb-ctx__section">
        <h3>提到的概念 · 掌握度</h3>
        <div className="wb-ctx__mastery">
          {["梯度下降", "Adam优化器", "反向传播"].map((t, i) => (
            <div key={t} className="wb-ctx__bar">
              <div>
                <div className="t-caption">{t}</div>
                <div className="wb-ctx__bar-track"><div className="wb-ctx__bar-fill" style={{ width: `${72 - i * 14}%` }} /></div>
              </div>
              <span className="t-caption">{72 - i * 14}%</span>
            </div>
          ))}
        </div>
      </div>
      <div className="wb-ctx__section">
        <h3>学习动作</h3>
        <div style={{ display: "flex", gap: "var(--space-xs)", flexWrap: "wrap" }}>
          <Button size="sm" icon="tutor">问 Tutor</Button>
          <Button size="sm" prominence="plain">进入复习</Button>
        </div>
      </div>
    </aside>
  );
}

export default function AppleReference() {
  const rich = { ...RICH_NOTE };
  const [reviewKey, setReviewKey] = useState(0);

  return (
    <main style={{ background: "var(--color-background)", minHeight: "100vh", padding: "var(--space-2xl) var(--space-xl)" }}>
      <header style={{ maxWidth: 1100, margin: "0 auto var(--space-2xl)" }}>
        <h1 className="t-largeTitle" style={{ margin: 0 }}>Apple Reference — 产品场景基准</h1>
        <p className="t-callout" style={{ margin: "var(--space-2xs) 0 0" }}>
          Phase 3R.2 · 真实中文长文（{RICH_NOTE.content_md.length} 字）驱动 · 每场景回答：primary object / task / next action
        </p>
      </header>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        <Scene title="Scene 1 — Reading（默认态，One object in focus）" note="真实 1200 字长文">
          <div style={{ display: "grid", gridTemplateColumns: "52px minmax(0,1fr)" }}>
            <MiniRail active="notes" />
            <main className="wb__pane wb__pane--surface">
              <div className="wb__header">
                <div className="wb__tabs">
                  <span style={{ display: "inline-flex" }}>
                    <button type="button" role="tab" className="wb__tab" aria-current="true">{RICH_NOTE_TITLE}
                      <span className="wb__tab__close"><Icon name="close" size={12} /></span>
                    </button>
                  </span>
                </div>
                <div className="wb__actions">
                  <IconButton icon="graph" label="Context" />
                  <IconButton icon="search" label="查找" />
                </div>
              </div>
              <NoteReader note={rich} onLink={() => {}} onAnnotate={() => {}} />
            </main>
          </div>
        </Scene>

        <Scene title="Scene 2 — Note + Context（靠近但不打断）" note="S2 · Context Standard 密度">
          <div style={{ display: "grid", gridTemplateColumns: "52px minmax(0,1fr) 304px" }}>
            <MiniRail active="notes" />
            <main className="wb__pane wb__pane--surface">
              <div className="wb__header">
                <div className="wb__tabs">
                  <span style={{ display: "inline-flex" }}>
                    <button type="button" role="tab" className="wb__tab" aria-current="true">{RICH_NOTE_TITLE}</button>
                  </span>
                </div>
                <div className="wb__actions">
                  <IconButton icon="graph" label="Context" className="is-active" />
                </div>
              </div>
              <NoteReader note={rich} onLink={() => {}} onAnnotate={() => {}} />
            </main>
            <MiniContext density="standard" note={RICH_NOTE_TITLE} />
          </div>
        </Scene>

        <Scene title="Scene 3 — Compare（连续双阅读面）" note="S3 · 中缝 hover 显现 · 共享几何">
          <div style={{ display: "grid", gridTemplateColumns: "52px minmax(0,1fr) minmax(0,1fr)" }}>
            <MiniRail active="notes" />
            <main className="wb__pane wb__pane--surface">
              <div className="wb__header">
                <div className="wb__tabs">
                  <span style={{ display: "inline-flex" }}>
                    <button type="button" role="tab" className="wb__tab" aria-current="true">{RICH_NOTE_TITLE}</button>
                  </span>
                </div>
              </div>
              <NoteReader note={rich} onLink={() => {}} onAnnotate={() => {}} />
            </main>
            <section className="wb__side" aria-label="并置对象">
              <span className="wb__gap">
                <IconButton icon="forward" label="交换" />
                <IconButton icon="close" label="关闭并置" />
              </span>
              <div className="wb__side__bar">
                <span className="t-caption">并置 · {RICH_NOTE_TITLE}</span>
                <Button size="sm" prominence="plain">Link</Button>
              </div>
              <div className="wb__side__body">
                <NoteReader note={rich} onLink={() => {}} onAnnotate={() => {}} />
              </div>
            </section>
          </div>
        </Scene>

        <Scene title="Scene 4 — Peek（从内容长出来）" note="锚定 source · Esc 关闭">
          <div style={{ position: "relative", padding: "var(--space-lg)" }}>
            <p className="t-reading" style={{ margin: 0, maxWidth: 680 }}>
              核心优化方法是梯度下降，工程上最常用
              <span style={{ position: "relative", display: "inline-block" }}>
                <button type="button" className="wb-link">Adam优化器</button>
                <span className="wb-peek" style={{ position: "absolute", left: 0, top: 26, width: 280 }}>
                  <div className="t-body-ui" style={{ fontWeight: 600, marginBottom: 4 }}>Adam优化器</div>
                  <p className="t-callout" style={{ margin: "0 0 var(--space-sm)" }}>掌握度 58% · 3 天前复习</p>
                  <div style={{ display: "flex", gap: "var(--space-xs)", flexWrap: "wrap" }}>
                    <Button size="sm" prominence="prominent">打开</Button>
                    <Button size="sm">在右侧打开</Button>
                    <Button size="sm" prominence="plain">问 Tutor</Button>
                  </div>
                </span>
              </span>
              ，它结合了动量与二阶矩估计。
            </p>
          </div>
        </Scene>

        <Scene title="Scene 5 — Review Focus（S4 专注）" note="专注学习状态 · Again/Hard/Good">
          <div style={{ display: "grid", gridTemplateColumns: "52px minmax(0,1fr)" }}>
            <MiniRail active="review" />
            <main className="wb__pane wb__pane--surface">
              <div className="wb__header">
                <div className="wb__tabs"><span style={{ display: "inline-flex" }}><button type="button" role="tab" className="wb__tab" aria-current="true">Review</button></span></div>
                <div className="wb__actions">
                  <Button size="sm" onClick={() => setReviewKey((k) => k + 1)}>重置</Button>
                </div>
              </div>
              <ReviewView key={reviewKey} />
            </main>
          </div>
        </Scene>

      </div>
    </main>
  );
}
