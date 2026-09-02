/**
 * ui/visual-engine/highlight.ts
 *
 * Python 行级词法着色（零依赖纯函数）。
 *
 * 与 HTML 原型 `visual-engine.html` highlight 段一一对应：
 *  - 关键字、注释、数字、字符串、定义名、普通 token 六类
 *  - 多行三引号字符串跨行传递 state（`'s'` / `'d'`）
 *  - 着色仅复用 tokens.css 既有色相（不引新色相）—— 见 CodePane.tsx className 映射
 *
 * 与 derive.PY_KEYWORDS_SET 同源，避免两套真值漂移。
 */
import { PY_KEYWORDS_SET } from "./derive";

export type HighlightKind = "keyword" | "string" | "comment" | "number" | "defname" | "plain";

export interface Token {
  text: string;
  kind: HighlightKind;
}

const IDENT_START = /[A-Za-z_]/;
const IDENT_BODY = /[A-Za-z0-9_]/;
const DIGIT = /[0-9]/;

/** 多行字符串跨行 state：`"none" | "s" | "d"`（分别表示未在串内 / 单引号串 / 双引号串） */
export type QuoteState = "none" | "s" | "d";

export interface TokenizeResult {
  tokens: Token[];
  next: QuoteState;
}

/**
 * 单行 Python 词法分析。多行三引号字符串未闭合时返回 next 状态，
 * 调用方把它传到下一行的 tokenizePythonLine 即可。
 */
export function tokenizePythonLine(line: string, state?: QuoteState): TokenizeResult {
  const tokens: Token[] = [];
  let i = 0;
  let cur: QuoteState = state || "none";
  let expectDefName = false;

  function push(text: string, kind: HighlightKind): void {
    if (!text) return;
    const last = tokens[tokens.length - 1];
    if (last && last.kind === kind) last.text += text;
    else tokens.push({ text, kind });
  }

  while (i < line.length) {
    if (cur !== "none") {
      const quote = cur === "s" ? "'" : '"';
      const triple = quote + quote + quote;
      if (line.startsWith(triple, i)) {
        push(triple, "string");
        i += 3;
        cur = "none";
        continue;
      }
      if (line[i] === quote) {
        push(quote, "string");
        i += 1;
        cur = "none";
        continue;
      }
      push(line[i], "string");
      i += 1;
      continue;
    }
    const ch = line[i];
    if (ch === "#") {
      push(line.slice(i), "comment");
      i = line.length;
      continue;
    }
    if (line.startsWith("'''", i) || line.startsWith('"""', i)) {
      const tq = line.slice(i, i + 3);
      const isSingle = tq[0] === "'";
      push(tq, "string");
      i += 3;
      const close = line.indexOf(tq, i);
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
      push(ch, "string");
      i += 1;
      const c2 = line.indexOf(ch, i);
      if (c2 === -1) {
        push(line.slice(i), "string");
        cur = ch === "'" ? "s" : "d";
        i = line.length;
      } else {
        push(line.slice(i, c2 + 1), "string");
        i = c2 + 1;
      }
      continue;
    }
    if (DIGIT.test(ch) || (ch === "." && DIGIT.test(line[i + 1] || ""))) {
      let j = i;
      while (j < line.length && /[0-9._eE]/.test(line[j])) j++;
      push(line.slice(i, j), "number");
      i = j;
      continue;
    }
    if (IDENT_START.test(ch)) {
      let k = i;
      while (k < line.length && IDENT_BODY.test(line[k])) k++;
      const word = line.slice(i, k);
      if (expectDefName) {
        push(word, "defname");
        expectDefName = false;
      } else if (PY_KEYWORDS_SET.has(word)) {
        push(word, "keyword");
        expectDefName = word === "def" || word === "class";
      } else push(word, "plain");
      i = k;
      continue;
    }
    push(ch, "plain");
    i += 1;
  }
  return { tokens, next: cur };
}

/**
 * 整段 Python 源码 → 每一行的 token 数组。
 * 多行字符串自动跨行传递 state。
 */
export function tokenizePython(source: string): Token[][] {
  let state: QuoteState = "none";
  return source.split("\n").map((line) => {
    const r = tokenizePythonLine(line, state);
    state = r.next;
    return r.tokens;
  });
}