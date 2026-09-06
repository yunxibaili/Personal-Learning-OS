/**
 * DesignPlayground — dev-only 设计系统预览（UI-REBUILD-DESIGN-AUDIT §40）。
 *
 * 进入方式：`http://localhost:5173/?design`（App.tsx 查询参数分流，不进导航）。
 * 职责：只展示 Phase 1 基础层（tokens / typography / surfaces / motion），
 * 并为 Phase 2 原语组件提供状态基线。禁止在这里写业务。
 * 每个新 Surface / Token 落地后必须在此登记可视化样张。
 */
const SWATCHES: Array<[string, string, string]> = [
  ["background", "var(--color-background)", "页面底色"],
  ["surface", "var(--color-surface)", "内容面"],
  ["surface-elevated", "var(--color-surface-elevated)", "次级面板"],
  ["surface-glass", "var(--color-surface-glass)", "浮层交互（仅 glass 类）"],
  ["text-primary", "var(--color-text-primary)", "正文"],
  ["text-secondary", "var(--color-text-secondary)", "次要"],
  ["text-tertiary", "var(--color-text-tertiary)", "辅助"],
  ["border-subtle", "var(--color-border-subtle)", "hairline"],
  ["accent", "var(--color-accent)", "注意力指针"],
  ["accent-soft", "var(--color-accent-soft)", "指针底色"],
  ["success", "var(--color-success)", "成功"],
  ["warning", "var(--color-warning)", "警告"],
  ["error", "var(--color-error)", "错误"],
];

const RADII: Array<[string, string]> = [
  ["xs 4", "var(--radius-xs)"],
  ["sm 8", "var(--radius-sm)"],
  ["md 12", "var(--radius-md)"],
  ["lg 16", "var(--radius-lg)"],
  ["xl 22", "var(--radius-xl)"],
  ["capsule", "var(--radius-capsule)"],
];

const TYPE_ROWS: Array<[string, string]> = [
  ["t-display", "Display 34/700 — 空间级标题"],
  ["t-largeTitle", "Large Title 28/700 — 页级标题"],
  ["t-title", "Title 22/700 — 区块标题"],
  ["t-headline", "Headline 17/600 — 控件标题"],
  ["t-body-ui", "Body UI 14/400 — 界面正文"],
  ["t-callout", "Callout 13/400 — 说明文字"],
  ["t-caption", "Caption 11/500 — 状态与注脚"],
  ["t-reading", "Reading 17/1.75 — 笔记阅读正文（680px 行宽）"],
];

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: "var(--space-2xl)" }}>
      <h2 className="t-title" style={{ margin: "0 0 var(--space-2xs)" }}>{title}</h2>
      {note && <p className="t-callout" style={{ margin: "0 0 var(--space-md)" }}>{note}</p>}
      {children}
    </section>
  );
}

/** 涂在 glass/immersive 样张背后的色块，让 blur/saturate 可见 */
function BackdropStrip({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: "relative", padding: "var(--space-lg)", overflow: "hidden" }}>
      <div
        aria-hidden
        style={{
          position: "absolute", inset: 0,
          background:
            "var(--color-accent) 0 0 / 28% 60% no-repeat," +
            "var(--color-success) 40% 20% / 26% 70% no-repeat," +
            "var(--color-warning) 78% 0 / 26% 55% no-repeat," +
            "var(--color-surface-sunken) 0 0 / 100% 100% no-repeat",
        }}
      />
      <div style={{ position: "relative" }}>{children}</div>
    </div>
  );
}

export default function DesignPlayground() {
  return (
    <main className="surface-base" style={{ minHeight: "100vh", padding: "var(--space-xl)" }}>
      <div className="measure-reading">
        <header style={{ marginBottom: "var(--space-2xl)" }}>
          <h1 className="t-largeTitle" style={{ margin: 0 }}>Design Playground</h1>
          <p className="t-callout" style={{ margin: "var(--space-2xs) 0 0" }}>
            dev-only · Open Learning OS Design Foundation（Phase 1）。
            Phase 2 原语组件落地后将替换下方手工样张。
          </p>
        </header>

        <Section title="Color" note="组件只允许消费语义 token，禁止写死色值。">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "var(--space-sm)" }}>
            {SWATCHES.map(([name, value, usage]) => (
              <div key={name} className="surface-raised" style={{ padding: "var(--space-sm)" }}>
                <div style={{ height: 40, borderRadius: "var(--radius-sm)", background: value, border: "1px solid var(--color-border-subtle)" }} />
                <div className="t-caption" style={{ marginTop: "var(--space-2xs)" }}>{name}</div>
                <div className="t-subheadline">{usage}</div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Typography" note="双尺度：阅读正文 17px/1.75 与 UI 文字 13–14px 并存。">
          <div className="surface-raised" style={{ padding: "var(--space-lg)", display: "grid", gap: "var(--space-sm)" }}>
            {TYPE_ROWS.map(([cls, label]) => (
              <div key={cls} className={cls}>{label} <span className="t-caption">· {cls}</span></div>
            ))}
          </div>
        </Section>

        <Section title="Radius & Space" note="concentricity：内层 radius = 外层 radius − padding。">
          <div style={{ display: "flex", gap: "var(--space-sm)", flexWrap: "wrap" }}>
            {RADII.map(([label, value]) => (
              <div key={label} style={{
                width: 72, height: 48, background: "var(--color-accent-soft)",
                border: "1px solid var(--color-accent)", borderRadius: value,
                display: "grid", placeItems: "center",
              }}>
                <span className="t-caption">{label}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section
          title="Surfaces"
          note="glass 仅限浮层交互面（ADR-013 §2.7.1）；immersive 暗色子树仅限可视化/代码。"
        >
          <div style={{ display: "grid", gap: "var(--space-md)" }}>
            <div className="surface-raised" style={{ padding: "var(--space-lg)" }}>
              <div className="t-headline">surface-raised</div>
              <div className="t-callout">Explorer / ContextRail 静止态。</div>
            </div>
            <BackdropStrip>
              <div className="surface-glass" style={{ padding: "var(--space-lg)" }}>
                <div className="t-headline">surface-glass</div>
                <div className="t-callout">Floating TopBar / Palette / Peek / Sheet 专用。</div>
              </div>
            </BackdropStrip>
            <div
              className="surface-immersive"
              data-surface="immersive"
              style={{ padding: "var(--space-lg)" }}
            >
              <div className="t-headline" style={{ color: "var(--color-text-primary)" }}>surface-immersive（data-surface 切换暗色 token）</div>
              <div className="t-callout" style={{ color: "var(--color-text-secondary)" }}>
                Galaxy / Graph / Algorithm 可视化 / 代码区。
              </div>
            </div>
          </div>
        </Section>

        <Section title="Motion" note="hover 感受 --ease-standard 与时长 token；reduced-motion 下全部降级。">
          <div style={{ display: "flex", gap: "var(--space-md)" }}>
            {(["instant", "fast", "standard", "slow"] as const).map((k) => (
              <button
                key={k}
                type="button"
                className="surface-raised t-body-ui"
                style={{
                  cursor: "pointer",
                  transition: `transform var(--motion-${k}) var(--ease-standard)`,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-4px)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
              >
                hover · {k}
              </button>
            ))}
          </div>
        </Section>
      </div>
    </main>
  );
}
