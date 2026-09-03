/**
 * HomeHero（P1-12-B1 / Bright UI Assembly G1）：
 * 产品入口页 —— 按 ui/home-hero.html 定稿排版在 React 中实现。
 *
 * 视觉合同 = ui/home-hero.html：
 *   nav（brand + links + CTA）
 *   hero .container（grid: 1.05fr 1fr）
 *     .text：eyebrow → h1(accent) → lede → cta-row → meta
 *     .earth-wrap：canvas(dot-earth) + 3 float-chip
 *   why 3 列
 *
 * 约束（所有者 P1-12-A 裁决）：
 *   - 不重新设计 / 不新增依赖 / 不改后端 / 不改数据模型
 *   - 地球 = GalaxyCanvas（引擎逐字移植自本 HTML 的地球），planet=null → 无卫星无轨道
 *   - ADR-013 §2.7 禁 gradient → .btn-primary 用实底（global.css 已有 .btn-primary 纯色）
 *   - 动效默认无；浮动 chip 保留（home-hero.html 原生设计，非 P1 新增）
 */
import { GalaxyCanvas } from "../components/galaxy/GalaxyCanvas";
import { useUi } from "../stores/ui";

const FEATURES = [
  { title: "100% 本地", desc: "你的数据，你的设备" },
  { title: "开源", desc: "Apache-2.0 协议" },
  { title: "记忆感知 AI", desc: "知道你学过什么" },
] as const;

export function HomeHero() {
  const setActiveView = useUi((s) => s.setActiveView);

  return (
    <div className="home-hero">
      {/* 顶栏（home-hero.html .nav 原型：brand + links + CTA） */}
      <nav className="home-hero__nav">
        <button
          type="button"
          className="home-hero__brand"
          aria-label="Open Learning OS"
        >
          <span className="home-hero__brand-dot" />
          <span>Open Learning OS</span>
        </button>
        <div className="home-hero__links">
          <button type="button" onClick={() => setActiveView("settings")}>设置</button>
        </div>
        <button
          type="button"
          className="home-hero__nav-cta"
          onClick={() => setActiveView("notes")}
        >
          开始学习 →
        </button>
      </nav>

      {/* Hero 区（.hero .container grid: text + earth） */}
      <section className="home-hero__section">
        <div className="home-hero__text">
          <span className="home-hero__eyebrow">v0.1 · Bright Baseline</span>
          <h1 className="home-hero__h1">
            学习，是与
            <span className="home-hero__accent">知识</span>
            <br />
            同行的过程。
          </h1>
          <p className="home-hero__lede">
            本地优先的 AI 学习操作系统：你的 Markdown 笔记、双链知识图谱、
            四维掌握度、记忆感知 Tutor，全部在你的设备上。
          </p>
          <div className="home-hero__cta-row">
            <button
              type="button"
              className="home-hero__cta-primary"
              onClick={() => setActiveView("notes")}
            >
              立即开始 →
            </button>
          </div>
          <div className="home-hero__meta">
            {FEATURES.map((f) => (
              <div key={f.title}>
                <b>{f.title}</b>
                {f.desc}
              </div>
            ))}
          </div>
        </div>

        <div className="home-hero__earth-wrap">
          {/* dot-earth：planet=null → 无卫星无轨道，只有点阵球体自转。
              引擎 = GalaxyCanvas（逐字移植自 ui/home-hero.html 的地球）。 */}
          <GalaxyCanvas size={480} planet={null} animate />
          <div className="home-hero__chip home-hero__chip--tl">
            <span className="home-hero__chip-dot" />
            微积分 · 极限
          </div>
          <div className="home-hero__chip home-hero__chip--tr">
            <span className="home-hero__chip-dot home-hero__chip-dot--ink" />
            掌握度 72%
          </div>
          <div className="home-hero__chip home-hero__chip--bl">
            <span className="home-hero__chip-dot home-hero__chip-dot--green" />
            已复习 12 / 14
          </div>
        </div>
      </section>
    </div>
  );
}
