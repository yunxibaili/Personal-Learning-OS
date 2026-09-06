/// <reference types="node" />
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Design Foundation 源码门禁（UI-REBUILD-DESIGN-AUDIT §3 / ADR-013 §2.7.1）。
 * 注意：rolldown-vite 下 CSS 的 `?raw` 导入返回空串，故这里用 fs 直读源文件；
 * triple-slash 显式引入 node 类型（tsconfig.app 的 types 数组只放行 vite/client）。
 *
 * 守护三件事：
 * 1. token 清单完整（指令书 §4 的最低集合必须存在）；
 * 2. ADR-013 §2.7.1 的 Liquid Glass 范围（backdrop-filter 仅限 glass/popover/sheet）；
 * 3. reduced-motion 全局降级必须存在。
 */

const designDir = fileURLToPath(new URL(".", import.meta.url));

function css(name: string): string {
  return readFileSync(`${designDir}${name}`, "utf-8");
}

const REQUIRED_TOKENS = [
  "--color-background",
  "--color-surface",
  "--color-surface-elevated",
  "--color-surface-glass",
  "--color-text-primary",
  "--color-text-secondary",
  "--color-text-tertiary",
  "--color-border-subtle",
  "--color-accent",
  "--color-success",
  "--color-warning",
  "--color-error",
  "--radius-xs",
  "--radius-sm",
  "--radius-md",
  "--radius-lg",
  "--radius-xl",
  "--radius-capsule",
  "--space-xs",
  "--space-sm",
  "--space-md",
  "--space-lg",
  "--measure-reading",
];

describe("design tokens 清单完整性", () => {
  const tokens = css("tokens.css");

  it.each(REQUIRED_TOKENS)("%s 必须定义在 tokens.css", (token) => {
    expect(tokens).toContain(`${token}:`);
  });

  it("motion token 必须定义在 motion.css（分层：时长/缓动归 motion）", () => {
    const motion = css("motion.css");
    for (const token of [
      "--motion-instant",
      "--motion-fast",
      "--motion-standard",
      "--motion-slow",
      "--motion-spatial",
      "--ease-standard",
    ]) {
      expect(motion).toContain(`${token}:`);
    }
  });

  it("typography 必须提供阅读双尺度（17px/1.75）", () => {
    const t = css("typography.css");
    expect(t).toContain("--text-reading: 17px");
    expect(t).toContain("--lh-reading: 1.75");
  });

  it("阅读度量 680px：token 在 tokens.css，消费 class 在 layout.css", () => {
    expect(css("tokens.css")).toContain("--measure-reading: 680px");
    expect(css("layout.css")).toContain(".measure-reading");
  });
});

describe("Liquid Glass 范围守护（ADR-013 §2.7.1）", () => {
  const surfaces = css("surfaces.css");

  it("backdrop-filter 只允许出现在 glass / popover / sheet 三个 surface 中", () => {
    const blocks = surfaces.split(/(?=\.surface-)/g).filter((b) => b.startsWith(".surface-"));
    const allowed = new Set([".surface-glass", ".surface-popover", ".surface-sheet"]);
    const offenders = blocks
      .filter((b) => b.includes("backdrop-filter"))
      .map((b) => b.slice(0, b.indexOf("{")).trim())
      .filter((name) => !allowed.has(name));
    expect(offenders).toEqual([]);
  });

  it("glass/popover/sheet 必须真实定义 backdrop-filter（材质不能只留在注释里）", () => {
    for (const name of ["surface-glass", "surface-popover", "surface-sheet"]) {
      const block = surfaces.split(/(?=\.surface-)/g).find((b) => b.startsWith(`.${name}`));
      expect(block, `${name} 缺失`).toBeDefined();
      expect(block).toContain("backdrop-filter");
    }
  });

  it("decor 禁令：design/ 全目录不得引入 gradient/text-shadow 装饰", () => {
    const all = ["tokens.css", "typography.css", "surfaces.css", "motion.css", "layout.css"]
      .map((f) => css(f))
      .join("\n");
    expect(all).not.toMatch(/linear-gradient|radial-gradient/);
    expect(all).not.toMatch(/text-shadow/);
  });
});

describe("Motion 可达性", () => {
  it("motion.css 必须全局响应 prefers-reduced-motion", () => {
    const m = css("motion.css");
    expect(m).toContain("prefers-reduced-motion: reduce");
    expect(m).toContain("transition-duration: 0.01ms");
    expect(m).toContain("animation-duration: 0.01ms");
  });
});

describe("Playground 与入口接线", () => {
  it("index.css 必须按固定顺序汇总五个基础文件", () => {
    const index = css("index.css");
    const order = ["tokens.css", "typography.css", "motion.css", "surfaces.css", "layout.css"];
    let last = -1;
    for (const file of order) {
      const at = index.indexOf(`./${file}`);
      expect(at, `index.css 缺少 ${file}`).toBeGreaterThan(last);
      last = at;
    }
  });

  it("DesignPlayground 必须存在并消费 surface 语义 class", () => {
    const tsx = readFileSync(`${designDir}DesignPlayground.tsx`, "utf-8");
    for (const cls of ["surface-base", "surface-raised", "surface-glass", "surface-immersive"]) {
      expect(tsx).toContain(cls);
    }
    expect(tsx).toContain('data-surface="immersive"');
  });

  it("App.tsx 必须以 ?design 查询参数分流 Playground（dev-only 入口）", () => {
    const app = readFileSync(`${designDir}../App.tsx`, "utf-8");
    expect(app).toContain('has("design")');
    expect(app).toContain("DesignPlayground");
  });
});
