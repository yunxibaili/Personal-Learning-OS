/**
 * AppleSourceReference — Source reconstruction benchmark（?design=apple-source-reference）。
 * 指令书 §36：不是组件 Gallery，是 **Apple source reconstruction benchmark**。
 * 组件 = 从 ios27-design-system（MIT）逐文件移植（source port，非 package adoption）；
 * tokens bridge 将 Apple 蓝→OLOS accent，几何/动效保持 source 级。
 */
import { useState } from "react";
import { Button } from "../components/ios27/Button";
import { SegmentedControl } from "../components/ios27/SegmentedControl";
import { Toolbar } from "../components/ios27/Toolbar";
import { Sheet } from "../components/ios27/Sheet";
import { SearchBar } from "../components/ios27/SearchBar";
import { RICH_NOTE, RICH_NOTE_TITLE } from "./richNoteFixture";
import { NoteReader } from "../workbench/NoteReader";
import "../components/ios27/tokens-bridge.css";
import "../components/ios27/materials.css";
import "../components/ios27/Button.css";
import "../components/ios27/SegmentedControl.css";
import "../components/ios27/Toolbar.css";
import "../components/ios27/Sheet.css";
import "../components/ios27/SearchBar.css";
import "../components/ios27/ContextMenu.css";

function Bench({ title, what, children }: { title: string; what: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: "var(--space-2xl)" }}>
      <h2 className="t-caption" style={{ textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-text-tertiary)", margin: "0 0 var(--space-xs)" }}>
        {title}
      </h2>
      <p className="t-caption" style={{ margin: "0 0 var(--space-sm)", color: "var(--color-text-tertiary)" }}>{what}</p>
      <div style={{ border: "1px solid var(--color-border-subtle)", borderRadius: "var(--radius-lg)", padding: "var(--space-lg)", background: "var(--color-background)" }}>
        {children}
      </div>
    </section>
  );
}

export default function AppleSourceReference() {
  const [seg, setSeg] = useState(0);
  const [sheet, setSheet] = useState(false);

  return (
    <main style={{ background: "var(--color-background)", minHeight: "100vh", padding: "var(--space-2xl) var(--space-xl)" }}>
      <header style={{ maxWidth: 960, margin: "0 auto var(--space-2xl)" }}>
        <h1 className="t-largeTitle" style={{ margin: 0 }}>Apple Source Reference</h1>
        <p className="t-callout" style={{ margin: "var(--space-2xs) 0 0" }}>
          Source port benchmark · ios27-design-system (MIT) → OLOS tokens bridge ·
          逐场景对照 source geometry/hierarchy/motion · 记录见 docs/UI-SOURCE-IMPLEMENTATION-MATRIX.md
        </p>
      </header>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>

        <Bench title="Button — 5 variants × 3 sizes" what="port: Button.tsx/Button.css · geometry 28/34/44/50/56pt · press scale(0.97) · focus ring 4px 35%">
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-sm)", alignItems: "center" }}>
            <Button variant="filled">Filled</Button>
            <Button variant="gray">Gray</Button>
            <Button variant="tinted">Tinted</Button>
            <Button variant="plain">Plain</Button>
            <Button variant="liquid-glass">Liquid Glass</Button>
            <Button variant="filled" size="small">Small</Button>
            <Button variant="filled" size="large">Large</Button>
            <Button variant="filled" disabled>Disabled</Button>
          </div>
        </Bench>

        <Bench title="SegmentedControl — 单选 · roving 键盘" what="port: SegmentedControl.tsx · active=bg-primary+shadow · press scale(0.97)">
          <SegmentedControl segments={["Day", "Week", "Month", "Year"]} defaultSelected={1} onChange={setSeg} />
          <p className="t-caption" style={{ margin: "8px 0 0" }}>selected index: {seg}</p>
        </Bench>

        <Bench title="Toolbar — grouping（navigation | search | primary）" what="port: Toolbar.tsx · 分组间距由 toolbar group 语义承担，非逐按钮排布">
          <Toolbar
            leading={<Button variant="plain">‹</Button>}
            title="梯度下降与优化器全景"
            trailing={<>
              <Button variant="plain">⌕</Button>
              <Button variant="filled">Tutor</Button>
            </>}
          />
        </Bench>

        <Bench title="SearchBar — scope 显式" what="port: SearchBar.tsx · [A] HIG Searching：scope 由占位符/容器表达">
          <SearchBar placeholder="在全部笔记中搜索…" />
        </Bench>

        <Bench title="Sheet — detent + drag-ready" what="port: Sheet.tsx · present/dismiss 动效走 --duration-sheet-*">
          <Button variant="filled" onClick={() => setSheet(true)}>打开 Sheet</Button>
          {sheet && (
            <Sheet detent="medium" onClose={() => setSheet(false)}>
              <div style={{ padding: "var(--space-lg)" }}>
                <div className="t-body-ui" style={{ fontWeight: 600, marginBottom: 8 }}>{RICH_NOTE_TITLE}</div>
                <p className="t-callout" style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                  {RICH_NOTE.content_md.slice(0, 300)}
                </p>
              </div>
            </Sheet>
          )}
        </Bench>

        <Bench title="Note Reading — ported 组件在 OLOS 阅读环境中共存" what="组合感检查：source 组件 + OLOS reader/Context 是否同一设计家族">
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 280px", gap: "var(--space-md)" }}>
            <div style={{ maxHeight: 420, overflow: "auto", border: "1px solid var(--color-border-subtle)", borderRadius: "var(--radius-md)" }}>
              <NoteReader note={RICH_NOTE} onLink={() => {}} onAnnotate={() => {}} />
            </div>
            <div style={{ display: "grid", gap: "var(--space-md)", alignContent: "start" }}>
              <SearchBar placeholder="在当前工作集中搜索…" />
              <SegmentedControl segments={["简", "标", "研"]} defaultSelected={1} />
              <Button variant="gray">在右侧打开</Button>
              <Button variant="tinted">加入复习</Button>
              <Button variant="liquid-glass">Liquid Glass 浮层</Button>
            </div>
          </div>
        </Bench>

      </div>
    </main>
  );
}
