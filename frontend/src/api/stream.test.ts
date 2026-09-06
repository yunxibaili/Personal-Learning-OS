// SSE 解析测试（node 环境，沿用项目 vitest 惯例）。
// 重点覆盖三条铁律：跨 chunk 边界 · UTF-8 多字节 · 无 event 行即数据帧。
import { describe, expect, it } from "vitest";
import { ApiError } from "./client";
import { createSseParser, readSseStream, type SseEvent } from "./stream";

function sseFrame(payload: string, event?: string): string {
  return event === undefined
    ? `data: ${payload}\n\n`
    : `event: ${event}\ndata: ${payload}\n\n`;
}

describe("createSseParser", () => {
  it("数据帧（无 event 行）解析为 text", () => {
    const parser = createSseParser();
    expect(parser.push(sseFrame('{"text":"你好"}'))).toEqual([
      { type: "text", text: "你好" },
    ]);
  });

  it("done 帧给出 conversation_id", () => {
    const parser = createSseParser();
    expect(parser.push(sseFrame('{"conversation_id":7}', "done"))).toEqual([
      { type: "done", conversationId: 7 },
    ]);
  });

  it("error 帧给出 code 与 message", () => {
    const parser = createSseParser();
    expect(parser.push(sseFrame('{"code":"provider_timeout","message":"超时"}', "error"))).toEqual([
      { type: "error", code: "provider_timeout", message: "超时" },
    ]);
  });

  it("一帧被拆成两次 push：收齐前不产生事件", () => {
    const parser = createSseParser();
    expect(parser.push('data: {"text":"线')).toEqual([]);
    expect(parser.push('性代数"}\n\n')).toEqual([{ type: "text", text: "线性代数" }]);
  });

  it("一次 push 含多帧：全部产出且顺序不变", () => {
    const parser = createSseParser();
    const events = parser.push(
      sseFrame('{"text":"a"}') + sseFrame('{"text":"b"}') + sseFrame('{"conversation_id":1}', "done"),
    );
    expect(events).toEqual([
      { type: "text", text: "a" },
      { type: "text", text: "b" },
      { type: "done", conversationId: 1 },
    ]);
  });

  it("兼容 CRLF 分隔", () => {
    const parser = createSseParser();
    expect(parser.push('data: {"text":"x"}\r\n\r\n')).toEqual([{ type: "text", text: "x" }]);
  });

  it("心跳注释行（: 开头）被忽略", () => {
    const parser = createSseParser();
    expect(parser.push(": keep-alive\n\n")).toEqual([]);
  });

  it("data 非 JSON 时抛 contract_mismatch", () => {
    const parser = createSseParser();
    let thrown: unknown;
    try {
      parser.push("data: not-json\n\n");
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(ApiError);
    expect((thrown as ApiError).code).toBe("contract_mismatch");
  });
});

describe("readSseStream", () => {
  it("跨 UTF-8 字节边界的中文不会产生乱码", async () => {
    const encoder = new TextEncoder();
    const head = encoder.encode('data: {"text":"');
    const tail = encoder.encode('特征值"}\n\n');
    // 切在「特」的 3 字节中间（第 1 字节后），模拟 TCP 分包
    const cut = 1;
    const first = new Uint8Array([...head, ...tail.slice(0, cut)]);
    const second = tail.slice(cut);

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(first);
        controller.enqueue(second);
        controller.close();
      },
    });

    const events: SseEvent[] = [];
    await readSseStream(new Response(stream), (e) => events.push(e));
    expect(events).toEqual([{ type: "text", text: "特征值" }]);
  });

  it("多帧流式到达时按序回调（含 done 收尾）", async () => {
    const encoder = new TextEncoder();
    const parts = [
      'data: {"text":"第一段"}\n\n',
      'data: {"text":"第二段"}\n\n',
      'event: done\ndata: {"conversation_id":42}\n\n',
    ];
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const part of parts) controller.enqueue(encoder.encode(part));
        controller.close();
      },
    });

    const events: SseEvent[] = [];
    await readSseStream(new Response(stream), (e) => events.push(e));
    expect(events).toEqual([
      { type: "text", text: "第一段" },
      { type: "text", text: "第二段" },
      { type: "done", conversationId: 42 },
    ]);
  });

  it("响应无 body 时抛 contract_mismatch", async () => {
    await expect(readSseStream(new Response(null), () => {})).rejects.toMatchObject({
      code: "contract_mismatch",
    });
  });
});
