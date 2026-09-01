/**
 * 从 TraceEvent 派生渲染数据（纯函数 · 无 React · 可单测）
 *
 * 组件只负责画，所有「从轨迹里算出该显示什么」的逻辑集中在这里，
 * 好让步进/渲染行为能被纯函数测试覆盖（本项目前端测试惯例，不引 jsdom）。
 *
 * 编码通道遵守 ADR-025 §3.6：
 *   当前执行行 = 品牌橙底纹（唯一）· 变量变更 = 橙描边（≤0.3s）
 *   递归深度   = 帧堆叠 y 偏移（禁止颜色深浅）· 数组元素值 = 条高（禁止条高+颜色双编码）
 */
import type { TraceEvent, TraceValue } from "@shared/types/trace";

/** Python 关键字：出现在行文本里但不是变量，不能当行内值渲染 */
const PYTHON_KEYWORDS = new Set([
  "False", "None", "True", "and", "as", "assert", "async", "await",
  "break", "class", "continue", "def", "del", "elif", "else", "except",
  "finally", "for", "from", "global", "if", "import", "in", "is",
  "lambda", "nonlocal", "not", "or", "pass", "raise", "return",
  "try", "while", "with", "yield",
]);

const IDENTIFIER_RE = /[A-Za-z_][A-Za-z0-9_]*/g;

// --- 行执行次数（gutter 热力）---

/** 每行被执行的次数：gutter 热力条的数据源，也是「静态全貌」的唯一通道 */
export function computeHitCounts(events: readonly TraceEvent[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const e of events) {
    counts.set(e.line, (counts.get(e.line) ?? 0) + 1);
  }
  return counts;
}

// --- 取值格式化 ---

/**
 * 把 TraceValue 渲染成短字符串。
 *
 * 注意是 **Python 语义**：`None` / `True` / `False`，不是 JS 的 null/true/false。
 * 观众在看 Python 代码，行内值若显示 JS 字面量会直接误导。
 */
export function formatValue(value: TraceValue, maxLen = 40): string {
  let text: string;

  if (value === null) {
    text = "None";
  } else if (typeof value === "boolean") {
    text = value ? "True" : "False";
  } else if (typeof value === "number") {
    text = Number.isInteger(value) ? String(value) : value.toFixed(4).replace(/0+$/, "");
  } else if (typeof value === "string") {
    text = `'${value}'`;
  } else if (Array.isArray(value)) {
    text = `[${value.map((v) => formatValue(v, 24)).join(", ")}]`;
  } else if (typeof value === "object" && value !== null) {
    const rec = value as Record<string, unknown>;
    if (rec.type === "object") text = `<${rec.class} object>`;
    else if (rec.type === "depth_limit") text = `<${rec.class} …>`;
    else if (rec.type === "truncated") text = `[… ${rec.n} items]`;
    else text = JSON.stringify(value);
  } else {
    text = String(value);
  }

  return text.length > maxLen ? `${text.slice(0, maxLen - 1)}…` : text;
}

// --- 行内值（VS Code inline values 风格）---

export interface InlineValue {
  name: string;
  text: string;
}

/**
 * 当前行末尾要显示的变量值：行文本里出现的标识符 ∩ 当前帧的 locals。
 *
 * 取栈顶帧（frames[0]）——局部作用域优先，与 VS Code 变量面板一致。
 * 只显示**当前帧**能看到的变量：递归里外层的同名变量不该串台。
 */
export function inlineValuesForLine(
  lineText: string,
  event: TraceEvent | undefined,
): InlineValue[] {
  if (!event || event.frames.length === 0) return [];
  const locals = event.frames[0].locals;

  const seen = new Set<string>();
  const out: InlineValue[] = [];
  for (const m of lineText.matchAll(IDENTIFIER_RE)) {
    const name = m[0];
    if (seen.has(name)) continue;
    if (PYTHON_KEYWORDS.has(name)) continue;
    if (!(name in locals)) continue;
    seen.add(name);
    out.push({ name, text: formatValue(locals[name], 24) });
  }
  return out;
}

// --- 变量变更（§3.6：橙描边的唯一正当用途）---

/** 本步相对上一步发生变化的变量名集合 */
export function changedKeys(
  prev: TraceEvent | undefined,
  next: TraceEvent | undefined,
): Set<string> {
  if (!next || next.frames.length === 0) return new Set();
  const now = next.frames[0].locals;
  if (!prev || prev.frames.length === 0) return new Set(Object.keys(now));

  const before = prev.frames[0].locals;
  const changed = new Set<string>();
  for (const [k, v] of Object.entries(now)) {
    if (formatValue(before[k]) !== formatValue(v)) changed.add(k);
  }
  return changed;
}

// --- ArrayView 数据源 ---

export interface ArraySeries {
  name: string;
  values: number[];
}

/**
 * 取当前帧里第一个「数值数组」作为 ArrayView 的数据源。
 *
 * 不是算法语义推断——只是按 locals 声明顺序取第一个全数值列表。
 * ADR-025 §3.4 禁止自动推断模板与 swap 语义，这里是**取值**不是**推断**：
 * 画哪个数组由清单的 `template` 字段决定，这里只负责把数组捞出来。
 */
export function pickNumericArray(
  event: TraceEvent | undefined,
): ArraySeries | null {
  if (!event) return null;
  for (const frame of event.frames) {
    for (const [name, value] of Object.entries(frame.locals)) {
      if (!Array.isArray(value) || value.length === 0) continue;
      if (!value.every((v) => typeof v === "number")) continue;
      return { name, values: value as number[] };
    }
  }
  return null;
}

/** 数组里本步发生变化的下标（§3.6 变量变更 → 橙描边） */
export function changedIndices(
  prev: number[] | undefined,
  next: number[] | undefined,
): Set<number> {
  if (!next) return new Set();
  if (!prev || prev.length !== next.length) return new Set();
  const changed = new Set<number>();
  for (let i = 0; i < next.length; i++) {
    if (prev[i] !== next[i]) changed.add(i);
  }
  return changed;
}

/** 条高归一化：值 → 0..1。全等数组（如 [0,0,0]）退化为等高，不留零高条 */
export function normalizeHeights(values: readonly number[]): number[] {
  if (values.length === 0) return [];
  const max = Math.max(...values.map((v) => Math.abs(v)));
  if (max === 0) return values.map(() => 0.5);
  return values.map((v) => Math.abs(v) / max);
}
