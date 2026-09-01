"""
Visual Engine V1 tracer runner（ADR-025 §3.2 / §5.2 / §5.5 / §5.6）

run_example() 在子进程中执行用户代码，返回 TraceRun。

- stdout / stderr 一律走 tempfile（ADR-025 §5.5，禁 PIPE：内存无界）
- 取值序列化集中在 core/tracer/snapshot.py（ADR-025 §5.6），子进程经
  PYTHONPATH 导入同一实现，禁止在模板里内联第二份序列化逻辑
- 每个 TraceEvent 携带「本步新增 stdout」（ADR-025 §4.2 冻结契约）
"""
import os
import sys
import json
import subprocess
import tempfile
from pathlib import Path
from typing import Any

from .limits import (
    MAX_RUNTIME,
    MAX_TRACE_EVENTS,
    MAX_STDERR_BYTES,
    MAX_STDOUT_BYTES,
)

# Import 白名单（ADR-025 §5.4）
ALLOWED_IMPORTS = {
    "math", "random", "datetime", "collections",
    "itertools", "functools", "string", "re",
    "json", "heapq", "bisect", "copy",
    "decimal", "fractions", "statistics",
    "typing", "dataclasses", "enum", "abc",
}

# server 根目录（app 包的父级）：子进程经 PYTHONPATH 导入 snapshot（ADR-025 §5.6）
_SERVER_ROOT = str(Path(__file__).resolve().parents[3])

# 子进程内联脚本模板。
# 序列化不在此内联——经 PYTHONPATH 导入 app.core.tracer.snapshot（ADR-025 §5.6）。
_CHILD_SCRIPT_TEMPLATE = r'''
import sys, json, builtins, importlib
from app.core.tracer.snapshot import safe_snapshot

MAX_TRACE_EVENTS = {max_trace_events}
MAX_RECURSION_DEPTH = {max_recursion_depth}
MAX_STDOUT_BYTES = {max_stdout_bytes}
REMOVED_BUILTINS = ("open", "exec", "eval", "compile", "input", "breakpoint")


def safe_import(name, *args, **kwargs):
    allowed = {allowed_json}
    top = name.split(".")[0]
    if top not in allowed:
        raise ImportError(f"Import '{{name}}' not allowed")
    return importlib.import_module(name, *args, **kwargs)


class OutputLimitExceeded(Exception):
    """stdout 超过 MAX_STDOUT_BYTES（ADR-025 §5.1 → status=output_limit）"""


class _StdoutCap:
    """用户 stdout 捕获器：累计写入，逐事件 drain 进 TraceEvent.stdout（§4.2）"""

    def __init__(self):
        self._chunks = []
        self.total = 0

    def write(self, s):
        self.total += len(s)
        self._chunks.append(s)
        if self.total > MAX_STDOUT_BYTES:
            raise OutputLimitExceeded()
        return len(s)

    def flush(self):
        pass

    def drain(self):
        out = "".join(self._chunks)
        self._chunks = []
        return out


class Tracer:
    def __init__(self, cap):
        self.events = []
        self.step = 0
        self._recursion_depth = 0
        self.cap = cap

    def trace_callback(self, frame, event, arg):
        if event == "call":
            self._recursion_depth += 1
            if self._recursion_depth > MAX_RECURSION_DEPTH:
                return None
        elif event == "return":
            self._recursion_depth -= 1
        if self.step >= MAX_TRACE_EVENTS:
            return None
        if event in ("call", "line", "return"):
            self.step += 1
            self._record_event(frame)
        return self.trace_callback

    def _record_event(self, frame):
        # 拿到 frame 立即快照，不跨事件持有引用（ADR-025 §5.6）
        frames = []
        current = frame
        while current:
            try:
                loc = safe_snapshot(dict(current.f_locals))
            except Exception:
                loc = {{}}
            frames.append({{"func": current.f_code.co_name, "line": current.f_lineno, "locals": loc}})
            current = current.f_back
        self.events.append({{
            "step": self.step,
            "line": frame.f_lineno,
            "frames": frames,
            "stdout": self.cap.drain(),
            "metadata": {{}},
        }})


code = sys.stdin.read()
cap = _StdoutCap()
tracer = Tracer(cap)

# Step 1: compile BEFORE lockdown（compile 本身也是待移除的 builtin）
try:
    compiled = compile(code, "<sandbox>", "exec")
except SyntaxError as e:
    print(json.dumps({{"version": "1", "language": "python", "events": [], "status": "error", "error": {{"type": "SYNTAX", "message": str(e)}}, "metadata": {{}}}}, ensure_ascii=False))
    sys.exit(0)

# Step 2: lockdown builtins（§5.4 六项全移除；exec 引用先存后删）
_exec = exec
original_import = builtins.__import__
originals = {{}}
builtins.__import__ = safe_import
for name in REMOVED_BUILTINS:
    originals[name] = getattr(builtins, name, None)
    try:
        delattr(builtins, name)
    except Exception:
        pass

# Step 3: 用户 stdout 进捕获器，最终 JSON 走真实 stdout
original_stdout = sys.stdout
sys.stdout = cap

result = None
try:
    sys.settrace(tracer.trace_callback)
    try:
        _exec(compiled, {{"__builtins__": builtins, "__name__": "__main__"}})
    finally:
        sys.settrace(None)
    result = {{"version": "1", "language": "python", "events": tracer.events, "status": "completed", "metadata": {{}}}}
except RecursionError:
    result = {{"version": "1", "language": "python", "events": tracer.events, "status": "trace_limit", "error": {{"type": "RECURSION_LIMIT", "message": "Max recursion exceeded"}}, "metadata": {{}}}}
except OutputLimitExceeded:
    result = {{"version": "1", "language": "python", "events": tracer.events, "status": "output_limit", "error": {{"type": "OUTPUT_LIMIT", "message": f"stdout exceeded {{MAX_STDOUT_BYTES}} bytes"}}, "metadata": {{}}}}
except ImportError as e:
    result = {{"version": "1", "language": "python", "events": [], "status": "error", "error": {{"type": "IMPORT_DENIED", "message": str(e)}}, "metadata": {{}}}}
except Exception as e:
    result = {{"version": "1", "language": "python", "events": tracer.events, "status": "error", "error": {{"type": "RUNTIME", "message": str(e)}}, "metadata": {{}}}}
finally:
    sys.settrace(None)
    sys.stdout = original_stdout
    builtins.__import__ = original_import
    for n, v in originals.items():
        if v is not None:
            setattr(builtins, n, v)

print(json.dumps(result, ensure_ascii=False))
'''


