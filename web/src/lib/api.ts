/** 唯一的后端访问入口（separation.md）：所有请求走 /api/v1，错误统一 ApiError。 */

const BASE = "/api/v1";

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
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...init,
    });
  } catch {
    // 网络层失败（后端未启动/断网）
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
