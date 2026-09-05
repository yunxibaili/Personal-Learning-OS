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

async function request<M extends Method, P extends keyof paths & string>(
  method: M,
  path: P,
  body?: BodyOf<P, M>,
): Promise<ResponseOf<P, M>> {
  const res = await fetch(`${BASE}${path}`, {
    method: method.toUpperCase(),
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let code = `http_${res.status}`;
    let message = res.statusText;
    try {
      const err = (await res.json())?.error as
        | { code?: string; message?: string }
        | undefined;
      if (err?.code !== undefined) {
        code = err.code;
        message = err.message ?? message;
      }
    } catch {
      // 非 JSON 错误体：保持默认 code/message
    }
    throw new ApiError(res.status, code, message);
  }
  if (res.status === 204) return undefined as ResponseOf<P, M>;
  return (await res.json()) as ResponseOf<P, M>;
}

export const api = {
  get: <P extends keyof paths & string>(path: P) => request("get", path),
  post: <P extends keyof paths & string>(path: P, body: BodyOf<P, "post">) =>
    request("post", path, body),
  patch: <P extends keyof paths & string>(path: P, body: BodyOf<P, "patch">) =>
    request("patch", path, body),
  delete: <P extends keyof paths & string>(path: P) => request("delete", path),
};
