/**
 * ReferenceGallery — 视觉校准页（?design=reference，指令书 §20）。
 * 不是文档页：是可交互的 REFERENCE COMPONENTS 母版陈列 +
 * Glass A/B/C 对照 + Liquid Glass 三档实验。
 * 视觉校准循环（指令书 §21）：implement → browser → screenshot → inspect → change → repeat。
 */
import { useState } from "react";
import { Button, IconButton } from "../components/ui/Button";
import { Tabs } from "../components/ui/Tabs";
import { SegmentedControl } from "../components/ui/SegmentedControl";
import { Popover, PopoverHeader } from "../components/ui/Popover";
import { Toolbar } from "../components/ui/Toolbar";
import { SearchField } from "../components/ui/SearchField";
import { LiquidGlassCard } from "./LiquidGlassLab";

function Block({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: "var(--space-2xl)" }}>
      <h2 className="t-headline" style={{ margin: "0 0 var(--space-3xs)", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-text-tertiary)", fontSize: 12 }}>
        {title}
      </h2>
      {note && <p className="t-callout" style={{ margin: "0 0 var(--space-md)" }}>{note}</p>}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "var(--space-lg)" }}>{children}</div>
    </section>
  );
}

/** 丰富背景条：验证玻璃/影的真实观感——低饱和色斑，判定玻璃但不喧宾夺主（Owner 裁定「颜色不能太花哨」） */
function RichBackdrop({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: "relative", padding: "var(--space-lg)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
      <div
        aria-hidden
        style={{
          position: "absolute", inset: 0,
          background:
            "radial-gradient(260px circle at 12% 25%, rgba(255,107,53,.30), transparent 70%)," +
            "radial-gradient(300px circle at 88% 15%, rgba(59,130,246,.22), transparent 70%)," +
            "radial-gradient(280px circle at 78% 85%, rgba(46,158,91,.20), transparent 70%)," +
            "radial-gradient(240px circle at 35% 80%, rgba(255,214,10,.20), transparent 70%)," +
            "#f0efec",
        }}
      />
      <div style={{ position: "relative" }}>{children}</div>
    </div>
  );
}

