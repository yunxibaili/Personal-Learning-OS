// review 消费端测试：队列/答题/统计/历史投影与坏形状拒绝。
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./client";
import {
  getReviewHistory,
  getReviewStats,
  getTodayQueue,
  submitAnswer,
} from "./review";

function mockFetch(status: number, body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const ITEM = {
  concept_id: 1,
  due_at: "2026-09-05 14:00:00",
  priority: 0.8,
  status: "pending",
  last_result: "wrong",
  created_at: "t",
  updated_at: "t",
  title: "概念A",
  effective: 0.1,
  effective_now: 0.09,
};

describe("getTodayQueue", () => {
  it("投影队列项（last_result null 安全）", async () => {
    mockFetch(200, { reviews: [ITEM, { ...ITEM, concept_id: 2, last_result: null }] });
    const q = await getTodayQueue();
    expect(q[0].last_result).toBe("wrong");
    expect(q[1].last_result).toBeNull();
  });

  it("缺 reviews 数组 → contract_mismatch", async () => {
    mockFetch(200, {});
    const err = await getTodayQueue().catch((e: unknown) => e);
    expect((err as ApiError).code).toBe("contract_mismatch");
  });
});

describe("submitAnswer", () => {
  it("POST 路径替换 + 只发送 quality；返回后端 SM-2 三字段", async () => {
    const fetchMock = mockFetch(200, {
      mastery: {},
      next_review: "2026-09-10 14:00:00",
      ease_factor: 2.6,
      interval: 6,
    });
    const r = await submitAnswer(3, 5);
    const [url, init] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/v1/review/3/answer");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ quality: 5 });
    expect(r).toEqual({ next_review: "2026-09-10 14:00:00", ease_factor: 2.6, interval: 6 });
  });

  it("缺 next_review → contract_mismatch", async () => {
    mockFetch(200, { mastery: {}, ease_factor: 2.5, interval: 1 });
    const err = await submitAnswer(1, 3).catch((e: unknown) => e);
    expect((err as ApiError).code).toBe("contract_mismatch");
  });
});

describe("getReviewStats", () => {
  it("投影 stats 与 by_concept", async () => {
    mockFetch(200, {
      stats: {
        total_reviews: 3, correct: 2, wrong: 1, accuracy: 0.6667,
        current_streak: 1,
        by_concept: [{ concept_id: 1, title: "概念A", count: 1, correct: 1, wrong: 0 }],
      },
    });
    const s = await getReviewStats();
    expect(s.total_reviews).toBe(3);
    expect(s.by_concept[0].title).toBe("概念A");
  });

  it("缺 stats → contract_mismatch", async () => {
    mockFetch(200, {});
    const err = await getReviewStats().catch((e: unknown) => e);
    expect((err as ApiError).code).toBe("contract_mismatch");
  });
});

describe("getReviewHistory", () => {
  it("limit 作为 query 参数发送", async () => {
    const fetchMock = mockFetch(200, { history: [] });
    await getReviewHistory(5);
    const [url] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(url).toBe("/api/v1/review/history?limit=5");
  });

  it("投影 history 项", async () => {
    mockFetch(200, {
      history: [{ id: 1, concept_id: 1, event_type: "answer_correct", title: "A", created_at: "t" }],
    });
    const list = await getReviewHistory();
    expect(list[0].event_type).toBe("answer_correct");
  });
});
