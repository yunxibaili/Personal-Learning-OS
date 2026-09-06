// Conversation CRUD 消费测试（node 环境）。
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./client";
import {
  assistantMessageView,
  asMessageStatus,
  createConversation,
  deleteConversation,
  getMessages,
  listConversations,
  type ChatMessage,
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

// ── UX-004/008：消息生命周期 status ─────────────────────────────────

describe("asMessageStatus", () => {
  it("三态原样通过", () => {
    expect(asMessageStatus("complete")).toBe("complete");
    expect(asMessageStatus("failed")).toBe("failed");
    expect(asMessageStatus("stopped")).toBe("stopped");
  });

  it("缺失 / 未知值回退 complete（不伪造失败或中断）", () => {
    expect(asMessageStatus(undefined)).toBe("complete");
    expect(asMessageStatus("bogus")).toBe("complete");
  });
});

describe("getMessages 携带 status", () => {
  it("三态都能解析；缺失字段回退 complete", async () => {
    mockFetch(200, {
      messages: [
        { id: 1, role: "user", content: "问", status: "complete", context: {}, created_at: "t1" },
        { id: 2, role: "assistant", content: "", status: "failed", created_at: "t2" },
        { id: 3, role: "assistant", content: "部分", status: "stopped", created_at: "t3" },
        { id: 4, role: "assistant", content: "旧", created_at: "t4" },
      ],
    });
    const messages = await getMessages(12);
    expect(messages.map((m) => m.status)).toEqual(["complete", "failed", "stopped", "complete"]);
  });
});

function msg(role: string, content: string, status: ChatMessage["status"]): ChatMessage {
  return { id: 1, role, content, status, context: {}, created_at: "t" };
}

describe("assistantMessageView", () => {
  it("complete → 原样内容，无提示", () => {
    expect(assistantMessageView(msg("assistant", "答案", "complete"))).toEqual({
      text: "答案",
      note: null,
    });
  });

  it("user 消息永不产生状态提示", () => {
    expect(assistantMessageView(msg("user", "问题", "stopped"))).toEqual({
      text: "问题",
      note: null,
    });
  });

  it("failed + 空内容 → 失败占位文案", () => {
    expect(assistantMessageView(msg("assistant", "", "failed"))).toEqual({
      text: "本次生成失败，无内容",
      note: null,
    });
  });

  it("failed + 非空内容 → 保留内容 + 失败提示", () => {
    expect(assistantMessageView(msg("assistant", "半句", "failed"))).toEqual({
      text: "半句",
      note: "本次生成失败",
    });
  });

  it("stopped + 空内容 → 中断占位文案", () => {
    expect(assistantMessageView(msg("assistant", "", "stopped")).text).toBe("生成已中断，无内容");
  });

  it("stopped + 非空内容 → 保留内容 + 中断提示（不声称用户点了停止）", () => {
    const view = assistantMessageView(msg("assistant", "半句", "stopped"));
    expect(view.text).toBe("半句");
    expect(view.note).toBe("生成已中断，仅显示已生成部分");
    expect(`${view.text}${view.note ?? ""}`).not.toContain("用户已停止");
  });
});

// ── UX-008 源码门禁：瞬时停止提示已退场 ─────────────────────────────

describe("ChatPanel 生命周期呈现门禁", () => {
  const raw = import.meta.glob("../features/tutor/ChatPanel.tsx", {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>;
  const src = Object.values(raw)[0] ?? "";

  it("不再出现瞬时 chat-stopped 与「已停止」断言", () => {
    expect(src).not.toContain("chat-stopped");
    expect(src).not.toContain("已停止");
  });

  it("呈现走 assistantMessageView（后端 status 驱动）", () => {
    expect(src).toContain("assistantMessageView(");
    expect(src).toContain("m.status");
  });
});
