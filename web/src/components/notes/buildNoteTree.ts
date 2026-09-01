/**
 * ADR-024 P1-1：左侧层级树建树逻辑（纯函数，不碰 DOM/网络）。
 *
 * 数据来源是 `/notes` 响应的 `parent_id` 字段——由后端唯一 `resolve_hierarchy()`
 * 提供（红线 2/5）。前端**不得**据 wikilink 自行推断层级。
 * 孤儿（parent_id 指向不存在的笔记）按根渲染，避免数据异常时丢笔记。
 */
import type { NoteSummary } from "@shared/types/note";

/** 树节点：笔记 + 其子节点（按标题排序，保证渲染稳定）。 */
export interface NoteTreeNode {
  note: NoteSummary;
  children: NoteTreeNode[];
}

/**
 * 平铺列表 → 森林。规则：
 * - `parent_id === null` → 根；
 * - `parent_id` 指向存在的笔记 → 挂到其 children；
 * - `parent_id` 指向不存在的笔记（orphan/invalid）→ 兜底按根渲染；
 * - 自指/成环不会出现在 parent_id 里（后端 resolver 已保证非 null 必有效），
 *   但防御性处理：父链深度超界按根渲染，避免无限递归。
 * 同层按 updated_at 降序（与原平铺列表一致），children 同规则。
 */
export function buildNoteTree(notes: NoteSummary[]): NoteTreeNode[] {
  const byId = new Map<number, NoteSummary>();
  for (const n of notes) byId.set(n.id, n);

  const nodeOf = new Map<number, NoteTreeNode>();
  for (const n of notes) nodeOf.set(n.id, { note: n, children: [] });

  const roots: NoteTreeNode[] = [];
  // 两轮：先挂合法的，再收剩余（orphan / 防御性）为根——顺序保证父先于子入树。
  const pending: NoteTreeNode[] = [];
  for (const n of notes) {
    const node = nodeOf.get(n.id)!;
    if (n.parent_id != null && byId.has(n.parent_id)) {
      nodeOf.get(n.parent_id)!.children.push(node);
    } else {
      pending.push(node);
    }
  }
  // 防御性：children 里可能出现环（理论上不会，契约上 parent_id 由 resolver 保证
  // 非法即 null），深度限制兜底——环节点会被 push 进 pending 之外，这里再收一遍。
  const seen = new Set<number>();
  const collect = (node: NoteTreeNode) => {
    if (seen.has(node.note.id)) return;
    seen.add(node.note.id);
    for (const c of node.children) collect(c);
  };
  for (const n of notes) collect(nodeOf.get(n.id)!);

  roots.push(...pending);
  // 任何因环未到达的节点（防御）也按根兜底
  for (const n of notes) {
    if (!seen.has(n.id)) {
      seen.add(n.id);
      roots.push(nodeOf.get(n.id)!);
      collect(nodeOf.get(n.id)!);
    }
  }

  const byUpdatedDesc = (a: NoteTreeNode, b: NoteTreeNode) =>
    b.note.updated_at.localeCompare(a.note.updated_at) ||
    b.note.id - a.note.id;
  const sortRec = (nodes: NoteTreeNode[]) => {
    nodes.sort(byUpdatedDesc);
    for (const nd of nodes) sortRec(nd.children);
  };
  sortRec(roots);
  return roots;
}
