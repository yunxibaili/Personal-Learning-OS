// notes 消费端窄化模块测试：合法形状 → 投影；缺字段/坏形状 → contract_mismatch
// （后端响应体在 OpenAPI 中尚为自由 dict，见 notes.ts 头注）。
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./client";
import { getNote, listNotes, saveNoteContent } from "./notes";

function mockFetchOnce(status: number, body: unknown) {
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

const NOTE_DETAIL = {
  note: {
    id: 1,
    path: "测试.md",
    title: "测试",
    tags: [],
    updated_at: "2026-09-05 12:00:00",
    parent_id: null,
    content_md: "# 中文标题\n\n- 换行保留\n",
  },
};

describe("notes 消费端", () => {
  it("listNotes 投影 notes 数组", async () => {
    mockFetchOnce(200, { notes: [{ id: 1, title: "A", path: "A.md", tags_json: "[]", updated_at: "t", parent_id: null }] });
    const list = await listNotes();
    expect(list).toEqual([{ id: 1, title: "A", path: "A.md", tags: [], updated_at: "t", parent_id: null }]);
  });

  it("getNote 读取 content_md 并保留中文/换行", async () => {
    mockFetchOnce(200, NOTE_DETAIL);
    const note = await getNote(1);
    expect(note.content_md).toBe("# 中文标题\n\n- 换行保留\n");
  });

  it("saveNoteContent 只发送 content_md", async () => {
    const fetchMock = mockFetchOnce(200, NOTE_DETAIL);
    await saveNoteContent(1, "新内容");
    const [, init] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ content_md: "新内容" });
  });

  it("响应缺 content_md → contract_mismatch（不静默漂移）", async () => {
    mockFetchOnce(200, { note: { id: 1, title: "t", path: "t.md", tags: [], updated_at: "x" } });
    const err = await getNote(1).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe("contract_mismatch");
  });

  it("响应缺 notes 数组 → contract_mismatch", async () => {
    mockFetchOnce(200, { unexpected: true });
    const err = await listNotes().catch((e: unknown) => e);
    expect((err as ApiError).code).toBe("contract_mismatch");
  });
});
