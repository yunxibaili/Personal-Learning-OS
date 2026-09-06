// Conversation CRUD 消费测试（node 环境）。
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./client";
import {
  createConversation,
  deleteConversation,
  getMessages,
  listConversations,
} from "./conversations";

function mockFetch(status: number, body: unknown) {
  const fn = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }),
  );
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("listConversations", () => {
  it("窄化列表字段", async () => {
    mockFetch(200, {
      conversations: [{ id: 2, title: "新对话", created_at: "2026-09-06T10:00:00", message_count: 4 }],
    });
    expect(await listConversations()).toEqual([
      { id: 2, title: "新对话", created_at: "2026-09-06T10:00:00", message_count: 4 },
    ]);
  });

  it("缺 conversations 数组时抛 contract_mismatch", async () => {
    mockFetch(200, {});
    await expect(listConversations()).rejects.toMatchObject({ code: "contract_mismatch" });
  });
});

describe("createConversation", () => {
  it("201 返回 id/title 并补 message_count=0", async () => {
    mockFetch(201, { id: 5, title: "新对话" });
    expect(await createConversation()).toEqual({
      id: 5,
      title: "新对话",
      created_at: expect.any(String),
      message_count: 0,
    });
  });

  it("title 传空串由后端回退（前端不自行造标题规则）", async () => {
    const fetchMock = mockFetch(201, { id: 6, title: "新对话" });
    await createConversation();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ title: "" });
  });
});

describe("getMessages", () => {
  it("path 参数被替换，context 缺失时补空对象", async () => {
    const fetchMock = mockFetch(200, {
      messages: [
        { id: 1, role: "user", content: "问", context: {}, created_at: "t1" },
        { id: 2, role: "assistant", content: "", created_at: "t2" },
      ],
    });
    const messages = await getMessages(12);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe("/api/v1/conversations/12/messages");
    expect(messages[1]?.content).toBe("");
    expect(messages[1]?.context).toEqual({});
  });

  it("messages 非数组时抛 contract_mismatch", async () => {
    mockFetch(200, { messages: "x" });
    await expect(getMessages(1)).rejects.toMatchObject({ code: "contract_mismatch" });
  });
});

describe("deleteConversation", () => {
  it("调用 DELETE 且 path 参数正确", async () => {
    const fetchMock = mockFetch(200, { ok: true });
    await deleteConversation(8);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/v1/conversations/8");
    expect(init.method).toBe("DELETE");
  });

  it("404 解包为 conversation_not_found", async () => {
    mockFetch(404, { error: { code: "conversation_not_found", message: "conversation 8 not found" } });
    const err = await deleteConversation(8).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe("conversation_not_found");
  });
});
