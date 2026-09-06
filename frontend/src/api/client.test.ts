// wrapper 单元测试（node 环境，无 jsdom——沿用项目测试惯例）。
// 只测 wrapper 自身逻辑：JSON 编码 / 错误解包 / path 调用；网络层 mock fetch。
import { afterEach, describe, expect, it, vi } from "vitest";
import { api, ApiError, postStream } from "./client";

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

describe("api query params", () => {
  it("get 附加 query 参数（URLSearchParams 编码）", async () => {
    const fetchMock = mockFetch(200, { results: [] });
    await api.get("/api/v1/search", { q: "中文x" });
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe(`/api/v1/search?q=${encodeURIComponent("中文x")}`);
  });
});

describe("422 HTTPValidationError（与统一 error 形状并存的第二通道）", () => {
  it("detail 为对象数组时取首条 msg", async () => {
    mockFetch(422, { detail: [{ type: "string_too_short", loc: ["body", "query"], msg: "至少 1 个字符" }] });
    const err = await api.get("/api/v1/notes").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(422);
    expect((err as ApiError).code).toBe("validation_error");
    expect((err as ApiError).message).toBe("至少 1 个字符");
  });

  it("detail 为纯字符串时直接使用", async () => {
    mockFetch(422, { detail: "请求体不合法" });
    const err = await api.get("/api/v1/notes").catch((e: unknown) => e);
    expect((err as ApiError).code).toBe("validation_error");
    expect((err as ApiError).message).toBe("请求体不合法");
  });

  it("同时存在 error 字段时优先统一契约（不误判为 validation_error）", async () => {
    mockFetch(400, { error: { code: "too_many_notes", message: "最多 2 篇" }, detail: [] });
    const err = await api.get("/api/v1/notes").catch((e: unknown) => e);
    expect((err as ApiError).code).toBe("too_many_notes");
  });
});

describe("postStream（Phase 1 SSE，与 request 平行）", () => {
  function mockStream(status: number) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"text":"a"}\n\n'));
        controller.close();
      },
    });
    const fn = vi.fn().mockResolvedValue(
      new Response(stream, { status, headers: { "Content-Type": "text/event-stream" } }),
    );
    vi.stubGlobal("fetch", fn);
    return fn;
  }

  it("成功时返回未消费 body 的 Response（不调用 res.json）", async () => {
    const fetchMock = mockStream(200);
    const res = await postStream(
      "/api/v1/chat",
      {
        conversation_id: 1,
        query: "q",
        mode: "explain",
        stream: true,
        auto_notes: false,
        concept_id: null,
        note_ids: null,
      },
      new AbortController().signal,
    );
    expect(res.status).toBe(200);
    expect(res.body).not.toBeNull();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
  });

  it("携带 signal——Stop 的唯一入口", async () => {
    const fetchMock = mockStream(200);
    const controller = new AbortController();
    await postStream(
      "/api/v1/chat",
      {
        conversation_id: 1,
        query: "q",
        mode: "explain",
        stream: true,
        auto_notes: false,
        concept_id: null,
        note_ids: null,
      },
      controller.signal,
    );
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBe(controller.signal);
  });

  it("非 2xx 抛 ApiError（HTTP 层仍走 JSON 通道）", async () => {
    mockFetch(502, { error: { code: "provider_error", message: "boom" } });
    const err = await postStream(
      "/api/v1/chat",
      {
        conversation_id: 1,
        query: "q",
        mode: "explain",
        stream: true,
        auto_notes: false,
        concept_id: null,
        note_ids: null,
      },
      new AbortController().signal,
    ).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe("provider_error");
  });
});