def run_example(example_path: str) -> dict[str, Any]:
    """
    执行示例并返回 TraceRun（ADR-025 §4）
    子进程隔离 + 超时限制（ADR-025 §3.2 / §5.1），
    stdout/stderr 走 tempfile（ADR-025 §5.5）。
    """
    try:
        with open(example_path, "r", encoding="utf-8") as f:
            code = f.read()
    except FileNotFoundError:
        return {
            "version": "1",
            "language": "python",
            "events": [],
            "status": "error",
            "error": {"type": "FILE_NOT_FOUND", "message": f"Example not found: {example_path}"},
            "metadata": {},
        }
    except Exception as e:
        return {
            "version": "1",
            "language": "python",
            "events": [],
            "status": "error",
            "error": {"type": "FILE_ERROR", "message": str(e)},
            "metadata": {},
        }

    script = _CHILD_SCRIPT_TEMPLATE.format(
        allowed_json=json.dumps(sorted(ALLOWED_IMPORTS)),
        max_trace_events=MAX_TRACE_EVENTS,
        max_recursion_depth=100,
        max_stdout_bytes=MAX_STDOUT_BYTES,
    )

    # stdout/stderr 一律 tempfile（ADR-025 §5.5，禁 PIPE）
    try:
        with tempfile.TemporaryFile(mode="w+", encoding="utf-8", errors="replace") as out_f, \
             tempfile.TemporaryFile(mode="w+", encoding="utf-8", errors="replace") as err_f:
            proc = subprocess.run(
                [sys.executable, "-c", script],
                input=code,
                stdout=out_f,
                stderr=err_f,
                text=True,
                encoding="utf-8",
                timeout=MAX_RUNTIME,
                env={**os.environ, "PYTHONIOENCODING": "utf-8", "PYTHONPATH": _SERVER_ROOT},
            )
            out_f.seek(0)
            err_f.seek(0)
            stdout = out_f.read().strip()
            stderr_text = err_f.read()
    except subprocess.TimeoutExpired:
        return {
            "version": "1",
            "language": "python",
            "events": [],
            "status": "timeout",
            "error": {"type": "TIMEOUT", "message": f"Execution exceeded {MAX_RUNTIME}s limit"},
            "metadata": {},
        }
    except Exception as e:
        return {
            "version": "1",
            "language": "python",
            "events": [],
            "status": "error",
            "error": {"type": "RUNTIME", "message": str(e)},
            "metadata": {},
        }

    if stdout:
        result: dict[str, Any] | None = None
        try:
            result = json.loads(stdout)
        except json.JSONDecodeError:
            pass
        if result is not None:
            result["metadata"] = {}
            stderr_over = len(stderr_text.encode("utf-8", errors="replace")) > MAX_STDERR_BYTES
            if result.get("status") == "completed" and len(result.get("events", [])) > MAX_TRACE_EVENTS:
                result["status"] = "trace_limit"
                result["error"] = {"type": "TRACE_LIMIT", "message": f"Exceeded {MAX_TRACE_EVENTS} events"}
            elif stderr_over:
                # §5.1：stderr 超限即置 output_limit，任何 status 下生效
                result["status"] = "output_limit"
                result["error"] = {"type": "OUTPUT_LIMIT", "message": f"stderr exceeded {MAX_STDERR_BYTES} bytes"}
            return result

    # 子进程崩溃 / 无 JSON 输出
    tail = stderr_text[-500:] if stderr_text else ""
    if proc.returncode != 0:
        is_timeout = "timed out" in tail.lower() or proc.returncode == -9
        return {
            "version": "1",
            "language": "python",
            "events": [],
            "status": "timeout" if is_timeout else "error",
            "error": {"type": "TIMEOUT" if is_timeout else "RUNTIME", "message": tail or "Subprocess failed"},
            "metadata": {},
        }

    return {
        "version": "1",
        "language": "python",
        "events": [],
        "status": "error",
        "error": {"type": "RUNTIME", "message": "No output from subprocess"},
        "metadata": {},
    }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python -m app.core.tracer.runner <example_path>", file=sys.stderr)
        sys.exit(1)

    result = run_example(sys.argv[1])
    print(json.dumps(result, ensure_ascii=False))
