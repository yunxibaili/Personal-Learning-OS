/**
 * CodeSurface — 独立工具性阅读区域（Phase 3B · 指令书 §1 P0）。
 * 非玻璃/非渐变/非 glow；language label + Copy→Copied；横向滚动；
 * token-level 语法层级（keyword/function/variable/string/number/comment/type/operator/punctuation）。
 * 本地最小 tokenizer，零依赖（若未来需要完整高亮，第三方库按指令书流程单独立项）。
 */
import { useMemo, useState } from "react";

export type TokKind =
  | "kw" | "fn" | "var" | "str" | "num" | "com" | "type" | "op" | "punc" | "plain";

interface Tok { k: TokKind; v: string }

const KEYWORDS: Record<string, Set<string>> = {
  ts: new Set(["const", "let", "var", "function", "return", "if", "else", "for", "while", "import", "export", "from", "default", "class", "extends", "new", "await", "async", "try", "catch", "throw", "typeof", "interface", "type", "as", "of", "in", "null", "undefined", "true", "false", "this"]),
  js: new Set(["const", "let", "var", "function", "return", "if", "else", "for", "while", "import", "export", "from", "default", "class", "new", "await", "async", "try", "catch", "throw", "typeof", "of", "in", "null", "undefined", "true", "false", "this"]),
  py: new Set(["def", "return", "if", "elif", "else", "for", "while", "import", "from", "class", "lambda", "with", "as", "try", "except", "raise", "None", "True", "False", "and", "or", "not", "in", "is", "pass", "yield"]),
  sql: new Set(["SELECT", "FROM", "WHERE", "JOIN", "LEFT", "INNER", "GROUP", "ORDER", "BY", "INSERT", "INTO", "VALUES", "UPDATE", "SET", "DELETE", "CREATE", "TABLE", "INDEX", "AND", "OR", "NOT", "NULL", "AS", "ON"]),
  rust: new Set(["fn", "let", "mut", "return", "if", "else", "for", "while", "loop", "match", "struct", "impl", "enum", "pub", "use", "mod", "self", "Some", "None", "Ok", "Err"]),
};
const TYPES = new Set(["string", "number", "boolean", "void", "any", "unknown", "never", "int", "float", "str", "bool", "i32", "u32", "f64", "usize"]);

function normLang(lang?: string): string {
  const l = (lang ?? "").toLowerCase();
  if (["ts", "tsx", "typescript"].includes(l)) return "ts";
  if (["js", "jsx", "javascript"].includes(l)) return "js";
  if (["py", "python"].includes(l)) return "py";
  if (l === "sql") return "sql";
  if (l === "rust" || l === "rs") return "rust";
  return l;
}

/** 行级 tokenize：注释 > 字符串 > 数字 > 关键词/类型 > 函数调用 > 运算/标点 */
export function tokenizeLine(line: string, lang: string, inBlockComment: boolean): { toks: Tok[]; inBlockComment: boolean } {
  const toks: Tok[] = [];
  if (inBlockComment) {
    const end = line.indexOf("*/");
    if (end === -1) return { toks: [{ k: "com", v: line }], inBlockComment: true };
    toks.push({ k: "com", v: line.slice(0, end + 2) });
    inBlockComment = false;
    const rest = tokenizeLine(line.slice(end + 2), lang, false);
    return { toks: [...toks, ...rest.toks], inBlockComment: false };
  }
  const trimmed = line.trimStart();
  if (trimmed.startsWith("//") || trimmed.startsWith("#")) {
    return { toks: [{ k: "com", v: line }], inBlockComment: false };
  }
  const kw = KEYWORDS[lang] ?? KEYWORDS.ts;
  const re = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`|\/\/.*|\/\*|\*\/|\b\d+(?:\.\d+)?\b|[A-Za-z_$][\w$]*|\s+|.)/g;
  let m: RegExpExecArray | null;
  let blockStart = -1;
  while ((m = re.exec(line)) !== null) {
    const v = m[0];
    let k: TokKind = "plain";
    if (v.startsWith('"') || v.startsWith("'") || v.startsWith("`")) k = "str";
    else if (v.startsWith("//")) k = "com";
    else if (v === "/*") { k = "com"; blockStart = 1; }
    else if (v === "*/") k = "com";
    else if (/^\d/.test(v)) k = "num";
    else if (/^[A-Za-z_$]/.test(v)) {
      if (kw.has(v)) k = "kw";
      else if (TYPES.has(v)) k = "type";
      else if (line[m.index + v.length]?.trimStart().startsWith("(")) k = "fn";
      else if (/^[A-Z]/.test(v)) k = "type";
      else k = "var";
    } else if (/^[+\-*/=<>!&|?:%]+$/.test(v)) k = "op";
    else if (/^[.,;(){}[\]]+$/.test(v)) k = "punc";
    else if (/^\s+$/.test(v)) k = "plain";
    toks.push({ k, v });
    if (blockStart === 1) {
      // 进入块注释：剩余整行按注释处理
      const rest = line.slice(m.index + v.length);
      if (rest && !rest.includes("*/")) { toks.push({ k: "com", v: rest }); break; }
      blockStart = -1;
    }
  }
  void inBlockComment;
  return { toks, inBlockComment };
}

