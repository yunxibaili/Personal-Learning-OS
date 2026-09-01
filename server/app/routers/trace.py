"""Trace API：POST /api/v1/trace/run（ADR-025 §4.4 / §4.5 / §5.3 / §5.7）

红线（§5.3）：handler 必须是同步 `def`——subprocess.run 是阻塞调用，
`async def` 会冻结整个事件循环最长 10s。由守护测试锁定非协程。

请求体校验在 handler 内手工完成而非 pydantic `extra="forbid"`：
main.py 的全局 RequestValidationError handler 把校验失败统一转成
400 `invalid_body`，而 ADR §4.5 要求 `code` 等未知字段收到即 **422**——
状态码语义不同，不能共用那条全局通道。
"""
from __future__ import annotations

import threading
from typing import Any

from fastapi import APIRouter, Body
from fastapi.responses import JSONResponse

from ..core.tracer import (
    UnknownExampleError,
    describe_example,
    list_examples,
    read_example_source,
    run_trace,
)
from ..core.tracer.limits import MAX_CONCURRENT_TRACES

router = APIRouter(prefix="/api/v1/trace", tags=["trace"])

# §5.7：进程内信号量（API 层第六道护栏，不属于 §5.1 五重限制）。
# acquire(blocking=False) 失败即 429，不排队——串行化让超时/取消语义最简单。
_trace_semaphore = threading.Semaphore(MAX_CONCURRENT_TRACES)

# §4.5 TraceRunRequest 冻结字段；其余一律按未知字段拒绝
_ALLOWED_FIELDS = {"example_id", "mode"}


@router.post("/run")
def run_trace_endpoint(payload: dict = Body(...)) -> Any:
    # §4.5 / §11 偏离 1：未知字段拒绝（422），不做静默忽略；
    # `code` 是 V1 禁止字段——收到即 422，不是「暂不支持」
    unknown = set(payload) - _ALLOWED_FIELDS
    if unknown:
        return JSONResponse(status_code=422, content={
            "error": {"code": "unknown_field",
                      "message": f"Unexpected fields: {sorted(unknown)}"},
        })

    example_id = payload.get("example_id")
    if not isinstance(example_id, str) or not example_id:
        return JSONResponse(status_code=400, content={
            "error": {"code": "invalid_body",
                      "message": "example_id (non-empty string) is required"},
        })

    mode = payload.get("mode")
    if mode is not None and mode not in ("trace", "vta"):
        return JSONResponse(status_code=400, content={
            "error": {"code": "bad_params",
                      "message": "mode must be 'trace' or 'vta'"},
        })
    if mode == "vta":
        # §4.5：请求体已预留，V1 返回 400
        return JSONResponse(status_code=400, content={
            "error": {"code": "unsupported_mode",
                      "message": "mode 'vta' is not supported in V1"},
        })

    # §5.7 并发护栏：非阻塞获取，失败即 429
    if not _trace_semaphore.acquire(blocking=False):
        return JSONResponse(status_code=429, content={
            "error": {"code": "trace_busy",
                      "message": "Another trace is already running"},
        })
    try:
        return run_trace(example_id)
    except UnknownExampleError:
        # §3.3 规则 1：清单是枚举键映射，绝不 `Path(...) / example_id` 拼接——
        # 路径穿透（"../../x"）查不到条目，天然落在 404
        return JSONResponse(status_code=404, content={
            "error": {"code": "unknown_example",
                      "message": f"Unknown example_id: {example_id}"},
        })
    finally:
        _trace_semaphore.release()


# --- 只读：示例清单与源码（ADR-025 §3.3）---
#
# 源码是随代码发布的静态资产，不随每次 run 回传（否则每帧都背着整份源码）。
# 前端单独取一次即可缓存；代码 pane 与 trace 事件按行号对齐。

@router.get("/examples")
def list_examples_endpoint() -> Any:
    """示例清单（不含源码）：供示例选择器与 template 路由使用。"""
    examples = [describe_example(ex.example_id) for ex in list_examples()]
    return {"examples": examples}


@router.get("/examples/{example_id}")
def get_example_endpoint(example_id: str) -> Any:
    """单个示例条目 + 源码。未知 example_id → 404（与 /run 同一套枚举键解析）。"""
    entry = describe_example(example_id)
    if entry is None:
        return JSONResponse(status_code=404, content={
            "error": {"code": "unknown_example",
                      "message": f"Unknown example_id: {example_id}"},
        })
    source = read_example_source(example_id)
    if source is None:
        # 清单有条目但文件缺失 = 应用资产损坏，属服务端故障
        return JSONResponse(status_code=500, content={
            "error": {"code": "source_unavailable",
                      "message": f"Source file missing for example_id: {example_id}"},
        })
    return {**entry, "source": source}
