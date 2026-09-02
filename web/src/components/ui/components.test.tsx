/**
 * 组件层：结构 + 派生数值断言（零新增依赖）。
 *
 * 用 `react-dom/server` 的 renderToStaticMarkup 渲染静态标记后做字符串断言，
 * **不引入 @testing-library / jsdom**——项目红线是「无理由不加依赖」，
 * 而这里要验的全是结构与派生数值（dashoffset → 比例、aria-valuenow → 钳制、
 * variant → 类名），都不是交互，静态渲染足够，也更快更稳。
 *
 * 交互侧（点击切换 tab、toast 推送、IntersectionObserver 入场）由
 * `wiring.test.ts` 以源码接线审计覆盖，不做 DOM 模拟。
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";

import { Badge, Button, Progress, Skeleton, Tabs } from "./index";
import { CountUp, FadeInUp, ProgressRing } from "../motion";

/** ProgressRing：viewBox 140 基准，stroke 10 → r=60 */
const R = 60;
const CIRC = 2 * Math.PI * R;

/** 取标记里某个属性的值（取首个命中；调用点需保证该属性唯一或首个即为目标） */
function attr(html: string, name: string): string | null {
  const m = new RegExp(`${name}="([^"]*)"`).exec(html);
  return m ? m[1] : null;
}

describe("Skeleton（三处加载态的形状来源）", () => {
  it("默认 text 变体高 12px，且对读屏隐藏（骨架只是形状，不是内容）", () => {
    const html = renderToStaticMarkup(<Skeleton />);
    expect(html).toContain("skel");
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("height:12px");
  });

  it("circle 变体未给 width 时以 height 为直径", () => {
    const html = renderToStaticMarkup(<Skeleton variant="circle" height={36} />);
    expect(html).toContain("width:36px");
    expect(html).toContain("height:36px");
  });

  it("显式 width/height 覆盖变体默认值（百分比宽度直接透传）", () => {
    const html = renderToStaticMarkup(<Skeleton variant="text" width="46%" height={26} />);
    expect(html).toContain("width:46%");
    expect(html).toContain("height:26px");
  });
});

describe("Progress（右栏掌握度的唯一视觉出口）", () => {
  it("role=progressbar 三件套 + label 齐全", () => {
    const html = renderToStaticMarkup(<Progress value={0.42} label="掌握度" />);
    expect(attr(html, "role")).toBe("progressbar");
    expect(attr(html, "aria-valuemin")).toBe("0");
    expect(attr(html, "aria-valuemax")).toBe("100");
    expect(attr(html, "aria-valuenow")).toBe("42");
    expect(attr(html, "aria-label")).toBe("掌握度");
  });

  it("越界值钳制到 0–100", () => {
    expect(attr(renderToStaticMarkup(<Progress value={-0.5} />), "aria-valuenow")).toBe("0");
    expect(attr(renderToStaticMarkup(<Progress value={1.8} />), "aria-valuenow")).toBe("100");
  });

  it("未给 tone 时按值自动取色：≥.7 ok / ≥.4 brand / 其余 err", () => {
    expect(renderToStaticMarkup(<Progress value={0.8} />)).toContain("ui-progress__bar--ok");
    expect(renderToStaticMarkup(<Progress value={0.5} />)).toContain("ui-progress__bar--brand");
    expect(renderToStaticMarkup(<Progress value={0.2} />)).toContain("ui-progress__bar--err");
  });
});

describe("Button（variant 映射 + ADR-013 §2.7 守卫）", () => {
  it("variant → 类名；缺省 secondary 不带修饰类", () => {
    expect(renderToStaticMarkup(<Button variant="primary" />)).toContain("btn-primary");
    expect(renderToStaticMarkup(<Button variant="ghost" />)).toContain("btn-ghost");
    expect(renderToStaticMarkup(<Button variant="danger" />)).toContain("btn-danger");
    expect(renderToStaticMarkup(<Button />)).toContain('class="btn"');
  });

  it("primary 不自带 gradient/glow 内联样式——渐变只能来自 CSS，而 CSS 已改纯色实底", () => {
    const html = renderToStaticMarkup(<Button variant="primary">x</Button>);
    expect(html).not.toContain("gradient");
    expect(html).not.toContain("box-shadow");
  });

  it("loading 时禁用并渲染 spinner（防重复提交）", () => {
    const html = renderToStaticMarkup(<Button loading>x</Button>);
    expect(html).toContain("disabled");
    expect(html).toContain("btn__spinner");
  });
});

