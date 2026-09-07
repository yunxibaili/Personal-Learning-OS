import { describe, expect, it } from "vitest";
import {
  buildContextModel,
  extractLinkTargets,
  matchConcepts,
  pickReviewDue,
  type BacklinkRef,
} from "./contextModel";
import type { MasteryEntry } from "../api/mastery";
import type { RelatedNote } from "../api/concepts";

/** 3C-2 Context v2 合成门禁（纯函数部分） */

const M = (concept_id: number, title: string, effective_now: number): MasteryEntry => ({
  concept_id,
  title,
  effective_now,
  effective: effective_now,
  dimensions: { knowledge: 0.7, practice: 0.6, recall: 0.6, transfer: 0.5 },
});

describe("extractLinkTargets", () => {
  it("解析 [[..]] 且去重", () => {
    expect(extractLinkTargets("参见 [[梯度下降]] 与 [[Adam优化器]]，以及 [[梯度下降]]")).toEqual([
      "梯度下降",
      "Adam优化器",
    ]);
  });
  it("无链接时返回空", () => {
    expect(extractLinkTargets("纯文本")).toEqual([]);
  });
});

describe("matchConcepts — 精确优先", () => {
  const mastery = [M(1, "梯度下降", 0.72), M(2, "Adam优化器", 0.58), M(3, "学习", 0.9)];

  it("标题全等 → current", () => {
    const r = matchConcepts(mastery, "梯度下降", []);
    expect(r.current?.concept_id).toBe(1);
  });

  it("链接命中 → matched（不因短词包含而误命中）", () => {
    const r = matchConcepts(mastery, "优化方法综述", ["Adam优化器"]);
    expect(r.matched.map((c) => c.concept_id)).toContain(2);
    expect(r.matched.map((c) => c.concept_id)).not.toContain(3);
  });

  it("概念匹配不再出现 0 命中（旧启发式问题）", () => {
    const r = matchConcepts(mastery, "梯度下降", ["梯度下降"]);
    expect(r.matched.length + (r.current ? 1 : 0)).toBeGreaterThan(0);
  });
});

describe("pickReviewDue", () => {
  it("只保留与当前对象相关的弱概念（不相关者不进 Context）", () => {
    const weak = [M(4, "D", 0.3), M(5, "E", 0.2)];
    expect(pickReviewDue(weak, [4]).map((d) => d.title)).toEqual(["D"]);
    expect(pickReviewDue(weak, []).length).toBe(0);
  });
});

describe("buildContextModel", () => {
  const base = {
    noteTitle: "梯度下降",
    contentMd: "参见 [[Adam优化器]] 与 [[Transformer]]",
    mastery: [M(1, "梯度下降", 0.72), M(2, "Adam优化器", 0.58), M(3, "Transformer", 0.66)],
    weakConcepts: [M(2, "Adam优化器", 0.58)],
    relatedNotes: [
      { note_id: 11, title: "优化器全景" } as RelatedNote,
      { note_id: 1, title: "梯度下降" } as RelatedNote,
    ],
    backlinks: [{ note_id: 9, title: "反向传播" } as BacklinkRef],
    currentNoteId: 1,
    annotationCount: 2,
  };

  it("当前概念 + 相关概念 + 回链 + 复习 + 批注存在性齐全", () => {
    const m = buildContextModel(base);
    expect(m.currentConcept?.title).toBe("梯度下降");
    expect(m.relatedConcepts.map((c) => c.title)).toEqual(["Adam优化器", "Transformer"]);
    expect(m.backlinks[0].title).toBe("反向传播");
    expect(m.reviewDue[0].title).toBe("Adam优化器");
    expect(m.hasAnnotations).toBe(true);
  });

  it("相关笔记排除当前笔记", () => {
    const m = buildContextModel(base);
    expect(m.relatedNotes.every((n) => n.note_id !== 1)).toBe(true);
  });

  it("空正文时结构仍然安全（不崩、不造数据）", () => {
    const m = buildContextModel({ ...base, contentMd: "", mastery: [], weakConcepts: [], relatedNotes: [], backlinks: [], annotationCount: 0 });
    expect(m.currentConcept).toBeNull();
    expect(m.relatedConcepts).toEqual([]);
    expect(m.hasAnnotations).toBe(false);
  });
});
