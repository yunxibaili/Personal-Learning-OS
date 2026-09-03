/**
 * 笔记标题展示降级（P1-2）——**纯展示层**，不碰 title 真值。
 *
 * 背景：vault 里存在 13 条导入/生成产生的占位笔记，title 形如
 * `未命名笔记 193159`（= 占位文案 + 时间戳后缀）。裸数字后缀对读者毫无意义，
 * 但仍需保留可定位信息 → 降级为 `未命名笔记 · #<id>`。
 *
 * 约束（P1-2 锁定）：
 *   - 不改 Markdown 真值、不改 DB、不改 API 契约、不清理 vault 数据
 *   - 不改 note.id（ID 是定位信息，降级后仍保留在文案里）
 *   - 不引入依赖；本模块无 React、可被 vitest 直接测试
 *
 * 判定顺序：空/空白 → 纯数字（ID 形态）→ 占位 pattern → 否则原样。
 */
export const UNNAMED_FALLBACK = "未命名笔记";

/** 后端/导入生成的占位标题：`未命名笔记` + 数字后缀（允许中间空格）。 */
const PLACEHOLDER_RE = /^未命名笔记\s*\d+$/;

/** 纯数字（ID 形态标题）。 */
const DIGITS_RE = /^\d+$/;

/**
 * 笔记标题的展示文案。
 * @param title 原始 title（可能为空 / null / undefined）
 * @param id    笔记 id（降级时作为定位信息保留）
 */
export function displayNoteTitle(
  title: string | null | undefined,
  id: number,
): string {
  const t = (title ?? "").trim();
  if (!t || DIGITS_RE.test(t) || PLACEHOLDER_RE.test(t)) {
    return `${UNNAMED_FALLBACK} · #${id}`;
  }
  return t;
}
