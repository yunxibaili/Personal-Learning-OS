import { describe, expect, it } from "vitest";

import type { NoteSummary } from "@shared/types/note";

import { buildNoteTree } from "./buildNoteTree";

const mk = (
  id: number,
  title: string,
  parent_id: number | null,
  updated_at = "2026-09-01T00:00:00",
): NoteSummary => ({
  id,
  path: `${title}.md`,
  title,
  tags: [],
  updated_at,
  parent_id,
});

describe("buildNoteTree", () => {
  it("按 parent_id 建两级树（主笔记/副笔记）", () => {
    const tree = buildNoteTree([
      mk(1, "机器学习", null),
      mk(2, "Adam 优化器", 1),
      mk(3, "反向传播", 1),
    ]);
    expect(tree).toHaveLength(1);
    expect(tree[0].note.title).toBe("机器学习");
    expect(tree[0].children.map((c) => c.note.title).sort())
      .toEqual(["Adam 优化器", "反向传播"]);
  });

  it("多级嵌套（课程→章节→知识点）", () => {
    const tree = buildNoteTree([
      mk(1, "课程", null),
      mk(2, "章节", 1),
      mk(3, "知识点", 2),
    ]);
    expect(tree[0].children[0].children[0].note.title).toBe("知识点");
  });

  it("多根森林：无父笔记平级排列", () => {
    const tree = buildNoteTree([
      mk(1, "甲", null),
      mk(2, "乙", null),
      mk(3, "子", 1),
    ]);
    expect(tree.map((n) => n.note.title).sort()).toEqual(["乙", "甲"]);
    expect(tree.find((n) => n.note.title === "甲")!.children).toHaveLength(1);
  });

  it("orphan：parent_id 指向不存在的笔记 → 兜底按根渲染（不丢笔记）", () => {
    const tree = buildNoteTree([mk(1, "孤儿", 999)]);
    expect(tree).toHaveLength(1);
    expect(tree[0].note.title).toBe("孤儿");
    expect(tree[0].children).toHaveLength(0);
  });

  it("同层按 updated_at 降序（与原平铺列表一致）", () => {
    const tree = buildNoteTree([
      mk(1, "旧", null, "2026-08-30T10:00:00"),
      mk(2, "新", null, "2026-09-01T10:00:00"),
    ]);
    expect(tree[0].note.title).toBe("新");
    expect(tree[1].note.title).toBe("旧");
  });

  it("空列表 → 空森林", () => {
    expect(buildNoteTree([])).toEqual([]);
  });
});
