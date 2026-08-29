"""时间工具（B21）：消除 _now_iso 跨模块重复实现。

现值只应由一处定义；各模块统一从此导入。
"""
from __future__ import annotations

from datetime import datetime, timezone

UTC_ISO_FORMAT = "%Y-%m-%d %H:%M:%S"


def now_iso() -> str:
    """当前 UTC 时间字符串（秒级，UTC-aware）。"""
    return datetime.now(timezone.utc).strftime(UTC_ISO_FORMAT)


__all__ = ["now_iso", "UTC_ISO_FORMAT"]
