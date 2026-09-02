/**
 * ui/visual-engine/derive.ts
 *
 * 派生数据：把当前步与上一步的 events 转换成渲染所需的
 * 6 个派生量。全部为纯函数，无副作用。
 *
 * 与 HTML 原型 `visual-engine.html` derive 段一一对应：
 *   - formatValue        Python 语义值展示（None / True / False / 截断）
 *   - computeHitCounts   行执行次数热力
 *   - inlineValuesForLine VS Code 行尾 inline values
 *   - changedKeys        当前帧 locals 相对上一帧的变化键
 *   - pickNumericArray   数组可视化挑选（首个数值数组）
 *   - changedIndices     数组下标变化（深比较，长度变化→全空集）
 * - normalizeHeights 数组元素值归一化到 [0,1]
 *
 * 约束（ADR §4.3）：绝不调用用户对象的 repr()/str()；
 * 未知对象 → `<ClassName object>`。
 */
import type { TraceEvent, TraceFrame, TraceValue } from "./types";

// Python 关键字（用于 inlineValuesForLine 排除）
const PY_KEYWORDS: ReadonlySet<string> = new Set([
  "False", "None", "True", "and", "as", "assert", "async", "await", "break",
  "class", "continue", "def", "del", "elif", "else", "except", "finally", "for",
  "from", "global", "if", "import", "in", "is", "lambda", "nonlocal", "not",
  "or", "pass", "raise", "return", "try", "while", "with", "yield"
]);

/**
 * 把 TraceValue 渲染为 Python 语义字符串。
 *
 *  - `null` → "None"；`true` → "True"；`false` → "False"
 *  - number → 整数原样 / 浮点去尾零
 *  - string → 包在单引号里（`'…'`）
 *  - array  → 递归 `[a, b, c]`，内层 maxLen=24 防爆
 *  - object → `<ClassName object>` / `<ClassName …>` / `[… n items]`
 *
 * 超过 maxLen 截断并加 `…`。
 */
export function formatValue(value: TraceValue, maxLen = 40): string {
  let text: string;
  if (value === null) text = "None";
  else if (typeof value === "boolean") text = value ? "True" : "False";
  else if (typeof value === "number") {
    text = Number.isInteger(value) ? String(value) : value.toFixed(4).replace(/0+$/, "");
  } else if (typeof value === "string") {
    text = "'" + value + "'";
  } else if (Array.isArray(value)) {
    text = "[" + value.map((v) => formatValue(v, 24)).join(", ") + "]";
  } else if (typeof value === "object") {
    if (value.type === "object") text = "<" + value.class + " object>";
    else if (value.type === "depth_limit") text = "<" + value.class + " …>";
    else if (value.type === "truncated") text = "[… " + value.n + " items]";
    else text = JSON.stringify(value);
  } else text = String(value);
  return text.length > maxLen ? text.slice(0, maxLen - 1) + "…" : text;
}

export interface HitCounts {
  counts: Record<number, number>;
  max: number;
}

/**
 * 统计每行被执行的次数（用于 gutter 竖条透明度通道）。
 *
 * max ≥ 1（空轨迹时 max=1，避免除零）。透明度公式见 CodePane：
 *   `0.25 + 0.75 * (hit / max)`，命中 0 → 完全隐藏。
 */
export function computeHitCounts(events: TraceEvent[]): HitCounts {
  const counts: Record<number, number> = {};
  for (let i = 0; i < events.length; i++) {
    const line = events[i].line;
    counts[line] = (counts[line] || 0) + 1;
  }
  let max = 1;
  for (const k in counts) {
    if (counts[k] > max) max = counts[k];
  }
  return { counts, max };
}

/**
 * 在源码行中提取与当前帧 locals 同名的标识符，生成 inline values。
 *
 * 行为对齐 VS Code 行尾 inline values：
 *   - 只取当前帧 locals（frames[0]）
 *   - 跳过关键字（PY_KEYWORDS）
 *   - 行内重复名只取第一个
 *   - 行内未在 locals 出现的标识符忽略
 */
