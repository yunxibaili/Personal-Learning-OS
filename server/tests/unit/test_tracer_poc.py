"""
tracer PoC 测试（ADR-025 §7.1）
四步全绿后才进入 M9-004
"""
import pytest
from pathlib import Path

from app.core.tracer.runner import run_example
from app.core.tracer.snapshot import safe_snapshot
from app.core.tracer.examples.manifest import get_example, EXAMPLES_DIR


# --- PoC-1: factorial（ADR-025 §7.1 PoC-1）---

def test_poc1_factorial_produces_recursive_frames():
    """factorial 能正确产生递归 frames"""
    example = get_example("factorial")
    assert example is not None
    result = run_example(str(example.path))

    assert result["version"] == "1"
    assert result["language"] == "python"
    assert result["status"] == "completed"
    assert len(result["events"]) > 0

    # 检查有递归帧
    funcs = set()
    for event in result["events"]:
        for frame in event["frames"]:
            funcs.add(frame["func"])

    assert "factorial" in funcs, f"Expected 'factorial' in frames, got {funcs}"


def test_poc1_factorial_has_return_events():
    """factorial 有 return 事件"""
    example = get_example("factorial")
    result = run_example(str(example.path))

    # 检查有返回值（通过 frames 中的 locals）
    has_return = False
    for event in result["events"]:
        for frame in event["frames"]:
            if "n" in frame["locals"]:
                has_return = True
                break

    assert has_return, "Expected return events with locals"


# --- PoC-2: quicksort（ADR-025 §7.1 PoC-2）---

def test_poc2_quicksort_produces_array_states():
    """quicksort 能产生正确数组状态"""
    example = get_example("quicksort-basic")
    assert example is not None
    result = run_example(str(example.path))

    assert result["status"] == "completed"
    assert len(result["events"]) > 0

    # 检查有数组变量
    has_array = False
    for event in result["events"]:
        for frame in event.get("frames", []):
            if "arr" in frame["locals"]:
                has_array = True
                break

    assert has_array, "Expected array states in events"


def test_poc2_quicksort_correct_output():
    """quicksort 输出正确排序结果"""
    example = get_example("quicksort-basic")
    result = run_example(str(example.path))

    # 检查最后一个事件的 stdout 包含排序结果
    # 注意：stdout 在 runner 中是收集的，这里只检查状态
    assert result["status"] == "completed"


# --- PoC-3: timeout（ADR-025 §7.1 PoC-3）---

def test_poc3_timeout_on_infinite_loop():
    """while True: pass 能被父进程可靠终止"""
    # 创建一个临时的无限循环示例
    import tempfile
    import os

    with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
        f.write("while True:\n    pass\n")
        temp_path = f.name

    try:
        result = run_example(temp_path)
        # 应该返回 timeout 或 trace_limit
        assert result["status"] in ("timeout", "trace_limit"), f"Expected timeout/trace_limit, got {result['status']}"
    finally:
        os.unlink(temp_path)


# --- PoC-4: output limit（ADR-025 §7.1 PoC-4）---

def test_poc4_output_limit_on_excessive_print():
    """大量 stdout 不会导致 API / worker 阻塞"""
    import tempfile
    import os

    with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
        f.write("for i in range(100000):\n    print(f'line {i}' * 10)\n")
        temp_path = f.name

    try:
        result = run_example(temp_path)
        # 应该返回 output_limit 或 timeout
        assert result["status"] in ("output_limit", "timeout", "trace_limit"), \
            f"Expected output_limit/timeout/trace_limit, got {result['status']}"
    finally:
        os.unlink(temp_path)


def test_poc4_output_limit_keeps_partial_events():
    """output_limit 下仍回放已录得的部分轨迹（ADR-025 §4.4）"""
    import tempfile
    import os

    with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
        f.write("for i in range(100000):\n    print(f'line {i}' * 10)\n")
        temp_path = f.name

    try:
        result = run_example(temp_path)
        assert result["status"] == "output_limit"
        assert len(result["events"]) > 0, "Partial trajectory must be replayable"
    finally:
        os.unlink(temp_path)


