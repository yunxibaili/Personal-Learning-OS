"""
Visual Engine V1 tracer 包（ADR-025 §3.2）

编排入口 run_trace()：manifest 解析 → 子进程执行 → metadata 回填。
"""
from typing import Any

from .snapshot import safe_snapshot
from .limits import (
    MAX_RUNTIME,
    MAX_TRACE_EVENTS,
    MAX_STDOUT_BYTES,
    MAX_STDERR_BYTES,
    MAX_RECURSION_DEPTH,
    MAX_CONCURRENT_TRACES,
)
from .examples.manifest import get_example, list_examples


class UnknownExampleError(LookupError):
    """example_id 不在示例清单内（ADR-025 §3.3）。路由层映射 HTTP 404。"""


def describe_example(example_id: str) -> dict[str, Any] | None:
    """清单条目摘要（不含源码）——供 `GET /trace/examples` 列表用。"""
    example = get_example(example_id)
    if example is None:
        return None
    return {
        "example_id": example.example_id,
        "title": example.title,
        "concept_title": example.concept_title,
        "template": example.template,
    }


def read_example_source(example_id: str) -> str | None:
    """读取示例源码（ADR-025 §3.3：示例是随代码发布的应用资产，只读）。

    与 run_trace 同源的枚举键解析——未知 example_id 返回 None，绝不路径拼接。
    源码是静态资产，不随每次 run 回传，由前端单独获取后可缓存。
    """
    example = get_example(example_id)
    if example is None:
        return None
    return example.path.read_text(encoding="utf-8")


def run_trace(example_id: str) -> dict[str, Any]:
    """编排入口（ADR-025 §3.2）：唯一可执行来源是示例清单。

    清单是枚举键映射而非路径拼接——`"../../x"` 之类输入查不到条目，
    抛 UnknownExampleError，绝不触达文件系统。
    """
    example = get_example(example_id)
    if example is None:
        raise UnknownExampleError(example_id)

    from .runner import run_example  # 延迟导入：避免包初始化即拉起 subprocess 依赖

    result = run_example(str(example.path))
    # §4.1：metadata 必含 example_id + template（runner 置空，编排层回填）
    result["metadata"] = {
        "example_id": example.example_id,
        "template": example.template,
    }
    return result


__all__ = [
    "safe_snapshot",
    "MAX_RUNTIME",
    "MAX_TRACE_EVENTS",
    "MAX_STDOUT_BYTES",
    "MAX_STDERR_BYTES",
    "MAX_RECURSION_DEPTH",
    "MAX_CONCURRENT_TRACES",
    "UnknownExampleError",
    "run_trace",
    "get_example",
    "list_examples",
    "describe_example",
    "read_example_source",
]
