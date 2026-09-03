/**
 * P1-12-B2-A：笔记概览统计（纯函数，从 content_md 计算，零 API 依赖）。
 *
 * 数据原则（所有者裁决）：只用当前 NoteDetail 已有字段，
 * 不新增 fetch / 不跨组件取数 / 不重复业务计算。
 */
export interface NoteStats {
  /** 字符数（含空格与标点） */
  chars: number;
  /** 双链数（`[[目标]]` 语法） */
  wikilinks: number;
  /** 行内 + 块级公式数（`$…$` / `$$…$$`） */
  formulas: number;
  /** 代码块数（三反引号） */
  codeBlocks: number;
  /** 预估阅读分钟（≈ 500 字/分钟） */
  readingMin: number;
}

const WIKILINK_RE = /\[\[[^\]]+\]\]/g;
const FORMULA_RE = /\$\$?[^$]+\$\$?/g;
const CODEBLOCK_RE = /```[\s\S]*?```/g;

export function computeNoteStats(md: string): NoteStats {
  const chars = md.length;
  const wikilinks = (md.match(WIKILINK_RE) ?? []).length;
  const formulas = (md.match(FORMULA_RE) ?? []).length;
  const codeBlocks = (md.match(CODEBLOCK_RE) ?? []).length;
  const readingMin = Math.max(1, Math.ceil(chars / 500));
  return { chars, wikilinks, formulas, codeBlocks, readingMin };
}
