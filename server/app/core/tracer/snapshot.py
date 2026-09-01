"""
快照序列化（ADR-025 §5.6）
所有取值集中在此，Python 版本升级时不污染 tracer 主逻辑
"""
from typing import Any


def safe_snapshot(obj: Any, depth: int = 0, max_depth: int = 3, max_elements: int = 200) -> Any:
    """
    安全序列化变量值（ADR-025 §4.3）
    - 绝不调用 repr() / str()
    - 深度上限 3
    - 容器元素上限 200
    """
    if obj is None or isinstance(obj, (bool, int, float)):
        return obj
    if isinstance(obj, str):
        return obj[:197] + "..." if len(obj) > 200 else obj
    if depth >= max_depth:
        return {"type": "depth_limit", "class": type(obj).__name__}
    if isinstance(obj, (list, tuple)):
        if len(obj) > max_elements:
            return {"type": "truncated", "n": len(obj)}
        return [safe_snapshot(item, depth + 1, max_depth, max_elements) for item in obj]
    if isinstance(obj, dict):
        if len(obj) > max_elements:
            return {"type": "truncated", "n": len(obj)}
        result = {}
        for i, (k, v) in enumerate(obj.items()):
            if i >= max_elements:
                break
            result[str(k)] = safe_snapshot(v, depth + 1, max_depth, max_elements)
        return result
    return {"type": "object", "class": type(obj).__name__}
