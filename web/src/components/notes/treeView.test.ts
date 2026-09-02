/** treeView 纯函数测试（ADR-026 T2）：懒加载合并 + 折叠偏好读写。 */
import { afterEach, describe, expect, it, vi } from "vitest";

import type { NoteTreeNode } from "@shared/types/note";
import { loadCollapsed, mergeSubtree, saveCollapsed } from "./treeView";

function node(id: number, title: string, opts?: Partial<NoteTreeNode>): NoteTreeNode {
  return {
    note: {
      id,
      path: `${title}.md`,
      title,
      tags: [],
      updated_at: "2026-09-02T00:00:00Z",
      parent_id: null,
    },
    children: [],
    truncated: false,
    ...opts,
  };
}

describe("mergeSubtree：懒加载子树合并（ADR-026 §3.3）", () => {
  const forest = [
    node(1, "层1", {
      children: [
        node(2, "层2", { truncated: true }), // 被剪枝：children 空 + truncated
      ],
    }),
    node(9, "其他主笔记"),
  ];

  it("替换目标节点的 children 与 truncated", () => {
    const sub = node(2, "层2", {
      children: [node(3, "层3"), node(4, "层3乙")],
      truncated: false,
    });
    const merged = mergeSubtree(forest, 2, sub);
    const lvl1 = merged[0];
    const lvl2 = lvl1.children[0];
    expect(lvl2.children.map((c) => c.note.title)).toEqual(["层3", "层3乙"]);
    expect(lvl2.truncated).toBe(false);
  });

  it("纯函数：不改入参", () => {
    const sub = node(2, "层2", { children: [node(3, "层3")] });
    mergeSubtree(forest, 2, sub);
    expect(forest[0].children[0].children).toEqual([]);
    expect(forest[0].children[0].truncated).toBe(true);
  });

  it("深层合并：替换树中任意位置的节点", () => {
    const deeper = [
      node(1, "层1", {
        children: [node(2, "层2", { children: [node(5, "层3x", { truncated: true })] })],
      }),
    ];
    const sub = node(5, "层3x", { children: [node(6, "层4")] });
    const merged = mergeSubtree(deeper, 5, sub);
    expect(merged[0].children[0].children[0].children[0].note.title).toBe("层4");
  });

  it("目标不存在（并发刷新）时原样返回，防御性不抛错", () => {
    const sub = node(99, "幽灵");
    const merged = mergeSubtree(forest, 99, sub);
    expect(merged).toHaveLength(2);
    expect(merged[0].children[0].children).toEqual([]);
  });

  it("合并后保留目标节点自身的 note 字段（子树根的 note 以树上为准）", () => {
    const stale = node(2, "层2旧标题", { children: [node(3, "层3")] });
    const merged = mergeSubtree(forest, 2, stale);
    // note 以原树为准（懒加载响应与树可能存在取数时差）
    expect(merged[0].children[0].note.title).toBe("层2");
    expect(merged[0].children[0].children.length).toBe(1);
  });
});

describe("折叠偏好（localStorage，默认全展开）", () => {
  // vitest node 环境无 localStorage：stub 一个内存实现验证序列化契约
  const store = new Map<string, string>();
  afterEach(() => {
    store.clear();
    vi.unstubAllGlobals();
  });
  function stubStorage(): void {
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    });
  }

  it("roundtrip：保存后读回同一集合", () => {
    stubStorage();
    saveCollapsed(new Set([3, 7, 11]));
    expect(loadCollapsed()).toEqual(new Set([3, 7, 11]));
  });

  it("空存储 → 空集（默认全展开）", () => {
    stubStorage();
    expect(loadCollapsed().size).toBe(0);
  });

  it("损坏数据 / 非数组 → 空集，不抛错", () => {
    stubStorage();
    localStorage.setItem("notes.tree.collapsed", "{oops");
    expect(loadCollapsed().size).toBe(0);
    localStorage.setItem("notes.tree.collapsed", JSON.stringify(["a", 2, null]));
    expect(loadCollapsed()).toEqual(new Set([2]));
  });
});