describe("Tabs（右栏 tablist 的替代者）", () => {
  const tabs: Array<{ key: "outline" | "backlinks"; label: string; badge?: ReactNode }> = [
    { key: "outline", label: "大纲" },
    { key: "backlinks", label: "反链", badge: <Badge tone="brand">3</Badge> },
  ];
  const noop = () => undefined;

  it("容器 role=tablist，每项 role=tab（与旧手写版语义逐项等价）", () => {
    const html = renderToStaticMarkup(<Tabs tabs={tabs} value="outline" onChange={noop} />);
    expect(html).toContain('role="tablist"');
    expect((html.match(/role="tab"/g) ?? []).length).toBe(2);
  });

  it("aria-selected 恰有一个 true、一个 false", () => {
    const html = renderToStaticMarkup(<Tabs tabs={tabs} value="backlinks" onChange={noop} />);
    expect((html.match(/aria-selected="true"/g) ?? []).length).toBe(1);
    expect((html.match(/aria-selected="false"/g) ?? []).length).toBe(1);
    expect(html).toContain("ui-tabs__item--active");
  });

  it("badge 槽位落在对应 tab 内部（右栏反链计数靠它，换了组件不能丢）", () => {
    const html = renderToStaticMarkup(<Tabs tabs={tabs} value="outline" onChange={noop} />);
    // 容差 20 字符：SSR 可能在相邻子节点间插入注释分隔符
    expect(html).toMatch(/反链[\s\S]{0,20}<span class="ui-badge ui-badge--brand">3<\/span>/);
  });

  it("没给 badge 的 tab 不渲染空计数节点", () => {
    const html = renderToStaticMarkup(
      <Tabs tabs={[{ key: "outline", label: "大纲" }]} value="outline" onChange={noop} />,
    );
    expect(html).not.toContain("ui-badge");
  });

  it("className 作用于容器；子项类名固定，改样式请用后代选择器", () => {
    const html = renderToStaticMarkup(
      <Tabs className="ctx-rail__tabs" tabs={tabs} value="outline" onChange={noop} />,
    );
    expect(html).toContain('class="ui-tabs ctx-rail__tabs"');
    expect(html).toContain("ui-tabs__item");
  });
});

describe("ProgressRing（复习完成页的记忆保持率）", () => {
  it("dashoffset = 周长 × (1 - 比例)", () => {
    const html = renderToStaticMarkup(<ProgressRing value={0.25} label="记忆保持率" />);
    expect(Number(attr(html, "stroke-dasharray"))).toBeCloseTo(CIRC, 6);
    expect(Number(attr(html, "stroke-dashoffset"))).toBeCloseTo(CIRC * 0.75, 6);
  });

  it("越界钳制：≤0 → 满偏移；≥1 → 0 偏移", () => {
    const lo = renderToStaticMarkup(<ProgressRing value={-1} label="x" />);
    const hi = renderToStaticMarkup(<ProgressRing value={9} label="x" />);
    expect(Number(attr(lo, "stroke-dashoffset"))).toBeCloseTo(CIRC, 6);
    expect(Number(attr(hi, "stroke-dashoffset"))).toBeCloseTo(0, 6);
  });

  it("role=img + aria-label 传达含义，圆心数字是装饰性的补充", () => {
    const html = renderToStaticMarkup(<ProgressRing value={0.5} label="记忆保持率 3 / 6" />);
    expect(attr(html, "role")).toBe("img");
    expect(attr(html, "aria-label")).toBe("记忆保持率 3 / 6");
    expect(html).toContain(">50<");
  });
});

describe("CountUp（右栏「今日待复习 N」）", () => {
  it("首帧是 0——数字靠 IntersectionObserver 进视口后才滚", () => {
    expect(renderToStaticMarkup(<CountUp target={7} className="ctx-rail__count" />)).toMatch(
      /<span class="count ctx-rail__count">0<\/span>/,
    );
  });

  it("不给 className 时类名就是 count", () => {
    expect(renderToStaticMarkup(<CountUp target={7} />)).toMatch(/<span class="count">0<\/span>/);
  });
});

describe("FadeInUp（列表入场）", () => {
  it("包裹层 class=fade-target，初始不带 in（in 由 IntersectionObserver 加）", () => {
    const html = renderToStaticMarkup(
      <FadeInUp>
        <p>x</p>
      </FadeInUp>,
    );
    expect(html).toMatch(/<div class="fade-target"><p>x<\/p><\/div>/);
  });
});

describe("Badge", () => {
  it("tone 落到 ui-badge--{tone}", () => {
    expect(renderToStaticMarkup(<Badge tone="brand">3</Badge>)).toBe(
      '<span class="ui-badge ui-badge--brand">3</span>',
    );
  });
});
