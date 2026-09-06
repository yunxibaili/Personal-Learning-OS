// /chat 消费测试（node 环境）。
// 覆盖：请求构造的必填键 · SSE 回调分发 · HTTP 错误走 JSON 通道（含 422 detail 形状）。
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./client";
import { buildChatRequest, streamChat, type TutorMode } from "./chat";
import type { SseEvent } from "./stream";

function sseFrame(payload: string, event?: string): string {
  return event === undefined ? `data: ${payload}\n\n` : `event: ${event}\ndata: ${payload}\n\n`;
}

function mockSse(frames: string[]) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const frame of frames) controller.enqueue(encoder.encode(frame));
      controller.close();
    },
  });
  const fn = vi.fn().mockResolvedValue(
    new Response(stream, { status: 200, headers: { "Content-Type": "text/event-stream" } }),
  );
  vi.stubGlobal("fetch", fn);
  return fn;
}

function mockJson(status: number, body: unknown) {
  const fn = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("buildChatRequest", () => {
  it("显式构造全部必填键（auto_notes / mode / stream 均不省略）", () => {
    const req = buildChatRequest({
      conversationId: 3,
      query: "什么是特征值",
      mode: "hint",
    });
    expect(req).toEqual({
      conversation_id: 3,
      query: "什么是特征值",
      mode: "hint",
      stream: true,
      auto_notes: false,
      concept_id: null,
      note_ids: null,
    });
  });

  it("stream 恒为 true——Phase 1 只有一条 generation path", () => {
    const req = buildChatRequest({ conversationId: 1, query: "q", mode: "explain" });
    expect(req.stream).toBe(true);
  });

  it("auto_notes 显式传 false 而非省略（与 tutor.ts 既有做法一致）", () => {
    const req = buildChatRequest({ conversationId: 1, query: "q", mode: "explain" });
    expect(Object.prototype.hasOwnProperty.call(req, "auto_notes")).toBe(true);
    expect(req.auto_notes).toBe(false);
  });

  it("空 note_ids 归为 null；非空原样透传", () => {
    expect(buildChatRequest({ conversationId: 1, query: "q", mode: "explain", noteIds: [] }).note_ids)
      .toBeNull();
    expect(
      buildChatRequest({ conversationId: 1, query: "q", mode: "explain", noteIds: [5, 6] }).note_ids,
    ).toEqual([5, 6]);
  });

  it("conceptId 未给时为 null（自由问答）", () => {
    expect(buildChatRequest({ conversationId: 1, query: "q", mode: "explain" }).concept_id).toBeNull();
  });

  it("mode 取自 generated 枚举，四种都通过类型", () => {
    const modes: TutorMode[] = ["explain", "hint", "review", "debug"];
    for (const mode of modes) {
      expect(buildChatRequest({ conversationId: 1, query: "q", mode }).mode).toBe(mode);
    }
  });
});

describe("streamChat", () => {
  it("逐 chunk 回调，done 帧给出 conversation_id", async () => {
    mockSse([
      sseFrame('{"text":"特征"}'),
      sseFrame('{"text":"值"}'),
      sseFrame('{"conversation_id":9}', "done"),
    ]);
    const chunks: string[] = [];
    let doneId: number | null = null;
    await streamChat(
      { conversationId: 9, query: "q", mode: "explain" },
      new AbortController().signal,
      {
        onText: (t) => chunks.push(t),
        onDone: (id) => {
          doneId = id;
        },
        onError: () => {
          throw new Error("不应出错");
        },
      },
    );
    expect(chunks).toEqual(["特征", "值"]);
    expect(doneId).toBe(9);
  });

  it("error 帧走帧通道（不抛异常）", async () => {
    mockSse([sseFrame('{"code":"provider_timeout","message":"超时"}', "error")]);
    const errors: Array<{ code: string; message: string }> = [];
    await streamChat(
      { conversationId: 1, query: "q", mode: "explain" },
      new AbortController().signal,
      {
        onText: () => {},
        onDone: () => {},
        onError: (code, message) => errors.push({ code, message }),
      },
    );
    expect(errors).toEqual([{ code: "provider_timeout", message: "超时" }]);
  });

  it("HTTP 400 走 JSON 错误通道，抛 ApiError", async () => {
    mockJson(400, { error: { code: "too_many_notes", message: "note_ids 最多 2 篇" } });
    const err = await streamChat(
      { conversationId: 1, query: "q", mode: "explain", noteIds: [1, 2, 3] },
      new AbortController().signal,
      { onText: () => {}, onDone: () => {}, onError: () => {} },
    ).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe("too_many_notes");
  });

  it("HTTP 422 detail 形状解包为 validation_error", async () => {
    mockJson(422, { detail: [{ type: "string_too_short", loc: ["body", "query"], msg: "至少 1 个字符" }] });
    const err = await streamChat(
      { conversationId: 1, query: "", mode: "explain" },
      new AbortController().signal,
      { onText: () => {}, onDone: () => {}, onError: () => {} },
    ).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(422);
    expect((err as ApiError).code).toBe("validation_error");
    expect((err as ApiError).message).toBe("至少 1 个字符");
  });

  it("请求体带 signal——Stop 的唯一入口", async () => {
    const fetchMock = mockSse([sseFrame('{"conversation_id":1}', "done")]);
    const controller = new AbortController();
    await streamChat(
      { conversationId: 1, query: "q", mode: "explain" },
      controller.signal,
      { onText: () => {}, onDone: () => {}, onError: () => {} },
    );
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBe(controller.signal);
  });

  it("SSE 事件类型分发完整（text/done/error 三态互斥）", () => {
    const events: SseEvent[] = [
      { type: "text", text: "a" },
      { type: "done", conversationId: 1 },
      { type: "error", code: "c", message: "m" },
    ];
    expect(events.map((e) => e.type)).toEqual(["text", "done", "error"]);
  });
});
