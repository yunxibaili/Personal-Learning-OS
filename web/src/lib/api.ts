/** 唯一的后端访问入口（separation.md）：所有请求走 /api/v1，错误统一 ApiError。 */

// 桌面打包（tauri build --mode desktop）：sidecar 固定 127.0.0.1:8100（见
// server/backend_main.py 与 TASKS §T-P0-2b）；dev（vite proxy）与 web 部署用相对路径。
const API_BASE = import.meta.env.MODE === "desktop" ? "http://127.0.0.1:8100" : "";
const BASE = `${API_BASE}/api/v1`;

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  // FormData 由浏览器自带 boundary；仅 JSON 请求显式声明 Content-Type
  if (init?.body != null && typeof init.body === "string") {
    headers.set("Content-Type", "application/json");
  }

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { ...init, headers });
  } catch {
    throw new ApiError("network_error", "无法连接本地服务", 0);
  }

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = (body as { error?: { code?: string; message?: string } }).error;
    throw new ApiError(
      err?.code ?? `http_${res.status}`,
      err?.message ?? res.statusText,
      res.status,
    );
  }
  return body as T;
}

export const apiGet = <T,>(path: string) => api<T>(path);

export const apiPost = <T,>(path: string, data?: unknown) =>
  api<T>(path, { method: "POST", body: JSON.stringify(data ?? {}) });

/**
 * SSE 流式 POST（B2：POST /chat `stream=true` → text/event-stream）。
 * 帧契约与 server/app/routers/conversations.py `_sse` 对齐：
 *   `data: {...}` ×N → `event: done` / `event: error`，均以空行分帧。
 * TFrame = 该端点的 shared/types 帧契约（如 TutorStreamFrame）；
 * 后端数据帧不带 event 行，此处统一补全为 "data" 后交给调用方。
 * 参数校验等 HTTP 层失败仍是统一 JSON 错误体（非 SSE 流），按 ApiError 抛出。
 * 中止经 handlers.signal（AbortController）；AbortError 原样上抛由调用方区分。
 */
export async function apiPostStream<TFrame extends { event: string }>(
  path: string,
  body: unknown,
  handlers: { onFrame: (frame: TFrame) => void; signal?: AbortSignal },
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
      signal: handlers.signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiError("network_error", "无法连接本地服务", 0);
  }

  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    const err = (j as { error?: { code?: string; message?: string } }).error;
    throw new ApiError(
      err?.code ?? `http_${res.status}`,
      err?.message ?? res.statusText,
      res.status,
    );
  }

  const reader = res.body?.getReader();
  if (!reader) throw new ApiError("network_error", "响应体不可读", res.status);
  const decoder = new TextDecoder();
  let buf = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let sep: number;
      while ((sep = buf.indexOf("\n\n")) !== -1) {
        const block = buf.slice(0, sep);
        buf = buf.slice(sep + 2);
        let event = "data";
        let data: Record<string, unknown> = {};
        for (const line of block.split("\n")) {
          if (line.startsWith("event: ")) event = line.slice(7).trim();
          else if (line.startsWith("data: ")) {
            try {
              data = JSON.parse(line.slice(6)) as Record<string, unknown>;
            } catch {
              // 坏帧跳过：不中断整条流
            }
          }
        }
        handlers.onFrame({ event, ...data } as TFrame);
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export const apiPatch = <T,>(path: string, data: unknown) =>
  api<T>(path, { method: "PATCH", body: JSON.stringify(data) });

export const apiPut = <T,>(path: string, data: unknown) =>
  api<T>(path, { method: "PUT", body: JSON.stringify(data) });

export const apiDelete = <T,>(path: string) => api<T>(path, { method: "DELETE" });

export function apiUpload<T>(path: string, file: File): Promise<T> {
  const fd = new FormData();
  fd.append("file", file);
  return api<T>(path, { method: "POST", body: fd });
}

/** MindMap concept binding (M2b-002) */
export interface ConceptResult {
  id: number;
  title: string;
  domain: string;
  status: string;
}

export const searchConcepts = (q: string) =>
  apiGet<ConceptResult[]>(`/mindmaps/concepts/search?q=${encodeURIComponent(q)}`);

export const bindConcept = (mapId: number, nodeId: number, conceptId: number) =>
  apiPost(`/mindmaps/${mapId}/nodes/${nodeId}/bind`, { concept_id: conceptId });

export const unbindConcept = (mapId: number, nodeId: number) =>
  apiDelete(`/mindmaps/${mapId}/nodes/${nodeId}/bind`);

/** settings KV（P1-5-A）：GET 返回脱敏值，敏感键为 "******" */
export interface SettingsResponse {
  settings: Record<string, string>;
}

export const getSettings = () => apiGet<SettingsResponse>("/settings");

export const saveSettings = (settings: Record<string, string>) =>
  apiPut<{ ok: boolean }>("/settings", { settings });
