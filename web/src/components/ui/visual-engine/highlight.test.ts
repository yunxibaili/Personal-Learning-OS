/**
 * ui/visual-engine/highlight.test.ts
 *
 * Python 行级词法着色单测。
 * 重点覆盖：跨行三引号、关键字、注释、数字、字符串、单引号/双引号区分。
 */
import { describe, it, expect } from "vitest";
import { tokenizePython, tokenizePythonLine } from "./highlight";

function flatten(line: ReturnType<typeof tokenizePythonLine>["tokens"]): string {
  return line.map((t) => t.text).join("");
}

describe("tokenizePythonLine · 关键字 + 数字 + 标识符", () => {
  it("关键字 + defname + 括号/冒号合并", () => {
    // "def foo():" → def(keyword) + space(plain) + foo(defname) + ():(plain) → 4 token
    const r = tokenizePythonLine("def foo():");
    expect(r.tokens.map((t) => t.kind)).toEqual(["keyword", "plain", "defname", "plain"]);
  });
  it("x = 3.14 → 标识符合并 + 数字", () => {
    // "x = 3.14" → x = 合并为 plain，3.14 为 number → 2 token
    const r = tokenizePythonLine("x = 3.14");
    expect(r.tokens.map((t) => t.kind)).toEqual(["plain", "number"]);
  });
  it("注释到行尾", () => {
    const r = tokenizePythonLine("x = 1  # 注释");
    expect(r.tokens[r.tokens.length - 1].kind).toBe("comment");
    expect(flatten(r.tokens)).toBe("x = 1  # 注释");
  });
});

describe("tokenizePythonLine · 字符串", () => {
  it("单引号字符串", () => {
    const r = tokenizePythonLine("x = 'hi'");
    const stringTok = r.tokens.find((t) => t.kind === "string");
    expect(stringTok?.text).toBe("'hi'");
  });
  it("双引号字符串", () => {
    const r = tokenizePythonLine('x = "hi"');
    const stringTok = r.tokens.find((t) => t.kind === "string");
    expect(stringTok?.text).toBe('"hi"');
  });
  it("行内未闭合单引号串 → state 传 's'", () => {
    const r = tokenizePythonLine("x = 'hello");
    expect(r.next).toBe("s");
  });
  it("行内未闭合双引号串 → state 传 'd'", () => {
    const r = tokenizePythonLine('x = "hello');
    expect(r.next).toBe("d");
  });
});

describe("tokenizePythonLine · 三引号 docstring 跨行", () => {
  it("单行三引号闭合", () => {
    const r = tokenizePythonLine('"""docstring"""');
    expect(r.next).toBe("none");
    expect(r.tokens[0].kind).toBe("string");
    expect(r.tokens[0].text).toBe('"""docstring"""');
  });
  it("跨行未闭合 → 第一行 next='d'", () => {
    const r = tokenizePythonLine('"""开始 doc');
    expect(r.next).toBe("d");
  });
  it("传入 state='d' 第二行合并直到闭合", () => {
    const lines = ['"""开始', "still doc", 'end"""', "x = 1"];
    const all: string[][] = [];
    let state: "none" | "s" | "d" = "none";
    lines.forEach((line) => {
      const r = tokenizePythonLine(line, state);
      state = r.next;
      all.push(r.tokens.map((t) => t.text));
    });
    // 第一行 + 第二行 + 第三行（直到闭合）合并为一条 string
    const strings = all.flat().filter((t) => t.length > 0);
    expect(strings.join("")).toContain("开始");
    expect(strings.join("")).toContain("still doc");
    expect(strings.join("")).toContain('end"""');
    // 第四行 state 应回到 none
    expect(state).toBe("none");
  });
});

describe("tokenizePython · 多行源码", () => {
  it("三行源码各自返回 token 数组", () => {
    const src = "def f():\n    return 1\n";
    const out = tokenizePython(src);
    expect(out).toHaveLength(3);
    expect(out[0].map((t) => t.kind)).toContain("keyword");
    expect(out[1].map((t) => t.kind)).toContain("number");
  });

  it("跨行 docstring 跨行整段染色为 string", () => {
    const src = '"""line1\nline2\nline3"""\nx = 1\n';
    const out = tokenizePython(src);
    // 第 0 行：开三引号 + line1，整行 string
    expect(out[0].some((t) => t.kind === "string")).toBe(true);
    // 第 1 行：docstring 中间，整行 string
    expect(out[1].some((t) => t.kind === "string")).toBe(true);
    expect(out[1].every((t) => t.kind === "string")).toBe(true);
    // 第 2 行：line3 + 闭三引号，整行 string
    expect(out[2].some((t) => t.kind === "string")).toBe(true);
    // 第 3 行：x = 1（已出 docstring），含 plain + number
    expect(out[3].some((t) => t.kind === "number")).toBe(true);
    expect(out[3].some((t) => t.kind === "plain")).toBe(true);
  });
});