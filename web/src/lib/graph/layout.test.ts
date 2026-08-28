import { describe, expect, it } from "vitest";

import { dagreLayout, DEFAULT_NODE_SIZE } from "./layout";
import type { LayoutEdge, LayoutNode } from "./layout";

function makeNode(id: string, type: "concept" | "note" = "concept"): LayoutNode {
  return { id, type, ...DEFAULT_NODE_SIZE[type] };
}

function makeEdge(source: string, target: string, id?: string): LayoutEdge {
  return { id: id ?? `${source}~${target}`, source, target };
}

describe("dagreLayout", () => {
  it("空输入返回空结果", () => {
    const r = dagreLayout([], []);
    expect(r.nodes).toEqual([]);
    expect(r.edges).toEqual([]);
  });

  it("单节点布局在原点附近", () => {
    const r = dagreLayout([makeNode("c1")], []);
    expect(r.nodes).toHaveLength(1);
    expect(r.nodes[0].id).toBe("c1");
    expect(typeof r.nodes[0].x).toBe("number");
    expect(typeof r.nodes[0].y).toBe("number");
  });

  it("有向边产生层级：source 在 target 上方（TB 方向）", () => {
    const nodes = [makeNode("a"), makeNode("b")];
    const edges = [makeEdge("a", "b")];
    const r = dagreLayout(nodes, edges);
    const posA = r.nodes.find((n) => n.id === "a")!;
    const posB = r.nodes.find((n) => n.id === "b")!;
    // TB 方向：rank 越小 y 越小
    expect(posA.y).toBeLessThan(posB.y);
  });

  it("同层节点 y 坐标相近", () => {
    // a→b, a→c：b 和 c 在同一层
    const nodes = [makeNode("a"), makeNode("b"), makeNode("c")];
    const edges = [makeEdge("a", "b"), makeEdge("a", "c")];
    const r = dagreLayout(nodes, edges);
    const posB = r.nodes.find((n) => n.id === "b")!;
    const posC = r.nodes.find((n) => n.id === "c")!;
    // 同层 y 坐标应该接近（差值小于层级间距）
    expect(Math.abs(posB.y - posC.y)).toBeLessThan(60);
  });

  it("输出包含画布尺寸", () => {
    const r = dagreLayout([makeNode("a")], []);
    expect(r.width).toBeGreaterThan(0);
    expect(r.height).toBeGreaterThan(0);
  });

  it("确定性：相同输入两次结果一致", () => {
    const nodes = [makeNode("a"), makeNode("b"), makeNode("c")];
    const edges = [makeEdge("a", "b"), makeEdge("b", "c")];
    const r1 = dagreLayout(nodes, edges);
    const r2 = dagreLayout(nodes, edges);
    expect(r1.nodes).toEqual(r2.nodes);
    expect(r1.edges).toEqual(r2.edges);
  });

  it("混合 concept/note 节点布局正确", () => {
    const nodes = [makeNode("c1", "concept"), makeNode("n1", "note"), makeNode("c2", "concept")];
    const edges = [makeEdge("n1", "c1"), makeEdge("n1", "c2")];
    const r = dagreLayout(nodes, edges);
    expect(r.nodes).toHaveLength(3);
    const posN1 = r.nodes.find((n) => n.id === "n1")!;
    const posC1 = r.nodes.find((n) => n.id === "c1")!;
    // n1 是 source，应该在 c1 上方
    expect(posN1.y).toBeLessThan(posC1.y);
  });
});