export default function ReferenceGallery() {
  const [tab, setTab] = useState("notes");
  const [seg, setSeg] = useState("review");
  const [search, setSearch] = useState("");

  return (
    <main className="surface-base" style={{ minHeight: "100vh", padding: "var(--space-2xl) var(--space-xl)" }}>
      <div style={{ maxWidth: 1040, margin: "0 auto" }}>
        <header style={{ marginBottom: "var(--space-2xl)" }}>
          <h1 className="t-largeTitle" style={{ margin: 0 }}>Reference Components</h1>
          <p className="t-callout" style={{ margin: "var(--space-2xs) 0 0" }}>
            视觉校准母版 · ?design=reference · 校准记录见 docs/UI-VISUAL-CALIBRATION.md
          </p>
        </header>

        <Block title="Button" note="Rest 安静 · Hover=材质/高度变化（无 scale 放大）· Press=物理压缩 · Release=spring settle">
          <div className="lab-row" style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-sm)" }}>
            <Button>Normal</Button>
            <Button className="is-hover--regular">Hover</Button>
            <Button className="is-pressed">Pressed</Button>
            <Button className="is-focus">Focus</Button>
            <Button disabled>Disabled</Button>
            <Button loading>Loading</Button>
            <Button prominence="prominent">Prominent</Button>
            <Button prominence="destructive">Destructive</Button>
          </div>
          <RichBackdrop>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-sm)", alignItems: "center" }}>
              <Button prominence="glass">Glass</Button>
              <IconButton icon="search" label="搜索" />
              <IconButton icon="sync" label="同步" activity />
              <Button size="sm" prominence="prominent" icon="plus">New</Button>
              <Button size="lg">Large 52px</Button>
            </div>
          </RichBackdrop>
        </Block>

        <Block title="Tab / Segmented Control" note="selection capsule：一个实体移动到 B（FLIP + retarget）">
          <Tabs
            aria-label="参考标签"
            value={tab}
            onChange={setTab}
            items={[
              { id: "notes", label: "Notes" },
              { id: "graph", label: "Graph" },
              { id: "review", label: "Review" },
              { id: "tutor", label: "Tutor" },
              { id: "x", label: "Disabled", disabled: true },
            ]}
          />
          <SegmentedControl
            aria-label="参考分段"
            value={seg}
            onChange={setSeg}
            options={[
              { id: "review", label: "Review" },
              { id: "weak", label: "Weak" },
              { id: "mistakes", label: "Mistakes" },
              { id: "all", label: "All" },
            ]}
          />
        </Block>

        <Block title="Popover" note="从触发点长出来：materialize（scale .96 + blur 3→0 + spring 过冲），dissolve 离场">
          <Popover
            trigger={(p) => (
              <Button {...p} icon="graph">Open Popover</Button>
            )}
          >
            <PopoverHeader title="Gradient Descent" />
            <p className="t-body-ui" style={{ margin: "0 0 var(--space-3xs)" }}>Concept · <strong>Mastery 72%</strong></p>
            <p className="t-callout" style={{ margin: "0 0 var(--space-md)" }}>
              Recall 51% · 明天复习 · 弱点：learning rate selection
            </p>
            <div style={{ display: "flex", gap: "var(--space-sm)" }}>
              <Button prominence="prominent" size="sm">Open Note</Button>
              <Button prominence="plain" size="sm">Ask Tutor</Button>
            </div>
          </Popover>
        </Block>

        <Block title="Toolbar + Search" note="Functional Layer：glass + specular 顶缘；Search focus = 面升起">
          <Toolbar
            groups={[
              { items: [{ icon: "back", label: "返回" }, { icon: "forward", label: "前进" }] },
              { items: [{ icon: "search", label: "搜索" }, { icon: "sync", label: "同步", activity: true }, { icon: "plus", label: "新建" }] },
              { items: [{ icon: "settings", label: "设置" }] },
            ]}
          />
          <SearchField value={search} onValueChange={setSearch} loading={search.length > 0 && search.length < 3} />
        </Block>

        <Block
          title="Glass A / B / C"
          note="Glass 对照（指令书 §9）：A=elevated plain · B=glass regular · C=glass+interaction response。只有 B>A 才保留 Glass。置于富背景上判定。"
        >
          <RichBackdrop>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-md)" }}>
              {(["A", "B", "C"] as const).map((v) => (
              <div
                key={v}
                className={v === "A" ? "surface-raised" : "surface-glass-regular"}
                style={{
                  width: 200,
                  padding: "var(--space-md)",
                  borderRadius: 14,
                  ...(v === "C"
                    ? {
                        boxShadow:
                          "inset 0 1px 0 rgba(255,255,255,.6), 0 12px 32px rgba(0,0,0,.16), 0 2px 8px rgba(0,0,0,.08)",
                        transition: "transform 180ms var(--spring-snappy), box-shadow 180ms var(--ease-standard)",
                        cursor: "pointer",
                      }
                    : {}),
                }}
                onMouseEnter={(e) => {
                  if (v === "C") { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "inset 0 1px 0 rgba(255,255,255,.7), 0 16px 40px rgba(0,0,0,.2)"; }
                }}
                onMouseLeave={(e) => {
                  if (v === "C") { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "inset 0 1px 0 rgba(255,255,255,.6), 0 12px 32px rgba(0,0,0,.16), 0 2px 8px rgba(0,0,0,.08)"; }
                }}
              >
                <div className="t-headline">Version {v}</div>
                <div className="t-callout">
                  {v === "A" ? "plain elevated surface" : v === "B" ? "glass regular" : "glass + interaction response（hover 我）"}
                </div>
              </div>
            ))}
            </div>
          </RichBackdrop>
        </Block>

        <Block
          title="Liquid Glass 三档实验（不接入生产）"
          note="blur → SDF 边缘折射 → pressed deformation。Chromium 下看 B/C；Safari/Firefox 自动回退 A 档材质。"
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-lg)", alignItems: "flex-start" }}>
            <LiquidGlassCard tier="blur" />
            <LiquidGlassCard tier="refraction" />
            <LiquidGlassCard tier="press" />
          </div>
        </Block>
      </div>
    </main>
  );
}
