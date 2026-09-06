/// <reference types="node" />
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Reference Components 源码门禁（UI-COMPONENT-BEHAVIOR-MATRIX / UI-MOTION-SPEC）。
 * 模式：fs 直读源码做纯文本断言（rolldown-vite 下 CSS ?raw 为空）。
 * 守护：状态完备性、glass 纪律、动效红线、依赖红线、可交互性。
 */

const uiDir = fileURLToPath(new URL(".", import.meta.url));
// ui/ → components/ → src/ → frontend/ → 仓库根
const feRoot = `${uiDir}../../../../`;

function read(rel: string): string {
  return readFileSync(`${feRoot}${rel}`, "utf-8");
}

describe("Button（矩阵 §1）", () => {
  const css = read("frontend/src/components/ui/ui-components.css");
  it("press state 必须存在（[A] 强制）", () => {
    expect(css).toContain(".btn:active");
    expect(css).toContain("scale(0.97)");
  });
  it("focus-visible 必须存在", () => {
    expect(css).toContain(".btn:focus-visible");
  });
  it("disabled 必须存在", () => {
    expect(css).toContain(".btn[disabled]");
  });
  it("五种 prominence 齐全", () => {
    for (const p of ["prominent", "regular", "plain", "destructive", "glass"]) {
      expect(css).toContain(`.btn--${p}`);
    }
  });
  it("loading spinner 存在且用动画", () => {
    expect(css).toContain(".btn__spinner");
    expect(css).toContain("@keyframes btn-spin");
  });
  it("命中区 ≥44px（[A]）", () => {
    expect(css).toContain("min-height: 44px");
  });
  it("spring token 被 press 消费（transform → spring）", () => {
    expect(css).toContain("var(--spring-snappy)");
  });
});

describe("Tabs / SegmentedControl（矩阵 §3–4：selection continuity）", () => {
  const tabs = read("frontend/src/components/ui/Tabs.tsx");
  const seg = read("frontend/src/components/ui/SegmentedControl.tsx");
  const css = read("frontend/src/components/ui/ui-components.css");

  it("单一指示器实体存在（同一元素移动，非旧隐新现）", () => {
    expect(css).toContain(".tabs2__indicator");
    expect(css).toContain(".seg__capsule");
  });
  it("指示器用 transform+width 过渡（FLIP 可 retarget）", () => {
    expect(css).toContain("transition: transform var(--motion-standard) var(--spring-gentle)");
  });
  it("Tabs 键盘可达（方向键/Home/End + aria-selected）", () => {
    expect(tabs).toContain("ArrowRight");
    expect(tabs).toContain("Home");
    expect(tabs).toContain("End");
    expect(tabs).toContain('role="tablist"');
    expect(tabs).toContain("aria-selected");
  });
  it("ResizeObserver 支持（宽度 morph）", () => {
    expect(tabs).toContain("ResizeObserver");
    expect(seg).toContain("ResizeObserver");
  });
});

describe("Popover（矩阵 §7：Material Reference 母版）", () => {
  const tsx = read("frontend/src/components/ui/Popover.tsx");
  const css = read("frontend/src/components/ui/ui-components.css");

  it("materialize 模型非纯 fade（scale/blur/位移协同）", () => {
    expect(css).toContain("@keyframes popover-materialize");
    expect(css.match(/popover-materialize[\s\S]*?blur\(2px\)/)).not.toBeNull();
  });
  it("Esc + outside click + focus restoration 齐全", () => {
    expect(tsx).toContain("Escape");
    expect(tsx).toContain("pointerdown");
    expect(tsx).toContain("focus()"); // restoration
  });
  it("focus trap（Tab 循环）", () => {
    expect(tsx).toContain("shiftKey");
  });
  it("glass-regular 材质 + backdrop-filter（functional layer [A]）", () => {
    expect(css.match(/\.popover\s*\{[\s\S]*?backdrop-filter/)).not.toBeNull();
  });
  it("reduced-motion 降级：60ms opacity 快切（非全零）", () => {
    expect(css).toContain("popover-materialize-rm");
    expect(css).toContain("60ms linear");
  });
  it("portal 渲染（浮层语义）", () => {
    expect(tsx).toContain("createPortal");
  });
});

describe("Toast（矩阵 §10）", () => {
  const tsx = read("frontend/src/components/ui/Toast.tsx");
  const css = read("frontend/src/components/ui/ui-components.css");
  it("四语义 tone 齐全且状态色唯一作用于左边条", () => {
    for (const t of ["success", "info", "warning", "error"]) expect(css).toContain(`.toast--${t}`);
    expect(css).toContain("border-left: 3px solid var(--toast-tone");
  });
  it("hover 暂停自动消失（[A] Let people cancel motion）", () => {
    expect(tsx).toContain("onMouseEnter={pauseTimer}");
    expect(tsx).toContain("onMouseLeave={startTimer}");
  });
  it("role 语义：error/warning=alert，其余=status", () => {
    expect(tsx).toContain('"alert"');
    expect(tsx).toContain('"status"');
  });
  it("dissolve 离场", () => {
    expect(css).toContain("toast-dissolve");
    expect(tsx).toContain("is-leaving");
  });
});

describe("依赖红线（指令书 §36）", () => {
  const pkg = read("frontend/package.json");
  it("不得引入大型 UI/动画框架", () => {
    for (const dep of ["framer-motion", "@mui", "antd", "@chakra-ui", "tailwindcss", "@radix-ui", "shadcn"]) {
      expect(pkg).not.toContain(`"${dep}"`);
    }
  });
});

describe("Playground 接线", () => {
  const app = read("frontend/src/App.tsx");
  it("?design=components → ComponentLab；?design → Foundation", () => {
    expect(app).toContain('"components"');
    expect(app).toContain("ComponentLab");
    expect(app).toContain("DesignPlayground");
  });
});
