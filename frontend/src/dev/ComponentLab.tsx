/**
 * Component Laboratory — dev-only（?design=components）。
 * 指令书 §29–32：每个组件同时展示 Preview / State Matrix / Material / Motion /
 * Interaction / Accessibility / Design rationale；Interaction 必须可真实操作；
 * Motion Lab 支持 Play/Interrupt/Reduced-Motion 切换。
 * 本页禁止业务逻辑；只消费 Reference Components。
 */
import { useCallback, useEffect, useState } from "react";
import { Button, IconButton } from "../components/ui/Button";
import { Tabs } from "../components/ui/Tabs";
import { SegmentedControl } from "../components/ui/SegmentedControl";
import { Popover, PopoverHeader } from "../components/ui/Popover";
import { Toast, ToastRegion, type ToastTone } from "../components/ui/Toast";

function Rationale({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="lab-rationale">
      {rows.map(([k, v]) => (
        <div key={k} className="lab-rationale__row">
          <dt className="t-caption">{k}</dt>
          <dd className="t-callout">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} style={{ marginBottom: "var(--space-2xl)" }}>
      <h2 className="t-title" style={{ margin: "0 0 var(--space-md)" }}>{title}</h2>
      {children}
    </section>
  );
}

const TAB_ITEMS = [
  { id: "note", label: "Gradient Descent" },
  { id: "taylor", label: "Taylor Expansion" },
  { id: "graph", label: "Graph" },
  { id: "review", label: "Review" },
  { id: "disabled", label: "Disabled", disabled: true },
];

const SEG_OPTIONS = [
  { id: "all", label: "全部" },
  { id: "notes", label: "笔记" },
  { id: "concepts", label: "概念" },
  { id: "mistakes", label: "错题" },
];

const TONES: ToastTone[] = ["success", "info", "warning", "error"];

export default function ComponentLab() {
  const [tab, setTab] = useState("note");
  const [seg, setSeg] = useState("notes");
  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState<Array<{ id: number; tone: ToastTone }>>([]);
  const [replaceOn, setReplaceOn] = useState(false);

  const pushToast = useCallback((tone: ToastTone) => {
    const id = Date.now() + Math.random();
    setToasts((ts) => [...ts, { id, tone }]);
  }, []);
  const removeToast = useCallback((id: number) => {
    setToasts((ts) => ts.filter((t) => t.id !== id));
  }, []);

  // Motion Lab：Interrupt（Tab 快速切换即真实 interrupt 测试）
  const [autoSwitch, setAutoSwitch] = useState(false);
  useEffect(() => {
    if (!autoSwitch) return;
    const t = window.setInterval(() => {
      setTab((cur) => {
        const ids = TAB_ITEMS.filter((t) => !t.disabled).map((t) => t.id);
        return ids[(ids.indexOf(cur) + 1) % ids.length];
      });
    }, 120); // 快速连切：验证 retarget / velocity continuity
    return () => window.clearInterval(t);
  }, [autoSwitch]);

  return (
    <main className="surface-base" style={{ minHeight: "100vh", padding: "var(--space-xl)" }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <header style={{ marginBottom: "var(--space-2xl)" }}>
          <h1 className="t-largeTitle" style={{ margin: 0 }}>Component Laboratory</h1>
          <p className="t-callout" style={{ margin: "var(--space-2xs) 0 0" }}>
            dev-only · Phase 2B · Foundation 见 <code>?design</code>。
            每个 Reference Component = Preview + Design rationale（来源标注见 UI-DESIGN-SYSTEM-SPEC）。
          </p>
        </header>

        <Section id="button" title="Button / IconButton">
          <div className="surface-raised lab-panel">
            <div className="lab-row">
              <Button prominence="prominent">开始复习</Button>
              <Button>保存笔记</Button>
              <Button prominence="plain">查看详情</Button>
              <Button prominence="destructive">删除笔记</Button>
              <Button
                loading={loading}
                onClick={() => {
                  setLoading(true);
                  window.setTimeout(() => setLoading(false), 1500);
                }}
              >
                {loading ? "同步中…" : "同步到云端"}
              </Button>
              <Button prominence="prominent" icon="plus">新建笔记</Button>
              <Button disabled>禁用态</Button>
            </div>
            <div className="lab-row">
              <IconButton icon="search" label="搜索" />
              <IconButton icon="sync" label="同步" activity />
              <IconButton icon="close" label="关闭" />
              <IconButton icon="settings" label="设置" />
              <Button prominence="glass">玻璃按钮（仅浮层内）</Button>
            </div>
            <Rationale
              rows={[
                ["Apple Fact", "Press state 强制；prominent 每屏 1–2 个；命中区 ≥44pt；破坏性不做 prominent"],
                ["OLOS Decision", "prominence=regular/prominent/plain/destructive/glass；pressed=scale 0.97（OLOS 参数）"],
                ["Material", "regular/plain/destructive→raised 系；glass→glass-regular（仅浮层内）"],
                ["Motion", "press=--spring-snappy；loading=spinner 替换 icon（非整体替换）"],
                ["A11y", "loading 时 aria-busy；focus-visible ring"],
              ]}
            />
          </div>
        </Section>

        <Section id="navigation" title="Tabs / SegmentedControl（selection continuity）">
          <div className="surface-raised lab-panel">
            <div className="lab-row">
              <Tabs items={TAB_ITEMS} value={tab} onChange={setTab} aria-label="工作台标签" />
              <Button prominence="plain" size="sm" onClick={() => setAutoSwitch((v) => !v)}>
                {autoSwitch ? "停止快速切换" : "▶ 快速切换（Interrupt 测试）"}
              </Button>
            </div>
            <div className="lab-row">
              <SegmentedControl options={SEG_OPTIONS} value={seg} onChange={setSeg} aria-label="范围筛选" />
            </div>
            <p className="t-callout" style={{ margin: 0 }}>
              当前 tab：<strong>{tab}</strong> · 指示器是<strong>同一个空间实体</strong>在 tab 间移动；
              快速切换时从当前插值态 retarget（velocity continuity）。
            </p>
            <Rationale
              rows={[
                ["Apple Fact", "Liquid Glass dynamically morphs between the controls... singular floating plane（WWDC25-219）"],
                ["OLOS Interpretation", "单一 active indicator 作持续实体 FLIP 移动，禁止旧隐新现"],
                ["Motion", "--spring-gentle；retarget 由 CSS transition 天然保证"],
                ["A11y", "tablist/tab + aria-selected + 方向键/Home/End"],
              ]}
            />
          </div>
        </Section>

        <Section id="overlay" title="Popover（Material Reference 母版）">
          <div className="surface-raised lab-panel">
            <div className="lab-row">
              <Popover
                trigger={(p) => (
                  <Button {...p} prominence="regular" icon="search">
                    打开 Popover
                  </Button>
                )}
              >
                <PopoverHeader title="Gradient Descent" />
                <p className="t-body-ui" style={{ margin: "0 0 var(--space-xs)" }}>Concept · Mastery 72%</p>
                <p className="t-callout" style={{ margin: "0 0 var(--space-md)" }}>
                  Recall 51% · 明天复习 · 弱点：learning rate selection
                </p>
                <div className="lab-row" style={{ margin: 0 }}>
                  <Button prominence="prominent" size="sm">打开笔记</Button>
                  <Button prominence="plain" size="sm" icon="tutor">问 Tutor</Button>
                </div>
              </Popover>
              <span className="t-callout">从触发点 materialize；Esc / 外点关闭；焦点还原。</span>
            </div>
            <Rationale
              rows={[
                ["Apple Fact", "Functional layer floats above content；the bubble simply pops open（WWDC25-219）"],
                ["OLOS Interpretation", "面板从 trigger origin materialize（opacity .96→1 + scale .98→1 + blur 2→0）"],
                ["Material", "glass-regular（文本安全变体）；glass-on-glass 禁止"],
                ["Motion", "--spring-gentle 进场；dissolve 离场更快无回弹；reduced-motion→60ms opacity 快切"],
                ["Interaction", "Esc / outside click / focus trap / focus restoration"],
              ]}
            />
          </div>
        </Section>

        <Section id="feedback" title="Toast / Motion Lab">
          <div className="surface-raised lab-panel">
            <div className="lab-row">
              {TONES.map((tone) => (
                <Button key={tone} size="sm" onClick={() => pushToast(tone)}>
                  toast · {tone}
                </Button>
              ))}
            </div>
            <div className="lab-row">
              <IconButton
                icon={replaceOn ? "pause" : "play"}
                label={replaceOn ? "暂停" : "播放"}
                prominence="regular"
                onClick={() => setReplaceOn((v) => !v)}
              />
              <IconButton icon="sync" label="同步中（Breathe）" activity />
              <span className="t-callout">
                Magic Replace（Play↔Pause 同位置切换）· Breathe（持续活动）
              </span>
            </div>
            <Rationale
              rows={[
                ["Apple Fact", "Make motion optional；Let people cancel motion（HIG Motion）"],
                ["OLOS Decision", "Toast hover 暂停自动消失计时；error/warning 用 role=alert"],
                ["Motion Lab", "快速切换按钮=真实 Interrupt 测试；系统设置或开发者工具切 reduced-motion 后观察降级"],
              ]}
            />
          </div>
        </Section>

        <ToastRegion>
          {toasts.map((t) => (
            <Toast key={t.id} tone={t.tone} title={`通知 · ${t.tone}`} description="这是 Component Lab 的反馈样张。" onDismiss={() => removeToast(t.id)} />
          ))}
        </ToastRegion>

        <footer className="t-caption" style={{ textAlign: "center", padding: "var(--space-lg) 0" }}>
          Open Learning OS · Component Laboratory · Reference Components 完成度：6/10（余 SearchField · Toolbar · Sheet · CommandPalette）
        </footer>
      </div>
    </main>
  );
}