export function inlineValuesForLine(
  lineText: string,
  ev: TraceEvent | undefined
): Array<{ name: string; text: string }> {
  if (!ev || ev.frames.length === 0) return [];
  const locals = ev.frames[0].locals;
  const seen: Record<string, true> = {};
  const out: Array<{ name: string; text: string }> = [];
  const re = /[A-Za-z_][A-Za-z0-9_]*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(lineText)) !== null) {
    const name = m[0];
    if (seen[name]) continue;
    if (PY_KEYWORDS.has(name)) continue;
    if (!(name in locals)) continue;
    seen[name] = true;
    out.push({ name, text: formatValue(locals[name], 24) });
  }
  return out;
}

/**
 * 返回当前帧 locals 相对上一帧的变化键集合。
 *
 * 用 formatValue 对比，避免引用相等但内容相同造成的误报。
 * 首步（prev 空）→ 视全部键为「变化」以做高亮。
 */
export function changedKeys(
  prev: TraceEvent | undefined,
  next: TraceEvent | undefined
): Record<string, true> {
  const set: Record<string, true> = {};
  if (!next || next.frames.length === 0) return set;
  const now = next.frames[0].locals;
  if (!prev || prev.frames.length === 0) {
    for (const k in now) set[k] = true;
    return set;
  }
  const before = prev.frames[0].locals;
  for (const key in now) {
    if (formatValue(before[key] as TraceValue) !== formatValue(now[key] as TraceValue)) {
      set[key] = true;
    }
  }
  return set;
}

/**
 * 从当前帧到栈底，挑选首个**全部为数字**的非空数组。
 * 用于 ArrayView 数据源。
 */
export function pickNumericArray(
  ev: TraceEvent | undefined
): { name: string; values: number[] } | null {
  if (!ev) return null;
  for (let f = 0; f < ev.frames.length; f++) {
    const locals = ev.frames[f].locals;
    for (const name in locals) {
      const v = locals[name];
      if (!Array.isArray(v) || v.length === 0) continue;
      const allNum = v.every((x) => typeof x === "number");
      if (allNum) return { name, values: v };
    }
  }
  return null;
}

/**
 * 数组下标级变化。长度不同 → 全空集（视为整体替换，
 * 不猜「部分相同」）。
 */
export function changedIndices(
  prev: number[] | undefined,
  next: number[]
): Record<number, true> {
  const set: Record<number, true> = {};
  if (!next) return set;
  if (!prev || prev.length !== next.length) return set;
  for (let i = 0; i < next.length; i++) {
    if (prev[i] !== next[i]) set[i] = true;
  }
  return set;
}

/**
 * 数组元素值归一化到 [0, 1] 用于条高。
 *
 * - 空数组 → 空
 * - max = 0 → 全部为 0.5（避免退化）
 * - 否则 |v| / max
 */
export function normalizeHeights(values: number[]): number[] {
  if (values.length === 0) return [];
  let max = 0;
  values.forEach((v) => {
    if (Math.abs(v) > max) max = Math.abs(v);
  });
  if (max === 0) return values.map(() => 0.5);
  return values.map((v) => Math.abs(v) / max);
}

/**
 * 内部辅助：导出 PY_KEYWORDS 供 highlight 模块复用，
 * 避免两套真值漂移。
 */
export const PY_KEYWORDS_SET = PY_KEYWORDS;

/**
 * 类型守卫：是否为 "frame" 渲染（FrameStackView / GeneralView）。
 * 供 Renderer 路由使用。
 */
export function isFrameView(template: string): boolean {
  return template === "FrameStackView" || template === "GeneralView";
}

/** 类型守卫：是否为数字数组可视化的最佳模板（ArrayView）。 */
export function isArrayView(template: string): boolean {
  return template === "ArrayView";
}

// 让 TS 觉得 TraceFrame 被引用，避免 tree-shaking 删除
export type _UseTraceFrame = TraceFrame;