/**
 * Universe 布局引擎纯函数测试（P8-001B）。
 * 只测布局逻辑，不测 CSS/动画/hover/DOM（项目纪律：不为 UI 写测试）。
 */
import { describe, expect, it } from "vitest";

import {
  centralPlanet,
  computeUniverseLayout,
  domainGrouping,
  forceLayout,
  normalizeToCenter,
  settleOnDrag,
  type LayoutConcept,
} from "./layout";

const CONCEPTS: LayoutConcept[] = [
  { id: 1, domain: "ML", mastery: 0.9 },
  { id: 2, domain: "ML", mastery: 0.5 },
  { id: 3, domain: "ML", mastery: null },
  { id: 4, domain: "Optimization", mastery: 0.2 },
  { id: 5, domain: "Optimization", mastery: 0.0 },
  { id: 6, domain: "NLP", mastery: 0.7 },
  { id: 7, domain: null, mastery: null },
];

describe("domainGrouping", () => {
  it("按 domain 分组，null 归入 未分类", () => {
    const groups = domainGrouping(CONCEPTS);
    const byDomain = Object.fromEntries(groups.map((g) => [g.domain, g.ids]));
    expect(byDomain["ML"]).toHaveLength(3);
    expect(byDomain["Optimization"]).toHaveLength(2);
    expect(byDomain["NLP"]).toHaveLength(1);
    expect(byDomain["未分类"]).toEqual([7]);
  });

  it("分组顺序确定：按概念数降序，再按域名排序", () => {
    const a = domainGrouping(CONCEPTS);
    const b = domainGrouping([...CONCEPTS].reverse());
    expect(a.map((g) => g.domain)).toEqual(b.map((g) => g.domain));
  });

  it("域中心围绕原点径向分布", () => {
    const groups = domainGrouping(CONCEPTS);
    for (const g of groups) {
      const d = Math.hypot(g.center.x, g.center.y);
      expect(d).toBeGreaterThan(250);
      expect(d).toBeLessThan(330);
    }
  });

  it("空输入返回空数组", () => {
    expect(domainGrouping([])).toEqual([]);
  });
});

describe("centralPlanet", () => {
  it("统计 concept 数 / domain 数 / mastery 总量", () => {
    const p = centralPlanet(CONCEPTS);
    expect(p.conceptCount).toBe(7);
    expect(p.domainCount).toBe(4); // ML/Optimization/NLP/未分类
    expect(p.masterySum).toBeCloseTo(0.9 + 0.5 + 0.2 + 0.7, 5);
    expect(p.hasMastery).toBe(4);
  });

  it("masteryAvg = 总量 / 概念数（含 null 计 0）", () => {
    const p = centralPlanet(CONCEPTS);
    expect(p.masteryAvg).toBeCloseTo(p.masterySum / 7, 5);
  });

  it("空输入 planet 全零不报错", () => {
    const p = centralPlanet([]);
    expect(p.conceptCount).toBe(0);
    expect(p.domainCount).toBe(0);
    expect(p.masteryAvg).toBe(0);
  });
});

describe("forceLayout", () => {
  it("输出确定性：相同输入两次结果一致", () => {
    const edges = [{ source: 1, target: 2 }];
    const a = forceLayout(CONCEPTS, edges, { iterations: 100 });
    const b = forceLayout(CONCEPTS, edges, { iterations: 100 });
    expect(a.size).toBe(7);
    for (const [id, pa] of a) {
      const pb = b.get(id)!;
      expect(pa.x).toBeCloseTo(pb.x, 6);
      expect(pa.y).toBeCloseTo(pb.y, 6);
    }
  });

  it("同 domain 节点平均距离小于跨 domain 平均距离（聚类生效）", () => {
    const edges = [
      { source: 1, target: 4 },
      { source: 2, target: 5 },
    ];
    const pos = forceLayout(CONCEPTS, edges, { iterations: 300 });
    const dist = (a: number, b: number) => {
      const pa = pos.get(a)!;
      const pb = pos.get(b)!;
      return Math.hypot(pa.x - pb.x, pa.y - pb.y);
    };
    const sameDomain = (dist(1, 2) + dist(1, 3) + dist(2, 3) + dist(4, 5)) / 4;
    const crossDomain = (dist(1, 4) + dist(2, 5) + dist(3, 6)) / 3;
    expect(sameDomain).toBeLessThan(crossDomain);
  });

  it("fixed 节点被锁定在目标坐标", () => {
    const fixed = new Map<number, { x: number; y: number }>([[1, { x: 100, y: -100 }]]);
    const pos = forceLayout(CONCEPTS, [], { fixed, iterations: 50 });
    expect(pos.get(1)!.x).toBeCloseTo(100, 5);
    expect(pos.get(1)!.y).toBeCloseTo(-100, 5);
  });

  it("空节点返回空 map", () => {
    expect(forceLayout([], []).size).toBe(0);
  });
});

describe("normalizeToCenter", () => {
  it("将坐标集平移到目标中心", () => {
    const pos = new Map<number, { x: number; y: number }>([
      [1, { x: 110, y: -10 }],
      [2, { x: 90, y: 10 }],
    ]);
    const out = normalizeToCenter(pos, { x: 0, y: 0 });
    const cx = (out.get(1)!.x + out.get(2)!.x) / 2;
    const cy = (out.get(1)!.y + out.get(2)!.y) / 2;
    expect(cx).toBeCloseTo(0, 6);
    expect(cy).toBeCloseTo(0, 6);
  });
});

describe("settleOnDrag", () => {
  it("拖动一个节点后返回全部节点坐标，被拖节点锁定", () => {
    const out = settleOnDrag(CONCEPTS, [], 1, { x: 300, y: 0 });
    expect(out.size).toBe(7);
    expect(out.get(1)!.x).toBeCloseTo(300, 5);
    expect(out.get(1)!.y).toBeCloseTo(0, 5);
  });
});

describe("computeUniverseLayout", () => {
  it("返回坐标 + 分组 + 星球统计 + 画布尺寸", () => {
    const res = computeUniverseLayout(CONCEPTS, [{ source: 1, target: 2 }]);
    expect(res.positions.size).toBe(7);
    expect(res.groups.length).toBeGreaterThanOrEqual(3);
    expect(res.planet.conceptCount).toBe(7);
    expect(res.width).toBeGreaterThan(0);
    expect(res.height).toBeGreaterThan(0);
  });
});
