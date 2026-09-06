import { describe, expect, it } from "vitest";
import {
  workbenchReducer, initialWorkbench, objectKey, enforceMutualExclusion,
  type WorkObject,
} from "./model";

/** Workbench 状态机门禁（ADR-031 · UI-WORKBENCH-IA §1/§11） */

const noteA: WorkObject = { key: "note:1", obj: { kind: "note", id: 1 }, title: "A" };
const noteB: WorkObject = { key: "note:2", obj: { kind: "note", id: 2 }, title: "B" };
const noteC: WorkObject = { key: "note:3", obj: { kind: "note", id: 3 }, title: "C" };

describe("open / tabs", () => {
  it("open 替换 primary 并追加 tab（同一对象不重复入 tab）", () => {
    let s = workbenchReducer(initialWorkbench, { type: "open", object: noteA });
    s = workbenchReducer(s, { type: "open", object: noteB });
    s = workbenchReducer(s, { type: "open", object: noteA });
    expect(s.tabs.map((t) => t.key)).toEqual(["note:1", "note:2"]);
    expect(s.activeKey).toBe("note:1");
  });

  it("activate / closeTab：关闭 primary 时活性落到最后一个 tab", () => {
    let s = workbenchReducer(initialWorkbench, { type: "open", object: noteA });
    s = workbenchReducer(s, { type: "open", object: noteB });
    s = workbenchReducer(s, { type: "activate", key: "note:1" });
    s = workbenchReducer(s, { type: "closeTab", key: "note:1" });
    expect(s.activeKey).toBe("note:2");
  });
});

describe("Compare 右槽（天然 locked）", () => {
  it("openRight 进入 S3 且不进 tabs", () => {
    let s = workbenchReducer(initialWorkbench, { type: "open", object: noteA });
    s = workbenchReducer(s, { type: "openRight", object: noteB });
    expect(s.layout).toBe("S3");
    expect(s.side?.key).toBe("note:2");
    expect(s.tabs.map((t) => t.key)).toEqual(["note:1"]);
  });

  it("locked：openRight 后再 open，只替换 primary，不顶掉 Side Object", () => {
    let s = workbenchReducer(initialWorkbench, { type: "open", object: noteA });
    s = workbenchReducer(s, { type: "openRight", object: noteB });
    s = workbenchReducer(s, { type: "open", object: noteC });
    expect(s.activeKey).toBe("note:3");
    expect(s.side?.key).toBe("note:2");
  });

  it("closeSide 回到 S0（无 pane 开启时）", () => {
    let s = workbenchReducer(initialWorkbench, { type: "open", object: noteA });
    s = workbenchReducer(s, { type: "openRight", object: noteB });
    s = workbenchReducer(s, { type: "closeSide" });
    expect(s.layout).toBe("S0");
    expect(s.side).toBeNull();
  });
});

describe("pane 开合派生布局（S0–S2）", () => {
  it("默认 S0", () => {
    expect(initialWorkbench.layout).toBe("S0");
  });
  it("开 Explorer → S1；再开 Context → S2", () => {
    let s = workbenchReducer(initialWorkbench, { type: "toggleExplorer" });
    expect(s.layout).toBe("S1");
    s = workbenchReducer(s, { type: "toggleContext" });
    expect(s.layout).toBe("S2");
  });
});

describe("Focus（S4 快照恢复）", () => {
  it("enterFocus 收起 pane 并记录快照；exitFocus 逐项恢复", () => {
    let s = workbenchReducer(initialWorkbench, { type: "open", object: noteA });
    s = workbenchReducer(s, { type: "toggleExplorer" });
    s = workbenchReducer(s, { type: "toggleContext" }); // S2
    s = workbenchReducer(s, { type: "enterFocus" });
    expect(s.layout).toBe("S4");
    expect(s.explorerOpen).toBe(false);
    expect(s.contextOpen).toBe(false);
    s = workbenchReducer(s, { type: "exitFocus" });
    expect(s.layout).toBe("S2");
    expect(s.explorerOpen).toBe(true);
    expect(s.contextOpen).toBe(true);
  });

  it("S4 下再 enterFocus 幂等（返回同一状态，不重拍快照）", () => {
    const s1 = workbenchReducer(initialWorkbench, { type: "enterFocus" });
    const s2 = workbenchReducer(s1, { type: "enterFocus" });
    expect(s2).toBe(s1);
    expect(s2.layout).toBe("S4");
  });
});

describe("Annotation（内存态，Phase 4 持久化提案）", () => {
  it("add/update/remove 闭环", () => {
    let s = workbenchReducer(initialWorkbench, { type: "addAnnotation", quote: "q", note: "", objKey: "note:1" });
    const id = s.annotations[0].id;
    s = workbenchReducer(s, { type: "updateAnnotation", id, note: "我的理解" });
    expect(s.annotations[0].note).toBe("我的理解");
    s = workbenchReducer(s, { type: "removeAnnotation", id });
    expect(s.annotations).toHaveLength(0);
  });
});

describe("响应式互斥（IA §7）", () => {
  it("窄断点下 Explorer 与 Context 互斥（Explorer 保留）", () => {
    let s = workbenchReducer(initialWorkbench, { type: "toggleExplorer" });
    s = workbenchReducer(s, { type: "toggleContext" });
    s = enforceMutualExclusion(s, true);
    expect(s.explorerOpen).toBe(true);
    expect(s.contextOpen).toBe(false);
  });
  it("宽断点不干预", () => {
    let s = workbenchReducer(initialWorkbench, { type: "toggleExplorer" });
    s = workbenchReducer(s, { type: "toggleContext" });
    expect(enforceMutualExclusion(s, false).contextOpen).toBe(true);
  });
});

describe("对象 key", () => {
  it("note/concept 带 id；review/tutor 为常量", () => {
    expect(objectKey({ kind: "note", id: 7 })).toBe("note:7");
    expect(objectKey({ kind: "concept", id: 9 })).toBe("concept:9");
    expect(objectKey({ kind: "review" })).toBe("review");
  });
});
