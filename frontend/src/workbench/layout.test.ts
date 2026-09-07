import { describe, expect, it } from "vitest";
import { computeLayout } from "./layout";

/**
 * 3C-1 布局引擎门禁（D-01 修订）。
 * Owner 修正 1：680 是阅读度量目标，不是无条件物理最小宽度；
 * Context / Explorer 是可让位 pane；Work Surface 优先级最高。
 */

describe("Focus (S4) — 只留 Work Surface", () => {
  it("Focus 下 Explorer/Context 均让位（none）", () => {
    const p = computeLayout({ explorer: true, context: true, compare: false, focus: true, width: 1440 });
    expect(p.explorerMode).toBe("none");
    expect(p.contextMode).toBe("none");
    expect(p.areas).toBe('"rail surface"');
  });
});

describe("Compare (S3) — 连续双工作场", () => {
  it("Compare 下均分两列，Context 让位（S3 隐藏 Context 以保持 quiet）", () => {
    const p = computeLayout({ explorer: false, context: true, compare: true, focus: false, width: 1920 });
    expect(p.columns).toContain("minmax(0, 1fr) minmax(0, 1fr)");
    expect(p.contextMode).toBe("none");
  });
});

describe("Context-only — P0 修复（不得再塌陷为 264px）", () => {
  it("1440 仅开 Context：surface 为 1fr，context 为独立列", () => {
    const p = computeLayout({ explorer: false, context: true, compare: false, focus: false, width: 1440 });
    expect(p.areas).toBe('"rail surface context"');
    expect(p.contextMode).toBe("column");
    // Work Surface = 1440 - 52 - 320 = 1068（远大于旧的 264）
    const surface = 1440 - p.railWidth - 320;
    expect(surface).toBeGreaterThan(1000);
  });

  it("2560 仅开 Context：Work Surface 仍为主列", () => {
    const p = computeLayout({ explorer: false, context: true, compare: false, focus: false, width: 2560 });
    const surface = 2560 - p.railWidth - 320;
    expect(surface).toBeGreaterThan(2000);
  });
});

describe("Explorer + Context 同时开启 — 让位规则", () => {
  it("1280 宽度不足 → Context 让位为抽屉，Work Surface 不被压到 680 以下", () => {
    const p = computeLayout({ explorer: true, context: true, compare: false, focus: false, width: 1280 });
    expect(p.explorerMode).toBe("column");
    expect(p.contextMode).toBe("drawer");
    const surface = 1280 - p.railWidth - 264;
    expect(surface).toBeGreaterThan(900);
  });

  it("1920 空间充足 → 两者皆可成列", () => {
    const p = computeLayout({ explorer: true, context: true, compare: false, focus: false, width: 1920 });
    expect(p.explorerMode).toBe("column");
    expect(p.contextMode).toBe("column");
    expect(p.areas).toBe('"rail explorer surface context"');
  });
});

describe("Reading measure 策略", () => {
  it("≥1920 放宽至 760；<1920 目标 680", () => {
    expect(computeLayout({ explorer: false, context: false, compare: false, focus: false, width: 1920 }).readerMeasure).toBe(760);
    expect(computeLayout({ explorer: false, context: false, compare: false, focus: false, width: 1440 }).readerMeasure).toBe(680);
  });

  it("768 窄屏：仍保持 Work Surface 单列（抽屉化由 CSS 负责）", () => {
    const p = computeLayout({ explorer: false, context: true, compare: false, focus: false, width: 768 });
    expect(p.areas).toContain("surface");
  });
});
