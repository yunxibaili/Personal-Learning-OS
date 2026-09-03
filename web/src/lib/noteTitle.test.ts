import { describe, expect, it } from "vitest";

import { displayNoteTitle } from "./noteTitle";

describe("displayNoteTitle", () => {
  it("正常标题原样返回", () => {
    expect(displayNoteTitle("机器学习", 1)).toBe("机器学习");
    expect(displayNoteTitle("Adam优化器", 3)).toBe("Adam优化器");
  });

  it("占位标题（未命名笔记 + 数字后缀）降级并保留 id", () => {
    expect(displayNoteTitle("未命名笔记 193159", 6)).toBe("未命名笔记 · #6");
    expect(displayNoteTitle("未命名笔记193159", 7)).toBe("未命名笔记 · #7");
  });

  it("空 / 纯空白标题降级", () => {
    expect(displayNoteTitle("", 8)).toBe("未命名笔记 · #8");
    expect(displayNoteTitle("   ", 9)).toBe("未命名笔记 · #9");
  });

  it("null / undefined 降级", () => {
    expect(displayNoteTitle(null, 10)).toBe("未命名笔记 · #10");
    expect(displayNoteTitle(undefined, 11)).toBe("未命名笔记 · #11");
  });

  it("纯数字（ID 形态）标题降级", () => {
    expect(displayNoteTitle("193159", 12)).toBe("未命名笔记 · #12");
  });

  it("正常标题前后空格被 trim（不因空格误判为占位）", () => {
    expect(displayNoteTitle("  梯度下降  ", 2)).toBe("梯度下降");
  });

  it("不被误伤：含数字的正常标题原样保留", () => {
    expect(displayNoteTitle("GPT-4 时代", 13)).toBe("GPT-4 时代");
    expect(displayNoteTitle("第 3 章", 14)).toBe("第 3 章");
  });

  it("降级文案中的 id 唯一（不同 id 文案不同）", () => {
    expect(displayNoteTitle("未命名笔记 1", 20)).not.toBe(
      displayNoteTitle("未命名笔记 1", 21),
    );
  });
});
