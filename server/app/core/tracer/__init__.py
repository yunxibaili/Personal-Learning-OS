"""
Visual Engine V1 tracer 包（ADR-025 §3.2）
"""
from .snapshot import safe_snapshot
from .limits import (
    MAX_RUNTIME,
    MAX_TRACE_EVENTS,
    MAX_STDOUT_BYTES,
    MAX_STDERR_BYTES,
    MAX_RECURSION_DEPTH,
    MAX_CONCURRENT_TRACES,
)

__all__ = [
    "safe_snapshot",
    "MAX_RUNTIME",
    "MAX_TRACE_EVENTS",
    "MAX_STDOUT_BYTES",
    "MAX_STDERR_BYTES",
    "MAX_RECURSION_DEPTH",
    "MAX_CONCURRENT_TRACES",
]
