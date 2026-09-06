// ADR-029 §6：最小 fetch wrapper。
// 只做：base URL / JSON 头 / 非 2xx 类型化错误（解包 {"error":{code,message}}）/
// path-based 类型化请求。禁止：重试、缓存、请求去重、业务态推断、本地持久化。
//
// 契约来源 = backend OpenAPI（schema.d.ts 的 `paths`，path-keyed）。
// operationId（如 list_notes_api_v1_notes_get）由 FastAPI 从 Python 函数名生成，
// 不是前端稳定契约——所有调用一律以 path 为键，Python 函数重命名不影响前端。
//
// base URL：默认空串（同源，dev 期经 vite proxy 转发，backend 无 CORS 中间件，
// 见 ADR-029 §2.4）；部署形态变化时用 VITE_API_BASE 指向后端 origin。
import type { paths } from "./schema";

const BASE: string = import.meta.env.VITE_API_BASE ?? "";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

type Method = "get" | "post" | "patch" | "delete" | "put";

type JsonOf<T> = T extends { content: { "application/json": infer R } } ? R : never;
type Ok2xx = "200" | "201" | "202" | "204";

export type ResponseOf<P extends keyof paths & string, M extends Method> =
  paths[P][M] extends { responses: infer Rs }
    ? JsonOf<Rs[Extract<keyof Rs, Ok2xx>]>
    : never;

export type BodyOf<P extends keyof paths & string, M extends Method> =
  paths[P][M] extends { requestBody?: { content: { "application/json": infer B } } }
    ? B
    : never;

// 422 HTTPValidationError 的 detail 形如 [{type,loc,msg,input}]；取首条 msg 作为可读提示。
// 该形状与项目统一错误契约 {error:{code,message}} 不同——两条错误通道必须区分（见 §2.4）。
function validationMessage(detail: unknown): string | null {
  if (typeof detail === "string" && detail !== "") return detail;
  if (!Array.isArray(detail)) return null;
  for (const item of detail) {
    if (typeof item === "string") return item;
    if (typeof item === "object" && item !== null) {
      const msg = (item as { msg?: unknown }).msg;
      if (typeof msg === "string") return msg;
    }
  }
  return null;
}

async function toApiError(res: Response): Promise<ApiError> {
  let code = `http_${res.status}`;
  let message = res.statusText;
  try {
    const body: unknown = await res.json();
    const err = (body as { error?: { code?: string; message?: string } } | null)?.error;
    if (err?.code !== undefined) {
      code = err.code;
      message = err.message ?? message;
    } else {
      const detail = (body as { detail?: unknown } | null)?.detail;
      const msg = validationMessage(detail);
      if (msg !== null) {
        code = "validation_error";
        message = msg;
      }
    }
  } catch {
    // 非 JSON 错误体：保持默认 code/message
  }
  return new ApiError(res.status, code, message);
}

async function request<M extends Method, P extends keyof paths & string>(
  method: M,
  path: P,
  body?: BodyOf<P, M>,
  params?: Record<string, string>,
): Promise<ResponseOf<P, M>> {
  const qs = params ? `?${new URLSearchParams(params).toString()}` : "";
  const res = await fetch(`${BASE}${path}${qs}`, {
    method: method.toUpperCase(),
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw await toApiError(res);
  if (res.status === 204) return undefined as ResponseOf<P, M>;
  return (await res.json()) as ResponseOf<P, M>;
}

// SSE 流式请求（Phase 1）：与 request() 平行，不复用其内部实现。
// 差异：① 不带 Content-Type 之外的约定 ② 必须传 signal（Stop 的唯一入口）
// ③ 成功时不消费 body——返回 Response 由调用方 getReader()，避免 res.json() 破坏流。
// HTTP 层错误（400/404/422/502/504）仍走 JSON 通道；生成期错误走 SSE event: error 帧。
export async function postStream<P extends keyof paths & string>(
  path: P,
  body: BodyOf<P, "post">,
  signal: AbortSignal,
): Promise<Response> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw await toApiError(res);
  return res;
}

export const api = {
  get: <P extends keyof paths & string>(path: P, params?: Record<string, string>) =>
    request("get", path, undefined, params),
  post: <P extends keyof paths & string>(path: P, body: BodyOf<P, "post">) =>
    request("post", path, body),
  patch: <P extends keyof paths & string>(path: P, body: BodyOf<P, "patch">) =>
    request("patch", path, body),
  delete: <P extends keyof paths & string>(path: P) => request("delete", path),
};
