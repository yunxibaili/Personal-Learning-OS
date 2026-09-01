/**
 * 词法着色测试（M9-005）
 *
 * 零依赖实现，但要能扛住真实示例源码：着色错一格就会整行错位，
 * 所以用例直接取后端示例文件里真实存在的写法。
 */
import { describe, expect, it } from "vitest";
import { tokenizePython, tokenizePythonLine } from "./highlight";

/** 取某类记号的全部文本，便于断言 */
const pick = (line: string, kind: string) =>
  tokenizePythonLine(line)
    .tokens.filter((t) => t.kind === kind)
    .map((t) => t.text);

describe("tokenizePythonLine", () => {
  it("关键字识别", () => {
    expect(pick("def factorial(n):", "keyword")).toEqual(["def"]);
    expect(pick("    if n <= 1:", "keyword")).toEqual(["if"]);
    expect(pick("    return 1", "keyword")).toEqual(["return"]);
    expect(pick("for i in range(n):", "keyword")).toEqual(["for", "in"]);
  });

  it("def 后的函数名单独着色（不是普通标识符）", () => {
    const tokens = tokenizePythonLine("def factorial(n):").tokens;
    expect(tokens[2]).toEqual({ text: "factorial", kind: "defname" });
  });

  it("class 后的类名同样着色", () => {
    const tokens = tokenizePythonLine("class Node:").tokens;
    expect(tokens[2]).toEqual({ text: "Node", kind: "defname" });
  });

  it("数字（含浮点与下标访问）", () => {
    expect(pick("mid = (lo + hi) // 2", "number")).toEqual(["2"]);
    expect(pick("x = 3.14", "number")).toEqual(["3.14"]);
  });

  it("字符串用单引号与双引号都可", () => {
    expect(pick("name = 'abc'", "string")).toEqual(["'abc'"]);
    expect(pick('name = "abc"', "string")).toEqual(['"abc"']);
  });

  it("注释到行尾，且注释里的关键字不再着色", () => {
    const tokens = tokenizePythonLine("return 1  # base case: if n == 0").tokens;
    const comment = tokens.find((t) => t.kind === "comment");
    expect(comment).toBeDefined();
    expect(comment!.text).toBe("# base case: if n == 0");
    expect(pick("return 1  # if n == 0", "keyword")).toEqual(["return"]);
  });

  it("注释里的引号不会开启字符串状态", () => {
    const { tokens, next } = tokenizePythonLine("x = 1  # don't stop");
    expect(next).toBe("none");
    expect(tokens.some((t) => t.kind === "string")).toBe(false);
  });

  it("关键字按整词匹配，不做前缀匹配（iff 不是 if）", () => {
    expect(pick("iff = 1", "keyword")).toEqual([]);
    // 记号默认合并，故按拼接后的文本断言
    expect(pick("iff = 1", "plain").join("")).toContain("iff");
    expect(pick("if x:", "keyword")).toEqual(["if"]);
  });

  it("相邻同类记号合并，避免渲染出成百上千个 span", () => {
    const tokens = tokenizePythonLine("    return n * factorial(n - 1)").tokens;
    // 缩进的 4 个空格应合并为 1 个 plain 记号
    expect(tokens[0]).toEqual({ text: "    ", kind: "plain" });
  });
});

describe("tokenizePython · 跨行三引号 docstring", () => {
  it("docstring 跨行延续，闭合后回到正常着色", () => {
    const source = [
      "def f():",
      '    """说明',
      "    第二行",
      '    """',
      "    return 1",
    ].join("\n");
    const lines = tokenizePython(source);
    expect(lines[2][0].kind).toBe("string"); // 说明
    expect(lines[3][0].kind).toBe("string"); // 第二行（仍在字符串内）
    expect(pick("    return 1", "keyword")).toEqual(["return"]);
    // 闭合之后的 return 必须正常着色
    expect(lines[4].some((t) => t.kind === "keyword")).toBe(true);
  });

  it("未闭合的三引号把后续行都当字符串，不会把整份代码染成字符串", () => {
    const lines = tokenizePython('s = """\nabc\n');
    expect(lines[1][0].kind).toBe("string");
  });

  it("单引号字符串跨行（未闭合）同样延续", () => {
    const lines = tokenizePython("s = 'abc\ndef f():\n");
    expect(lines[1][0].kind).toBe("string");
  });
});

describe("tokenizePython · 真实源码不丢字符", () => {
  it("着色后的文本拼接起来必须等于原文（不吞字符、不多字符）", () => {
    const source = [
      "def quicksort(arr, lo, hi):",
      "    if lo >= hi:",
      "        return",
      "    p = partition(arr, lo, hi)  # pivot",
      "    quicksort(arr, lo, p - 1)",
    ].join("\n");
    const lines = tokenizePython(source);
    expect(lines).toHaveLength(5);
    lines.forEach((tokens, i) => {
      expect(tokens.map((t) => t.text).join("")).toBe(source.split("\n")[i]);
    });
  });

  it("空行得到空记号数组，不抛错", () => {
    expect(tokenizePythonLine("").tokens).toEqual([]);
  });
});
