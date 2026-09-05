// wrapper 单元测试（node 环境，无 jsdom——沿用项目测试惯例）。
// 只测 wrapper 自身逻辑：JSON 编码 / 错误解包 / path 调用；网络层 mock fetch。
import { afterEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "./client";

function mockFetch(status: number, body: unknown, contentType = "application/json") {
  const fn = vi.fn().mockResolvedValue(
    new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { "Content-Type": contentType },
    }),
  );
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api wrapper", () => {
  it("get 返回解析后的 JSON", async () => {
    const fetchMock = mockFetch(200, { notes: [] });
    const res = await api.get("/api/v1/notes");
    expect(res).toEqual({ notes: [] });
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/notes", expect.anything());
  });

  it("post 发送 JSON body 与 Content-Type", async () => {
    const fetchMock = mockFetch(201, { note: {} });
    await api.post("/api/v1/notes", { title: "测试", content_md: "# 中文\n\n第二行" });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.parse(init.body as string)).toEqual({
      title: "测试",
      content_md: "# 中文\n\n第二行",
    });
  });

  it("非 2xx 解包统一错误契约 {error:{code,message}}", async () => {
    mockFetch(409, { error: { code: "duplicate_title", message: "已存在同名笔记" } });
    const err = await api.post("/api/v1/notes", { title: "x", content_md: "" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    const apiErr = err as ApiError;
    expect(apiErr.status).toBe(409);
    expect(apiErr.code).toBe("duplicate_title");
    expect(apiErr.message).toBe("已存在同名笔记");
  });

  it("非 JSON 错误体回退为 http_<status>", async () => {
    mockFetch(500, "Internal Server Error", "text/plain");
    const err = await api.get("/api/v1/notes").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe("http_500");
  });

  it("patch 携带 method PATCH", async () => {
    const fetchMock = mockFetch(200, { note: {} });
    await api.patch("/api/v1/notes/{note_id}", { content_md: "更新" });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("PATCH");
  });
});
