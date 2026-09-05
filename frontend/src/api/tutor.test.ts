// tutor context 消费端测试：9 section 投影 / mastery 全零 / review null /
// notes 显式+auto / 坏形状拒绝 / 请求体形状。
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./client";
import { postTutorContext } from "./tutor";

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

const CONTEXT = {
  concept: { id: 1, title: "注意力" },
  mastery: { knowledge: 0.08, practice: 0, recall: 0, transfer: 0, effective: 0.028 },
  mistakes: [{ id: 1, description: "复习答错（quality=2）", occurred_at: "t" }],
  related: [{ id: 2, title: "深度学习", relation: "wikilink" }],
  review: { next_review: "2026-09-06 14:00:00", priority: 0.8, last_result: "wrong" },
  recent_events: [{ event_type: "answer_wrong", source: "review", created_at: "t" }],
  notes: [{ note_id: 1, title: "注意力笔记", excerpt: "[[注意力]]是核心。" }],
  memories: [],
};

describe("postTutorContext", () => {
  it("完整投影 9 个 section（review 对象、memories 空数组保留）", async () => {
    mockFetch(200, CONTEXT);
    const ctx = await postTutorContext({ concept_id: 1, note_ids: [1] });
    expect(ctx.concept.title).toBe("注意力");
    expect(ctx.mastery.effective).toBe(0.028);
    expect(ctx.mistakes[0].description).toContain("复习答错");
    expect(ctx.related[0].relation).toBe("wikilink");
    expect(ctx.review?.last_result).toBe("wrong");
    expect(ctx.recent_events[0].event_type).toBe("answer_wrong");
    expect(ctx.notes[0].excerpt).toContain("核心");
    expect(ctx.memories).toEqual([]);
  });

  it("review=null 按语义保留为 null", async () => {
    mockFetch(200, { ...CONTEXT, review: null });
    expect((await postTutorContext({ concept_id: 1 })).review).toBeNull();
  });

  it("mastery 全零对象（无记录语义）正常投影", async () => {
    mockFetch(200, {
      ...CONTEXT,
      mastery: { knowledge: 0, practice: 0, recall: 0, transfer: 0, effective: 0 },
    });
    const ctx = await postTutorContext({ concept_id: 2 });
    expect(ctx.mastery).toEqual({
      knowledge: 0, practice: 0, recall: 0, transfer: 0, effective: 0,
    });
  });

  it("请求体：无引用时只含 concept_id + auto_notes:false", async () => {
    const fetchMock = mockFetch(200, CONTEXT);
    await postTutorContext({ concept_id: 1 });
    const [, init] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ concept_id: 1, auto_notes: false });
  });

  it("请求体：auto_notes=true 显式传递", async () => {
    const fetchMock = mockFetch(200, CONTEXT);
    await postTutorContext({ concept_id: 1, auto_notes: true });
    const [, init] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      concept_id: 1, auto_notes: true,
    });
  });

  it("缺 notes 数组 → contract_mismatch", async () => {
    mockFetch(200, { ...CONTEXT, notes: undefined });
    const err = await postTutorContext({ concept_id: 1 }).catch((e: unknown) => e);
    expect((err as ApiError).code).toBe("contract_mismatch");
  });

  it("缺 concept → contract_mismatch", async () => {
    mockFetch(200, { ...CONTEXT, concept: undefined });
    const err = await postTutorContext({ concept_id: 1 }).catch((e: unknown) => e);
    expect((err as ApiError).code).toBe("contract_mismatch");
  });
});
