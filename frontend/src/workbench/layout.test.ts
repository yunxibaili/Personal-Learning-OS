import { describe, expect, it } from "vitest";
import { computeLayout } from "./layout";

describe("computeLayout — VS Code 式紧凑布局", () => {
  it("默认：Rail + Surface（无 Explorer）", () => {
    const p = computeLayout({ explorer: false, split: false, focus: false, width: 1440 });
    expect(p.explorerVisible).toBe(false);
    expect(p.explorerWidth).toBe(0);
    expect(p.splitActive).toBe(false);
  });

  it("Explorer 开启：240px 侧栏", () => {
    const p = computeLayout({ explorer: true, split: false, focus: false, width: 1440 });
    expect(p.explorerVisible).toBe(true);
    expect(p.explorerWidth).toBe(240);
  });

  it("Focus：Rail 收缩 + 无 Explorer", () => {
    const p = computeLayout({ explorer: true, split: false, focus: true, width: 1440 });
    expect(p.railWidth).toBe(48);
    expect(p.explorerVisible).toBe(false);
  });

  it("≥1920 阅读度量放宽到 760", () => {
    expect(computeLayout({ explorer: false, split: false, focus: false, width: 1920 }).readerMeasure).toBe(760);
    expect(computeLayout({ explorer: false, split: false, focus: false, width: 1440 }).readerMeasure).toBe(680);
  });
});
