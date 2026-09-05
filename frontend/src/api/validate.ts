// 响应窄化共用助手（MVP-01 起引入）。
// 背景：部分端点后端注解为 `-> dict`，OpenAPI 响应体是自由 schema；
// 各消费模块用这些助手对实际消费字段做运行时校验（contract_mismatch，不静默漂移）。
import { ApiError } from "./client";

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

export function asString(v: unknown, field: string): string {
  if (typeof v !== "string") {
    throw new ApiError(0, "contract_mismatch", `${field} 非字符串`);
  }
  return v;
}
