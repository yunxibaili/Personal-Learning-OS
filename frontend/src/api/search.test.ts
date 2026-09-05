// search 消费端测试：q 传参 / 结果投影 / 坏形状拒绝。
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./client";
import { searchNotes } from "./search";

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

describe("searchNotes", () => {
  it("q 作为 query 参数发送（URLSearchParams form-urlencoded 语义）", async () => {
    const fetchMock = mockFetchOnce(200, { results: [] });
    await searchNotes("注意力 机制");
    const [url] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    // URLSearchParams 空格编码为 '+'，Starlette 按 form-urlencoded 解码回空格
    expect(url).toBe(`/api/v1/search?${new URLSearchParams({ q: "注意力 机制" }).toString()}`);
  });

  it("投影 results 的 note_id/title", async () => {
    mockFetchOnce(200, { results: [{ note_id: 2, title: "注意力机制" }] });
    expect(await searchNotes("注意力")).toEqual([{ note_id: 2, title: "注意力机制" }]);
  });

  it("响应缺 results 数组 → contract_mismatch", async () => {
    mockFetchOnce(200, { unexpected: true });
    const err = await searchNotes("x").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe("contract_mismatch");
  });

  it("result.title 非字符串 → contract_mismatch", async () => {
    mockFetchOnce(200, { results: [{ note_id: 1, title: 42 }] });
    const err = await searchNotes("x").catch((e: unknown) => e);
    expect((err as ApiError).code).toBe("contract_mismatch");
  });

  it("空结果数组 → 空列表（empty state 数据源）", async () => {
    mockFetchOnce(200, { results: [] });
    expect(await searchNotes("量子纠缠不存在")).toEqual([]);
  });
});
