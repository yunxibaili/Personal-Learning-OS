// ADR-030 UX-002：当前会话 UI 状态持久化测试（node 环境，无新依赖）。
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChatMessage, ConversationSummary } from "./conversations";
import {
  CURRENT_CONVERSATION_KEY,
  clearCurrentConversationId,
  isStale,
  readCurrentConversationId,
  restoreCurrentConversation,
  shouldClearForDeletion,
  writeCurrentConversationId,
} from "./currentConversation";

function fakeStorage(initial?: Record<string, string>): Storage {
  const map = new Map<string, string>(Object.entries(initial ?? {}));
  return {
    getItem: (k: string) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    get length() {
      return map.size;
    },
  } as Storage;
}

function conv(id: number): ConversationSummary {
  return { id, title: "新对话", created_at: "2026-09-06T10:00:00", message_count: 2 };
}

function msg(id: number, role: string): ChatMessage {
  return { id, role, content: "x", context: {}, created_at: "2026-09-06T10:00:00" };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("storage key", () => {
  it("canonical key 固定为 current_conversation_id", () => {
    expect(CURRENT_CONVERSATION_KEY).toBe("current_conversation_id");
  });

  it("无 key / 非法值 → null；写入后可回读", () => {
    vi.stubGlobal("sessionStorage", fakeStorage());
    expect(readCurrentConversationId()).toBeNull();

    writeCurrentConversationId(34);
    expect(sessionStorage.getItem(CURRENT_CONVERSATION_KEY)).toBe("34");
    expect(readCurrentConversationId()).toBe(34);

    sessionStorage.setItem(CURRENT_CONVERSATION_KEY, "not-a-number");
    expect(readCurrentConversationId()).toBeNull();
  });

  it("clear 后回读为 null", () => {
    vi.stubGlobal("sessionStorage", fakeStorage({ [CURRENT_CONVERSATION_KEY]: "7" }));
    clearCurrentConversationId();
    expect(readCurrentConversationId()).toBeNull();
  });

  it("sessionStorage 不可用时退化为不持久化且不抛错", () => {
    vi.stubGlobal("sessionStorage", undefined);
    expect(readCurrentConversationId()).toBeNull();
    expect(() => writeCurrentConversationId(1)).not.toThrow();
    expect(() => clearCurrentConversationId()).not.toThrow();
  });
});

describe("restoreCurrentConversation", () => {
  // 验收点 1：无 key → 正常空态
  it("无 key → empty，且不请求 messages", async () => {
    vi.stubGlobal("sessionStorage", fakeStorage());
    const getMessages = vi.fn().mockResolvedValue([]);
    const out = await restoreCurrentConversation({
      listConversations: async () => [conv(2)],
      getMessages,
    });
    expect(out.kind).toBe("empty");
    expect(getMessages).not.toHaveBeenCalled();
    if (out.kind === "empty") expect(out.conversations).toHaveLength(1);
  });

  // 验收点 2：有效 key → 恢复 conversation + messages
  it("有效 key → restored（含 messages）", async () => {
    vi.stubGlobal("sessionStorage", fakeStorage({ [CURRENT_CONVERSATION_KEY]: "34" }));
    const out = await restoreCurrentConversation({
      listConversations: async () => [conv(34), conv(33)],
      getMessages: async () => [msg(1, "user"), msg(2, "assistant")],
    });
    expect(out).toMatchObject({ kind: "restored", conversationId: 34 });
    if (out.kind === "restored") {
      expect(out.messages).toHaveLength(2);
      expect(out.conversations.map((c) => c.id)).toEqual([34, 33]);
    }
    // 离开 Tutor tab 再进入 = 同一条 mount 恢复路径，故不另设用例。
  });

  // 验收点 3：stale ID → clear + 空态 + 无错误
  it("stale ID → 清 key + stale（无 error 字段）", async () => {
    vi.stubGlobal("sessionStorage", fakeStorage({ [CURRENT_CONVERSATION_KEY]: "999" }));
    const out = await restoreCurrentConversation({
      listConversations: async () => [conv(34)],
      getMessages: async () => [],
    });
    expect(out.kind).toBe("stale");
    expect("message" in out).toBe(false);
    expect(readCurrentConversationId()).toBeNull();
  });

  // 验收点 4：list failure → key 保留 + 显式错误（不静默）
  it("list 失败 → list_failed 且 key 保留", async () => {
    vi.stubGlobal("sessionStorage", fakeStorage({ [CURRENT_CONVERSATION_KEY]: "34" }));
    const out = await restoreCurrentConversation({
      listConversations: async () => {
        throw new Error("boom");
      },
      getMessages: async () => [],
    });
    expect(out).toMatchObject({ kind: "list_failed", message: "boom" });
    expect(readCurrentConversationId()).toBe(34);
  });

  it("messages 失败 → messages_failed，key 保留且会话仍选中", async () => {
    vi.stubGlobal("sessionStorage", fakeStorage({ [CURRENT_CONVERSATION_KEY]: "34" }));
    const out = await restoreCurrentConversation({
      listConversations: async () => [conv(34)],
      getMessages: async () => {
        throw new Error("nope");
      },
    });
    expect(out).toMatchObject({ kind: "messages_failed", conversationId: 34, message: "nope" });
    expect(readCurrentConversationId()).toBe(34);
  });
});

describe("isStale", () => {
  it("列表不含该 id 即 stale", () => {
    expect(isStale([conv(1), conv(2)], 3)).toBe(true);
    expect(isStale([conv(1), conv(2)], 2)).toBe(false);
  });
});

describe("shouldClearForDeletion", () => {
  // 验收点 5：删除当前 → clear
  it("删除当前会话 → 清除", () => {
    expect(shouldClearForDeletion(34, 34)).toBe(true);
  });

  // 附加：删除非当前 → 不改变 key
  it("删除非当前会话 → 不清除", () => {
    expect(shouldClearForDeletion(33, 34)).toBe(false);
  });

  it("无当前会话 → 不清除", () => {
    expect(shouldClearForDeletion(33, null)).toBe(false);
  });
});

// ── 源码门禁：生成生命周期与渲染不得触碰 key（ADR-030 §6.2、§8）──────────────
describe("ChatPanel 写入点门禁", () => {
  // glob 键相对当前文件；源码门禁沿用项目既有 `?raw` 做法，避免引入 node 类型依赖。
  const raw = import.meta.glob("../features/tutor/ChatPanel.tsx", {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>;
  const src = Object.values(raw)[0] ?? "";
  const count = (needle: string) => src.split(needle).length - 1;

  it("源码可被读取（门禁前置）", () => {
    expect(src).toContain("ChatPanel");
  });

  it("write 仅在新建 / 切换两处", () => {
    expect(count("writeCurrentConversationId(")).toBe(2);
  });

  it("clear 仅在删除当前会话一处", () => {
    expect(count("clearCurrentConversationId(")).toBe(1);
  });

  // 验收点 7 / 附加：send 及其之后的渲染代码一律不改 key
  it("send() 之后（含 JSX）不再出现任何 key 写入 / 清除", () => {
    const tail = src.slice(src.indexOf("async function send("));
    expect(tail).not.toContain("writeCurrentConversationId(");
    expect(tail).not.toContain("clearCurrentConversationId(");
  });

  it("不使用 localStorage（ADR-030 规定 sessionStorage）", () => {
    expect(src).not.toContain("localStorage");
  });
});