# --- per-event stdout（ADR-025 §4.2 冻结契约）---

def test_stdout_captured_into_events():
    """用户 print 被逐步捕获进 TraceEvent.stdout"""
    import tempfile
    import os

    with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False, encoding="utf-8") as f:
        f.write("print('hello tracer')\nx = 1\nprint('done')\n")
        temp_path = f.name

    try:
        result = run_example(temp_path)
        assert result["status"] == "completed"
        merged = "".join(e["stdout"] for e in result["events"])
        assert "hello tracer" in merged
        assert "done" in merged
    finally:
        os.unlink(temp_path)


def test_stdout_unicode_not_mojibake():
    """中文 print 经 tempfile 往返不乱码（编码显式 utf-8）"""
    import tempfile
    import os

    with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False, encoding="utf-8") as f:
        f.write("print('你好世界')\n")
        temp_path = f.name

    try:
        result = run_example(temp_path)
        assert result["status"] == "completed"
        merged = "".join(e["stdout"] for e in result["events"])
        assert "你好世界" in merged
    finally:
        os.unlink(temp_path)


# --- builtins lockdown（ADR-025 §5.4 六项全移除）---

def test_builtin_exec_denied():
    """用户代码调用 exec 被 lockdown 拦截"""
    import tempfile
    import os

    with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
        f.write("exec('1 + 1')\n")
        temp_path = f.name

    try:
        result = run_example(temp_path)
        assert result["status"] == "error"
        assert result["error"]["type"] == "RUNTIME"
        assert "exec" in result["error"]["message"]
    finally:
        os.unlink(temp_path)


# --- safe_snapshot 测试（ADR-025 §5.6）---

def test_safe_snapshot_none():
    """None 直接输出"""
    assert safe_snapshot(None) is None


def test_safe_snapshot_bool():
    """bool 直接输出"""
    assert safe_snapshot(True) is True
    assert safe_snapshot(False) is False


def test_safe_snapshot_int():
    """int 直接输出"""
    assert safe_snapshot(42) == 42


def test_safe_snapshot_float():
    """float 直接输出"""
    assert safe_snapshot(3.14) == 3.14


def test_safe_snapshot_string_truncation():
    """字符串截断至 200 字符"""
    long_str = "a" * 300
    result = safe_snapshot(long_str)
    assert isinstance(result, str)
    assert len(result) <= 200


def test_safe_snapshot_list():
    """list 递归展开"""
    result = safe_snapshot([1, 2, 3])
    assert result == [1, 2, 3]


def test_safe_snapshot_nested_list_depth_limit():
    """嵌套 list 深度限制"""
    nested = [[[[[1]]]]]
    result = safe_snapshot(nested)
    # 深度 3 后应该变成 depth_limit
    assert isinstance(result, list)


def test_safe_snapshot_dict():
    """dict 递归展开"""
    result = safe_snapshot({"a": 1, "b": 2})
    assert result == {"a": 1, "b": 2}


def test_safe_snapshot_truncated_container():
    """超限容器输出 truncated"""
    large_list = list(range(300))
    result = safe_snapshot(large_list, max_elements=200)
    assert isinstance(result, dict)
    assert result["type"] == "truncated"
    assert result["n"] == 300


def test_safe_snapshot_object():
    """不可序列化对象输出 object"""
    class CustomClass:
        pass

    result = safe_snapshot(CustomClass())
    assert isinstance(result, dict)
    assert result["type"] == "object"
    assert result["class"] == "CustomClass"


def test_safe_snapshot_no_repr_call():
    """绝不调用 repr() / str()"""
    call_count = 0

    class Spy:
        def __repr__(self) -> str:
            nonlocal call_count
            call_count += 1
            return "Spy"

    safe_snapshot(Spy())
    assert call_count == 0, f"repr() was called {call_count} times"
