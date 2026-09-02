/**
 * ADR-026 T2：树视图纯函数（懒加载合并 + 折叠偏好），不碰 DOM/网络。
 *
 * 数据源是 `GET /notes/tree`（后端经唯一 `resolve_hierarchy()` 构建并已按
 * depth 剪枝，`truncated` 标剪枝处）。前端**不得**据 wikilink 自行推断层级。
 * 前端 buildNoteTree（T-NOTE-HIER P1-1 的本地建树）随树端点落地退役——
 * 单一数据路径，避免两套树逻辑漂移。
 */
import type { NoteTreeNode } from "@shared/types/note";

/**
 * 懒加载合并：把 `GET /notes/tree?root_id=<id>` 返回的子树（单根）合并进森林——
 * 就地替换目标节点的 `children` 与 `truncated`（ADR-026 §3.3：展开即请求并就地展开）。
 * 目标节点不存在（如树已被并发刷新）时**原样返回**，防御性不抛错。
 * 纯函数：返回新数组，不改入参。
 */
export function mergeSubtree(
  forest: NoteTreeNode[],
  rootId: number,
  sub: NoteTreeNode,
): NoteTreeNode[] {
  const replace = (nodes: NoteTreeNode[]): NoteTreeNode[] =>
    nodes.map((n) => {
      if (n.note.id === rootId) {
        return { ...sub, note: n.note };
      }
      return { ...n, children: replace(n.children) };
    });
  return replace(forest);
}

/** 折叠偏好：存「被用户显式折叠」的节点 id（默认全展开，ADR-026 Q1——
 *  新笔记/懒加载节点天然展开，用户折叠的保持折叠）。 */
const COLLAPSED_KEY = "notes.tree.collapsed";

export function loadCollapsed(): Set<number> {
  try {
    const raw = localStorage.getItem(COLLAPSED_KEY);
    if (!raw) return new Set();
    const arr: unknown = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((v): v is number => typeof v === "number"));
  } catch {
    return new Set(); // 隐私模式 / 损坏数据：退化为默认全展开，不阻塞 UI
  }
}

export function saveCollapsed(ids: Set<number>): void {
  try {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...ids]));
  } catch {
    // 写不进就不写：偏好丢失可接受，功能不受影响
  }
}
