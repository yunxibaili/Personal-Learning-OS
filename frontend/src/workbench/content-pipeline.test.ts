import { describe, expect, it } from "vitest";
import { parseBlocks } from "./NoteReader";
import { tokenizeLine, type TokKind } from "./CodeSurface";
import { RICH_NOTE, RICH_NOTE_CONTENT } from "../dev/richNoteFixture";

/**
 * Content Layer 渲染管线门禁（Phase 3B · 指令书 §1/§2 P0）。
 * 核心硬约束：canonical Markdown 的反斜杠语义在渲染管线中保持不变；
 * 数学定界符进入 math 节点；任何阶段不得产生 "￥" 伪影。
 */

describe("parseBlocks — Math 管线（指令书硬测试）", () => {
  it("行内 $\\frac{a}{b}$ 进入 math 节点且反斜杠保留", () => {
    const blocks = parseBlocks("The formula is $\\frac{a}{b}$.");
    const p = blocks.find((b) => b.t === "p") as { t: "p"; text: string };
    expect(p).toBeDefined();
    expect(p.text).toContain("$\\frac{a}{b}$");
    // 反斜杠语义保持：未被吞掉、未被替换为 ￥
    expect(p.text).not.toContain("￥");
    expect(p.text).not.toContain("\f");
  });

  it("$$ 块级数学（单行）→ math 节点", () => {
    const blocks = parseBlocks("$$\nE = mc^2\n$$");
    expect(blocks.some((b) => b.t === "math" && b.display && b.tex.includes("E = mc^2"))).toBe(true);
  });

  it("$$ 块级数学（单行同排）→ math 节点", () => {
    const blocks = parseBlocks("$$E = mc^2$$");
    expect(blocks.some((b) => b.t === "math" && b.display && b.tex.includes("E = mc^2"))).toBe(true);
  });

  it("\\[…\\] 块级数学 → math 节点", () => {
    const blocks = parseBlocks("\\[\nE = mc^2\n\\]");
    expect(blocks.some((b) => b.t === "math" && b.display && b.tex.includes("E = mc^2"))).toBe(true);
  });

  it("整条管线不产生 ￥ 伪影（DOM 输入源断言）", () => {
    const blocks = parseBlocks("$\\frac{a}{b}$ 与 $$x^2$$ 与 \\[y\\]");
    const all = JSON.stringify(blocks);
    expect(all).not.toContain("￥");
    expect(all).toContain("\\frac{a}{b}");
  });
});

describe("parseBlocks — wikilink 归一化不伤数学", () => {
  it("双转义 \\[\\[..\\]\\] → wikilink；单反斜杠数学定界符保留", () => {
    const md = "链接到 \\[\\[梯度下降\\]\\] 与公式 \\[x^2\\]";
    const blocks = parseBlocks(md);
    // 用原始 text 断言（JSON.stringify 会二次转义反斜杠，不能作为断言载体）
    const all = blocks.map((b) => ("text" in b ? b.text : "tex" in b ? b.tex : "")).join("\n");
    expect(all).toContain("[[梯度下降]]");
    expect(all).toContain("\\[x^2\\]");
    expect(all).not.toContain("￥");
  });
});

describe("parseBlocks — 表格", () => {
  it("| a | b | + 分隔行 → table 节点", () => {
    const blocks = parseBlocks("| 优化器 | 特点 |\n| --- | --- |\n| Adam | 自适应 |\n| SGD | 噪声大 |");
    const t = blocks.find((b) => b.t === "table") as { t: "table"; rows: string[][] };
    expect(t).toBeDefined();
    expect(t.rows[0]).toEqual(["优化器", "特点"]);
    expect(t.rows[1]).toEqual(["Adam", "自适应"]);
  });
});

describe("parseBlocks — code fence 带 language", () => {
  it("```ts → code 节点 + lang=ts", () => {
    const blocks = parseBlocks("```ts\nconst a = 1\n```");
    const c = blocks.find((b) => b.t === "code") as { t: "code"; text: string; lang?: string };
    expect(c.lang).toBe("ts");
    expect(c.text).toBe("const a = 1");
  });
});

describe("tokenizeLine — 语法 token 层级", () => {
  function kinds(line: string, lang = "ts"): Array<[string, TokKind]> {
    return tokenizeLine(line, lang, false).toks
      .filter((t) => t.k !== "plain")
      .map((t) => [t.v, t.k] as [string, TokKind]);
  }

  it("keyword / string / number / comment 分层", () => {
    const toks = kinds('const x = 42 // magic');
    const map = Object.fromEntries(toks);
    expect(map["const"]).toBe("kw");
    expect(map["42"]).toBe("num");
    expect(toks.some(([v, k]) => k === "com" && v.includes("magic"))).toBe(true);
  });

  it("type / function-call 区分", () => {
    const toks = kinds("function gradientStep(theta: number[]): number[]");
    const map = Object.fromEntries(toks);
    expect(map["function"]).toBe("kw");
    expect(map["gradientStep"]).toBe("fn");
    expect(map["number"]).toBe("type");
  });

  it("python 关键字表生效", () => {
    const toks = kinds("def train(model):", "py");
    const map = Object.fromEntries(toks);
    expect(map["def"]).toBe("kw");
  });
});

describe("真实长文 fixture（Real Content Rule）", () => {
  it("1200+ 字、含 math/code/wikilink 的完整解析", () => {
    expect(RICH_NOTE.content_md.length).toBeGreaterThan(1000);
    const blocks = parseBlocks(RICH_NOTE_CONTENT);
    expect(blocks.some((b) => b.t === "code" && b.lang === "ts")).toBe(true);
    expect(blocks.some((b) => b.t === "math")).toBe(true);
    expect(JSON.stringify(blocks)).not.toContain("￥");
  });
});
