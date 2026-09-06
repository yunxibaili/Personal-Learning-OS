// SSE 解析与消费（Phase 1-A §2 契约的实现）。
//
// 帧格式（后端 server/app/routers/conversations.py `_sse()`，勿再猜）：
//   data: {"text": "<chunk>"}\n\n                          → 数据帧（无 event 行）
//   event: done\ndata: {"conversation_id": N}\n\n           → 正常收尾
//   event: error\ndata: {"code":"...","message":"..."}\n\n  → 生成期失败
//
// 三条解析铁律：
//   1. 跨 chunk 边界——TCP 不保证一帧一包，必须持缓冲区按空行切分，残留留给下次
//   2. UTF-8 多字节——中文 chunk 可能横跨两个 Uint8Array，必须 TextDecoder{stream:true}
//   3. 无 `event:` 行即数据帧（SSE 默认事件名 message）
//
// 与 HTTP 错误的分界：HTTP 非 2xx 由 client.postStream 抛 ApiError（JSON 通道）；
// 本文件的 event: error 是"请求已被受理、生成过程中失败"（帧通道），两者不得混用。
import { ApiError } from "./client";

export type SseEvent =
  | { type: "text"; text: string }
  | { type: "done"; conversationId: number }
  | { type: "error"; code: string; message: string };

function parseJsonPayload(raw: string): Record<string, unknown> {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new ApiError(0, "contract_mismatch", `SSE data 非 JSON：${raw.slice(0, 80)}`);
  }
  if (typeof value !== "object" || value === null) {
    throw new ApiError(0, "contract_mismatch", "SSE data 非对象");
  }
  return value as Record<string, unknown>;
}

function asString(v: unknown, field: string): string {
  if (typeof v !== "string") {
    throw new ApiError(0, "contract_mismatch", `${field} 非字符串`);
  }
  return v;
}

/** 解析单个事件块（已去掉结尾空行）。返回 null 表示该块无 data（心跳/注释）。 */
function parseBlock(raw: string): SseEvent | null {
  let eventName = "";
  const dataLines: string[] = [];
  for (const line of raw.split("\n")) {
    const lineTrimmed = line.endsWith("\r") ? line.slice(0, -1) : line;
    if (lineTrimmed === "" || lineTrimmed.startsWith(":")) continue;
    const idx = lineTrimmed.indexOf(":");
    const field = idx === -1 ? lineTrimmed : lineTrimmed.slice(0, idx);
    let value = idx === -1 ? "" : lineTrimmed.slice(idx + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "event") eventName = value;
    else if (field === "data") dataLines.push(value);
  }
  if (dataLines.length === 0) return null;

  const payload = parseJsonPayload(dataLines.join("\n"));
  if (eventName === "done") {
    const id = payload["conversation_id"];
    if (typeof id !== "number") {
      throw new ApiError(0, "contract_mismatch", "done 帧缺 conversation_id");
    }
    return { type: "done", conversationId: id };
  }
  if (eventName === "error") {
    return {
      type: "error",
      code: asString(payload["code"] ?? "provider_error", "error.code"),
      message: asString(payload["message"] ?? "生成失败", "error.message"),
    };
  }
  return { type: "text", text: asString(payload["text"] ?? "", "text") };
}

function nextBoundary(buf: string): { index: number; length: number } | null {
  const match = /\r\n\r\n|\n\n/.exec(buf);
  return match === null ? null : { index: match.index, length: match[0].length };
}

export interface SseParser {
  /** 追加一段文本，返回其中已完整到达的事件。 */
  push(chunk: string): SseEvent[];
  /** 连接结束时处理缓冲区残留（后端必以 \n\n 收尾，正常为空）。 */
  flush(): SseEvent[];
}

export function createSseParser(): SseParser {
  let buffer = "";
  return {
    push(chunk: string): SseEvent[] {
      buffer += chunk;
      const events: SseEvent[] = [];
      for (;;) {
        const boundary = nextBoundary(buffer);
        if (boundary === null) break;
        const raw = buffer.slice(0, boundary.index);
        buffer = buffer.slice(boundary.index + boundary.length);
        const event = parseBlock(raw);
        if (event !== null) events.push(event);
      }
      return events;
    },
    flush(): SseEvent[] {
      const rest = buffer;
      buffer = "";
      if (rest.trim() === "") return [];
      const event = parseBlock(rest);
      return event === null ? [] : [event];
    },
  };
}

/**
 * 消费 SSE 响应体，逐事件回调。
 *
 * 调用方负责 AbortController：signal 触发时 reader.read() 以 AbortError reject，
 * 本函数不吞该异常（交由调用方区分 STOPPED 与 ERROR）。
 */
export async function readSseStream(
  res: Response,
  onEvent: (event: SseEvent) => void,
): Promise<void> {
  if (res.body === null) {
    throw new ApiError(0, "contract_mismatch", "SSE 响应无 body");
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  const parser = createSseParser();
  let finished = false;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        finished = true;
        break;
      }
      // stream:true 让跨 chunk 的 UTF-8 未完字节留在解码器内部缓冲，不产生乱码
      const text = decoder.decode(value, { stream: true });
      for (const event of parser.push(text)) onEvent(event);
    }
    // 仅在此处 flush 一次：取出解码器残留字节（stream 中间调用 decode() 会重置解码器状态）
    const tail = decoder.decode();
    if (tail !== "") for (const event of parser.push(tail)) onEvent(event);
    for (const event of parser.flush()) onEvent(event);
  } finally {
    // 仅在正常读完后释放锁；abort 时存在 pending read，releaseLock 会抛 TypeError
    if (finished) reader.releaseLock();
  }
}
