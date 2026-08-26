import { beforeEach, describe, expect, it } from "vitest";

import { useUi } from "./ui";

describe("ui store（Zustand 占位状态）", () => {
  beforeEach(() => {
    useUi.setState({ activeView: "notes" });
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
});
