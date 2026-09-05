// mastery 消费端测试：投影 / 数组容器字段 / 坏形状拒绝。
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./client";
import { listMastery, listWeakConcepts } from "./mastery";

function mockFetch(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const ENTRY = {
  concept_id: 1,
  title: "注意力",
  dimensions: { knowledge: 0.08, practice: 0, recall: 0.15, transfer: 0 },
  effective: 0.058,
  effective_now: 0.058,
  next_review: null,
  ease_factor: 2.5,
  interval: 0,
  review_count: 0,
};

describe("listMastery", () => {
  it("投影 mastery 数组", async () => {
    mockFetch(200, { mastery: [ENTRY] });
    const list = await listMastery();
    expect(list).toEqual([
      {
        concept_id: 1,
        title: "注意力",
        dimensions: { knowledge: 0.08, practice: 0, recall: 0.15, transfer: 0 },
        effective: 0.058,
        effective_now: 0.058,
      },
    ]);
  });

  it("空列表 → 空数组", async () => {
    mockFetch(200, { mastery: [] });
    expect(await listMastery()).toEqual([]);
  });

  it("缺 mastery 数组 → contract_mismatch", async () => {
    mockFetch(200, { wrong: true });
    const err = await listMastery().catch((e: unknown) => e);
    expect((err as ApiError).code).toBe("contract_mismatch");
  });
});

describe("listWeakConcepts", () => {
  it("投影 weak 数组", async () => {
    mockFetch(200, { weak: [ENTRY] });
    expect((await listWeakConcepts())[0].title).toBe("注意力");
  });

  it("缺 weak 数组 → contract_mismatch", async () => {
    mockFetch(200, { mastery: [ENTRY] }); // 容器字段名错误
    const err = await listWeakConcepts().catch((e: unknown) => e);
    expect((err as ApiError).code).toBe("contract_mismatch");
  });

  it("dimensions 缺失 → contract_mismatch", async () => {
    mockFetch(200, { weak: [{ concept_id: 1, title: "t", effective: 0, effective_now: 0 }] });
    const err = await listWeakConcepts().catch((e: unknown) => e);
    expect((err as ApiError).code).toBe("contract_mismatch");
  });
});
