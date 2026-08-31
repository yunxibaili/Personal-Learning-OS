import { describe, expect, it } from "vitest";

import { derivePlanets } from "./GalaxyCanvas";
import type { GraphEdge, GraphNode, GraphResponse } from "@shared/types/graph";

/**
 * 星球/卫星推断的语义锁（2026-08-31 裁定 = 方案 A：从 wikilink 拓扑推断）。
 * 数据模型无 parent_id、path 扁平、ADR-008 contains 关系零处生产，
 * 因此层级完全由这些用例定义——改动 derivePlanets 必须连带改这里。
 */

function note(id: number, title: string, mastery: number | null = null): GraphNode {
  return { id: `note-${id}`, type: "note", ref_id: id, title, domain: null, status: null,
    learning: { mastery, review_due: null } };
}

function edge(a: number, b: number, relation = "wikilink"): GraphEdge {
  return { source: `note-${a}`, target: `note-${b}`, relation };
}

function graph(nodes: GraphNode[], edges: GraphEdge[]): GraphResponse {
  return { nodes, edges };
}

describe("derivePlanets", () => {
  it("出度 ≥2 的笔记成为星球", () => {
    const g = graph(
      [note(1, "书"), note(2, "章一"), note(3, "章二")],
      [edge(1, 2), edge(2, 1), edge(1, 3), edge(3, 1)],
    );
    const planets = derivePlanets(g);
    expect(planets).toHaveLength(1);
    expect(planets[0].id).toBe(1);
    expect(planets[0].sats.map((s) => s.id).sort()).toEqual([2, 3]);
  });

  it("单向引用不算从属——必须双向互链", () => {
    // 1 链向 2、3，但没有回链 → 不构成星球/卫星关系
    const g = graph(
      [note(1, "索引页"), note(2, "章一"), note(3, "章二")],
      [edge(1, 2), edge(1, 3)],
    );
    const planets = derivePlanets(g);
    // 1 出度 2 仍算星球，但无互链卫星
    const p1 = planets.find((p) => p.id === 1)!;
    expect(p1.sats).toHaveLength(0);
    // 2、3 未被任何 hub 拥有 → 各自成为无卫星的独立星球
    expect(planets.filter((p) => p.sats.length === 0)).toHaveLength(3);
  });

  it("出度 <2 的笔记不是星球", () => {
    const g = graph(
      [note(1, "章一"), note(2, "章二")],
      [edge(1, 2), edge(2, 1)],
    );
    const planets = derivePlanets(g);
    expect(planets.every((p) => p.sats.length === 0)).toBe(true);
  });

  it("卫星归属排他：归给互链且严格更大的那个 hub", () => {
    // 4 同时与 hub 1（出度3）和 hub 2（出度2）互链 → 应归给 1
    const g = graph(
      [note(1, "大书"), note(2, "小书"), note(3, "a"), note(4, "共享章"), note(5, "b")],
      [
        edge(1, 3), edge(3, 1),
        edge(1, 4), edge(4, 1),
        edge(1, 5), edge(5, 1),
        edge(2, 4), edge(4, 2),
        edge(2, 5), edge(5, 2),
      ],
    );
    const planets = derivePlanets(g);
    const big = planets.find((p) => p.id === 1)!;
    const small = planets.find((p) => p.id === 2)!;
    expect(big.sats.map((s) => s.id)).toContain(4);
    expect(small.sats.map((s) => s.id)).not.toContain(4);
  });

  it("出度相同的 hub 互不吞并（各自独立成星球）", () => {
    // 1、2、3、4 出度全为 2 → 谁也不比谁"严格更大" → 无归属关系
    const g = graph(
      [note(1, "书A"), note(2, "书B"), note(3, "a"), note(4, "b")],
      [
        edge(1, 3), edge(3, 1),
        edge(1, 4), edge(4, 1),
        edge(2, 3), edge(3, 2),
        edge(2, 4), edge(4, 2),
      ],
    );
    const planets = derivePlanets(g);
    const ids = planets.map((p) => p.id);
    expect(ids).toContain(1);
    expect(ids).toContain(2);
    // 无归属 → 每颗星球都没有卫星
    expect(planets.every((p) => p.sats.length === 0)).toBe(true);
  });

  it("被更大 hub 收编的 hub 降级为卫星，不再单独成星球", () => {
    // 4、5 出度 2（自身够 hub 门槛），但被出度 3 的 hub 1 收编 → 降级
    const g = graph(
      [note(1, "大书"), note(2, "小书"), note(3, "a"), note(4, "卷一"), note(5, "卷二")],
      [
        edge(1, 3), edge(3, 1),
        edge(1, 4), edge(4, 1),
        edge(1, 5), edge(5, 1),
        edge(2, 4), edge(4, 2),
        edge(2, 5), edge(5, 2),
      ],
    );
    const planets = derivePlanets(g);
    const ids = planets.map((p) => p.id);
    expect(ids).toContain(1);
    // 4、5 已降级为卫星，不应再作为星球出现
    expect(ids).not.toContain(4);
    expect(ids).not.toContain(5);
    const big = planets.find((p) => p.id === 1)!;
    expect(big.sats.map((s) => s.id).sort()).toEqual([3, 4, 5]);
  });

  it("孤立笔记 = 无卫星的独立星球，不丢笔记", () => {
    const g = graph([note(1, "孤儿"), note(2, "另一个")], []);
    const planets = derivePlanets(g);
    expect(planets.map((p) => p.id).sort()).toEqual([1, 2]);
    expect(planets.every((p) => p.sats.length === 0)).toBe(true);
  });

  it("概念节点不参与星系（只算笔记）", () => {
    const c: GraphNode = { id: "concept-9", type: "concept", ref_id: 9, title: "贝叶斯",
      domain: null, status: null, learning: { mastery: null, review_due: null } };
    const g = graph([note(1, "书"), note(2, "章"), c], [edge(1, 2), edge(2, 1)]);
    const planets = derivePlanets(g);
    expect(planets.every((p) => p.id !== 9)).toBe(true);
  });

  it("卫星超 16 时聚合为 overflow", () => {
    const nodes: GraphNode[] = [note(0, "大书")];
    const edges: GraphEdge[] = [];
    for (let i = 1; i <= 20; i++) {
      nodes.push(note(i, `章${i}`));
      edges.push(edge(0, i), edge(i, 0));
    }
    const planets = derivePlanets(graph(nodes, edges));
    const book = planets.find((p) => p.id === 0)!;
    expect(book.sats).toHaveLength(16);
    expect(book.overflow).toBe(4);
  });

  it("星球掌握度 = 卫星 mastery 均值", () => {
    const g = graph(
      [note(1, "书"), note(2, "章一", 0.8), note(3, "章二", 0.4)],
      [edge(1, 2), edge(2, 1), edge(1, 3), edge(3, 1)],
    );
    const planets = derivePlanets(g);
    expect(planets[0].mastery).toBeCloseTo(0.6, 5);
  });

  it("卫星无 mastery 时回落到星球自身 mastery", () => {
    const g = graph(
      [note(1, "书", 0.5), note(2, "章一"), note(3, "章二")],
      [edge(1, 2), edge(2, 1), edge(1, 3), edge(3, 1)],
    );
    const planets = derivePlanets(g);
    expect(planets[0].mastery).toBe(0.5);
  });

  it("空图返回空数组", () => {
    expect(derivePlanets(graph([], []))).toEqual([]);
  });

  it("星球按卫星数降序排前列", () => {
    const nodes: GraphNode[] = [note(1, "小书"), note(2, "大书")];
    const edges: GraphEdge[] = [edge(1, 10), edge(10, 1)];
    nodes.push(note(10, "a"));
    for (let i = 20; i < 24; i++) {
      nodes.push(note(i, `b${i}`));
      edges.push(edge(2, i), edge(i, 2));
    }
    const planets = derivePlanets(graph(nodes, edges));
    expect(planets[0].id).toBe(2);
    expect(planets[0].sats.length).toBeGreaterThan(planets[1].sats.length);
  });
});