const TOK_CLASS: Record<TokKind, string> = {
  kw: "tok-kw", fn: "tok-fn", var: "tok-var", str: "tok-str", num: "tok-num",
  com: "tok-com", type: "tok-type", op: "tok-op", punc: "tok-punc", plain: "",
};

export interface CodeSurfaceProps {
  code: string;
  language?: string;
  /** 桌面下可比正文更宽（code breakout 由外层控制） */
  breakout?: boolean;
}

export function CodeSurface({ code, language, breakout = true }: CodeSurfaceProps) {
  const [copied, setCopied] = useState(false);
  const lang = normLang(language || guessLang(code));
  const lines = useMemo(() => {
    const lns = code.replace(/\n$/, "").split("\n");
    let inBlock = false;
    return lns.map((ln) => {
      const r = tokenizeLine(ln, lang, inBlock);
      inBlock = r.inBlockComment;
      return r.toks;
    });
  }, [code, lang]);

  const onCopy = () => {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    });
  };

  return (
    <figure className={`wb-code${breakout ? " wb-code--breakout" : ""}`}>
      <figcaption className="wb-code__bar">
        <span className="wb-code__lang">{lang || "text"}</span>
        <button
          type="button"
          className="wb-code__copy"
          onClick={onCopy}
          aria-label={copied ? "已复制" : "复制代码"}
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </figcaption>
      <div className="wb-code__scroll" role="region" aria-label={`${lang || "text"} 代码`}>
        <pre><code>
          {lines.map((toks, i) => (
            <span key={i} className="wb-code__line">
              <span className="wb-code__ln" aria-hidden="true">{i + 1}</span>
              <span className="wb-code__src">
                {toks.map((t, j) =>
                  t.k === "plain" ? <span key={j}>{t.v}</span> : <span key={j} className={TOK_CLASS[t.k]}>{t.v}</span>,
                )}
                {"\n"}
              </span>
            </span>
          ))}
        </code></pre>
      </div>
    </figure>
  );
}

function guessLang(code: string): string {
  if (/^\s*(const|let|function|import|export|=>)/m.test(code)) return "ts";
  if (/^\s*def |import \w+$|print\(/m.test(code)) return "py";
  if (/SELECT|FROM/i.test(code)) return "sql";
  return "text";
}

/** 行内数学：保守渲染（保留反斜杠原文，样式标记为 math，不做 LaTeX 排版——完整排版列为 blocker） */
export function InlineMath({ tex }: { tex: string }) {
  return <span className="wb-math-inline" data-math={tex}>{tex}</span>;
}

/** 块级数学：独立 surface，居中，保留 canonical LaTeX 原文 */
export function DisplayMath({ tex }: { tex: string }) {
  return (
    <figure className="wb-math" data-math={tex}>
      <div className="wb-math__body">{tex}</div>
      <figcaption className="wb-caption">LaTeX · 原样保留（完整排版渲染为 blocker 登记）</figcaption>
    </figure>
  );
}

