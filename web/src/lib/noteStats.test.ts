import { describe, expect, it } from "vitest";

import { computeNoteStats } from "./noteStats";

describe("computeNoteStats", () => {
  it("空字符串", () => {
    const s = computeNoteStats("");
    expect(s.chars).toBe(0);
    expect(s.wikilinks).toBe(0);
    expect(s.formulas).toBe(0);
    expect(s.codeBlocks).toBe(0);
    expect(s.readingMin).toBe(1); // 最低 1 分钟
  });

  it("纯文本", () => {
    const s = computeNoteStats("这是一段测试文本。");
    expect(s.chars).toBe(9);
    expect(s.wikilinks).toBe(0);
    expect(s.readingMin).toBe(1);
  });

  it("双链计数", () => {
    const s = computeNoteStats("核心优化[[梯度下降]]与[[Adam优化器]]。");
    expect(s.wikilinks).toBe(2);
  });

  it("公式计数（行内 + 块级）", () => {
    const s = computeNoteStats("行内 $E=mc^2$ 和块级 $$\\int_0^1 f(x)dx$$");
    expect(s.formulas).toBe(2);
  });

  it("代码块计数", () => {
    const s = computeNoteStats("```python\nprint('hello')\n```\n正文。");
    expect(s.codeBlocks).toBe(1);
  });

  it("阅读时间随字数增长", () => {
    const short = computeNoteStats("短文");
    const long = computeNoteStats("长".repeat(2000));
    expect(short.readingMin).toBe(1);
    expect(long.readingMin).toBeGreaterThan(1);
  });
});
