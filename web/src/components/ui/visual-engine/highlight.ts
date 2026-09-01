/**
 * 极简 Python 词法着色（纯函数 · 零依赖 · 可单测）
 *
 * 为什么不引 highlight.js / shiki：红线「无理由不加依赖」，且我们只需要
 * Python 一种语言的 5 类记号。着色用的全部是项目既有令牌——**不引入新色相**，
 * 遵守 ADR-013 与 ADR-025 §3.6（橙只服务注意力指针，不用于静态分类）。
 *
 * 支持跨行的三引号字符串（docstring）：状态由调用方在行间传递。
 */
export type TokenKind =
  | "plain"
  | "keyword"
  | "string"
  | "comment"
  | "number"
  | "defname";

export interface Token {
  text: string;
  kind: TokenKind;
}

/** 字符串延续状态：三引号 docstring 会跨行 */
export type StringState = "none" | "s" | "d"; // s = '''  d = """

const KEYWORDS = new Set([
  "False", "None", "True", "and", "as", "assert", "async", "await",
  "break", "class", "continue", "def", "del", "elif", "else", "except",
  "finally", "for", "from", "global", "if", "import", "in", "is",
  "lambda", "nonlocal", "not", "or", "pass", "raise", "return",
  "try", "while", "with", "yield",
]);

const IDENT_START = /[A-Za-z_]/;
const IDENT_BODY = /[A-Za-z0-9_]/;
const DIGIT = /[0-9]/;

/**
 * 着色一行 Python。返回本行记号与本行结束时的字符串状态。
 *
 * 行内不回溯：一次线性扫描，示例文件都是几十行，性能无关紧要，
 * 但每步都要重新着色整份源码，所以保持 O(line)。
 */
export function tokenizePythonLine(
  line: string,
  state: StringState = "none",
): { tokens: Token[]; next: StringState } {
  const tokens: Token[] = [];
  let i = 0;
  let cur = state;
  let expectDefName = false;

  const push = (text: string, kind: TokenKind) => {
    if (!text) return;
    const last = tokens[tokens.length - 1];
    // 合并相邻同类型记号，避免渲染出成百上千个 span
    if (last && last.kind === kind) last.text += text;
    else tokens.push({ text, kind });
  };

  while (i < line.length) {
    // --- 已在字符串内：只找本语言字符串的结束 ---
    if (cur !== "none") {
      const quote = cur === "s" ? "'" : '"';
      const triple = quote.repeat(3);
      if (line.startsWith(triple, i)) {
        push(triple, "string");
        i += 3;
        cur = "none";
        continue;
      }
      const ch = line[i];
      if (ch === quote) {
        push(ch, "string");
        i += 1;
        cur = "none";
        continue;
      }
      push(ch, "string");
      i += 1;
      continue;
    }

    const ch = line[i];

    // --- 注释：到行尾 ---
    if (ch === "#") {
      push(line.slice(i), "comment");
      i = line.length;
      continue;
    }

    // --- 字符串开始（三引号优先）---
    if (line.startsWith("'''", i) || line.startsWith('"""', i)) {
      const triple = line.slice(i, i + 3);
      const isSingle = triple[0] === "'";
      push(triple, "string");
      i += 3;
      const close = line.indexOf(triple, i);
      if (close === -1) {
        push(line.slice(i), "string");
        cur = isSingle ? "s" : "d";
        i = line.length;
      } else {
        push(line.slice(i, close + 3), "string");
        i = close + 3;
      }
      continue;
    }
    if (ch === "'" || ch === '"') {
      const close = line.indexOf(ch, i + 1);
      push(ch, "string");
      i += 1;
      if (close === -1) {
        push(line.slice(i), "string");
        cur = ch === "'" ? "s" : "d";
        i = line.length;
      } else {
        push(line.slice(i, close + 1), "string");
        i = close + 1;
      }
      continue;
    }

    // --- 数字 ---
    if (DIGIT.test(ch) || (ch === "." && DIGIT.test(line[i + 1] ?? ""))) {
      let j = i;
      while (j < line.length && /[0-9._eE]/.test(line[j])) j++;
      push(line.slice(i, j), "number");
      i = j;
      continue;
    }

    // --- 标识符 / 关键字 / 函数名 ---
    if (IDENT_START.test(ch)) {
      let j = i;
      while (j < line.length && IDENT_BODY.test(line[j])) j++;
      const word = line.slice(i, j);
      if (expectDefName) {
        push(word, "defname");
        expectDefName = false;
      } else if (KEYWORDS.has(word)) {
        push(word, "keyword");
        expectDefName = word === "def" || word === "class";
      } else {
        push(word, "plain");
      }
      i = j;
      continue;
    }

    push(ch, "plain");
    i += 1;
  }

  return { tokens, next: cur };
}

/** 着色整份源码，返回逐行的记号数组（自动传递跨行字符串状态） */
export function tokenizePython(source: string): Token[][] {
  let state: StringState = "none";
  return source.split("\n").map((line) => {
    const { tokens, next } = tokenizePythonLine(line, state);
    state = next;
    return tokens;
  });
}
