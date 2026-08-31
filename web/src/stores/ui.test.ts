import { beforeEach, describe, expect, it } from "vitest";

import { useUi } from "./ui";

describe("ui store（Zustand 占位状态）", () => {
  beforeEach(() => {
    useUi.setState({ activeView: "notes", tutorSeed: null, tutorReturnView: null });
  });

  it("默认视图是笔记", () => {
    expect(useUi.getState().activeView).toBe("notes");
  });

  it("setActiveView 切换视图", () => {
    useUi.getState().setActiveView("graph");
    expect(useUi.getState().activeView).toBe("graph");
    useUi.getState().setActiveView("tutor");
    expect(useUi.getState().activeView).toBe("tutor");
  });

  // ── P8-006：tutorSeed / tutorReturnView ──────────────────────

  it("openTutor 记录返回视图并携带 seed", () => {
    useUi.getState().setActiveView("review");
    useUi.getState().openTutor({ conceptId: 7, mode: "hint" });
    const s = useUi.getState();
    expect(s.activeView).toBe("tutor");
    expect(s.tutorReturnView).toBe("review");
    expect(s.tutorSeed).toEqual({ conceptId: 7, mode: "hint" });
  });

  it("closeTutor 回到进入前的视图并清空 seed", () => {
    useUi.getState().setActiveView("review");
    useUi.getState().openTutor({ conceptId: 7, mode: "hint" });
    useUi.getState().closeTutor();
    const s = useUi.getState();
    expect(s.activeView).toBe("review"); // 不是 notes——P8-006 关键语义
    expect(s.tutorSeed).toBeNull();
    expect(s.tutorReturnView).toBeNull();
  });

  it("无返回记录时 closeTutor 回笔记工作区", () => {
    useUi.setState({ activeView: "tutor", tutorReturnView: null });
    useUi.getState().closeTutor();
    expect(useUi.getState().activeView).toBe("notes");
  });

  it("openTutorForConcept 是 openTutor 的兼容包装", () => {
    useUi.getState().openTutorForConcept(3);
    expect(useUi.getState().activeView).toBe("tutor");
    expect(useUi.getState().tutorSeed).toEqual({ conceptId: 3 });
  });

  it("consumeTutorSeed 取走即清除（一次性）", () => {
    useUi.getState().openTutor({
      noteIds: [{ note_id: 1, title: "A" }],
      mode: "explain",
    });
    const seed = useUi.getState().consumeTutorSeed();
    expect(seed).toEqual({ noteIds: [{ note_id: 1, title: "A" }], mode: "explain" });
    expect(useUi.getState().tutorSeed).toBeNull();
    expect(useUi.getState().consumeTutorSeed()).toBeNull();
  });

  it("Tutor 内再次 openTutor 不覆盖原返回视图", () => {
    useUi.getState().setActiveView("review");
    useUi.getState().openTutor({ conceptId: 1 });
    useUi.getState().openTutor({ conceptId: 2 }); // seed 更新，returnView 保持
    expect(useUi.getState().tutorReturnView).toBe("review");
  });
});
