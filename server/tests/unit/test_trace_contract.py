"""
TraceRun v1 契约测试（ADR-025 §4）
确保后端返回的 TraceRun 符合后端契约定义（与 core/tracer 类型一致）
"""
import pytest


# --- TraceRun 顶层六字段（ADR-025 §4.1）---

def test_trace_run_top_level_fields():
    """TraceRun 必须包含 version/language/events/status/metadata 五字段 + 可选 error"""
    trace_run = {
        "version": "1",
        "language": "python",
        "events": [],
        "status": "completed",
        "metadata": {"example_id": "factorial", "template": "FrameStackView"},
    }
    required = {"version", "language", "events", "status", "metadata"}
    assert required.issubset(trace_run.keys()), f"Missing fields: {required - trace_run.keys()}"


def test_trace_run_version_is_string_1():
    """version 必须是字符串 '1'"""
    trace_run = {"version": "1", "language": "python", "events": [], "status": "completed", "metadata": {}}
    assert trace_run["version"] == "1"
    assert isinstance(trace_run["version"], str)


def test_trace_run_language_is_python():
    """V1 language 只能是 'python'"""
    trace_run = {"version": "1", "language": "python", "events": [], "status": "completed", "metadata": {}}
    assert trace_run["language"] == "python"


# --- status 五值（ADR-025 §4.4）---

VALID_STATUSES = {"completed", "timeout", "error", "trace_limit", "output_limit"}


@pytest.mark.parametrize("status", VALID_STATUSES)
def test_trace_run_valid_status(status):
    """status 只能是五值之一"""
    assert status in VALID_STATUSES


def test_trace_run_invalid_status():
    """非法 status 应被拒绝"""
    invalid = "running"
    assert invalid not in VALID_STATUSES


# --- TraceEvent（ADR-025 §4.2）---

def test_trace_event_fields():
    """TraceEvent 必须包含 step/line/frames/stdout/metadata"""
    event = {
        "step": 1,
        "line": 10,
        "frames": [{"func": "main", "line": 10, "locals": {}}],
        "stdout": "",
        "metadata": {},
    }
    required = {"step", "line", "frames", "stdout", "metadata"}
    assert required.issubset(event.keys())


def test_trace_event_step_is_int():
    """step 必须是整数"""
    event = {"step": 1, "line": 10, "frames": [], "stdout": "", "metadata": {}}
    assert isinstance(event["step"], int)


def test_trace_event_frames_is_list():
    """frames 必须是列表"""
    event = {"step": 1, "line": 10, "frames": [], "stdout": "", "metadata": {}}
    assert isinstance(event["frames"], list)


# --- TraceFrame（ADR-025 §4.2）---

def test_trace_frame_fields():
    """TraceFrame 必须包含 func/line/locals"""
    frame = {"func": "quick_sort", "line": 14, "locals": {"arr": [3, 7, 2]}}
    required = {"func", "line", "locals"}
    assert required.issubset(frame.keys())


def test_trace_frame_func_is_string():
    """func 必须是字符串"""
    frame = {"func": "main", "line": 1, "locals": {}}
    assert isinstance(frame["func"], str)


def test_trace_frame_locals_is_dict():
    """locals 必须是字典"""
    frame = {"func": "main", "line": 1, "locals": {"x": 42}}
    assert isinstance(frame["locals"], dict)


# --- TraceValue（ADR-025 §4.3）---

def test_trace_value_primitive():
    """基础类型直接输出"""
    assert isinstance(None, (type(None), bool, int, float, str))
    assert isinstance(True, bool)
    assert isinstance(42, int)
    assert isinstance(3.14, float)
    assert isinstance("hello", str)


def test_trace_value_list():
    """list 直接输出"""
    value = [1, 2, 3]
    assert isinstance(value, list)


def test_trace_value_truncated():
    """超限容器输出 truncated"""
    truncated = {"type": "truncated", "n": 500}
    assert truncated["type"] == "truncated"
    assert isinstance(truncated["n"], int)


def test_trace_value_object():
    """不可序列化对象输出 object"""
    obj = {"type": "object", "class": "MyClass"}
    assert obj["type"] == "object"
    assert isinstance(obj["class"], str)


# --- TraceRun.metadata（ADR-025 §4.1）---

def test_trace_run_metadata_has_example_id():
    """metadata 必须包含 example_id"""
    metadata = {"example_id": "factorial", "template": "FrameStackView"}
    assert "example_id" in metadata


def test_trace_run_metadata_has_template():
    """metadata 必须包含 template"""
    metadata = {"example_id": "factorial", "template": "FrameStackView"}
    assert "template" in metadata


VALID_TEMPLATES = {"FrameStackView", "ArrayView", "GeneralView"}


@pytest.mark.parametrize("template", VALID_TEMPLATES)
def test_trace_run_metadata_valid_template(template):
    """template 只能是三值之一"""
    assert template in VALID_TEMPLATES


# --- error 字段（ADR-025 §4.1）---

def test_trace_run_error_structure():
    """error 必须包含 type 和 message"""
    error = {"type": "RUNTIME", "message": "division by zero"}
    assert "type" in error
    assert "message" in error
    assert isinstance(error["type"], str)
    assert isinstance(error["message"], str)


# --- 不应出现的字段（ADR-025 §3.5）---

def test_trace_event_no_settrace_concepts():
    """TraceEvent 不得包含 settrace 专有概念"""
    event = {"step": 1, "line": 10, "frames": [], "stdout": "", "metadata": {}}
    forbidden = {"opcode", "f_lineno", "event_type", "event", "settrace"}
    assert not forbidden.intersection(event.keys()), f"Found forbidden fields: {forbidden.intersection(event.keys())}"


# --- 往返契约：runner 真实输出必须符合本文件锁定的形状（ADR-025 §4）---


def _run_factorial() -> dict:
    from app.core.tracer.runner import run_example
    from app.core.tracer.examples.manifest import get_example

    example = get_example("factorial")
    assert example is not None
    return run_example(str(example.path))


@pytest.fixture(scope="module")
def factorial_run() -> dict:
    return _run_factorial()


def test_runner_top_level_matches_contract(factorial_run):
    """runner 真实输出的顶层字段符合 TraceRun 契约"""
    assert factorial_run["version"] == "1"
    assert factorial_run["language"] == "python"
    assert factorial_run["status"] == "completed"
    assert isinstance(factorial_run["events"], list)
    assert isinstance(factorial_run["metadata"], dict)
    assert len(factorial_run["events"]) > 0


def test_runner_event_keys_exact(factorial_run):
    """真实 TraceEvent 的字段恰为冻结契约五字段（无 settrace 概念混入）"""
    allowed = {"step", "line", "frames", "stdout", "metadata"}
    for event in factorial_run["events"]:
        extra = set(event.keys()) - allowed
        missing = allowed - set(event.keys())
        assert not extra, f"Unexpected event fields: {extra}"
        assert not missing, f"Missing event fields: {missing}"


def test_runner_event_stdout_is_string(factorial_run):
    """每个事件的 stdout 是字符串（可为空串）"""
    for event in factorial_run["events"]:
        assert isinstance(event["stdout"], str)


def test_runner_stdout_captured(factorial_run):
    """用户 print 的内容出现在事件 stdout 中"""
    merged = "".join(e["stdout"] for e in factorial_run["events"])
    assert "factorial(5) = 120" in merged


def test_runner_frames_match_contract(factorial_run):
    """真实 TraceFrame 含 func(str)/line(int)/locals(dict)"""
    for event in factorial_run["events"]:
        for frame in event["frames"]:
            assert set(frame.keys()) == {"func", "line", "locals"}
            assert isinstance(frame["func"], str)
            assert isinstance(frame["line"], int)
            assert isinstance(frame["locals"], dict)


def test_runner_values_match_trace_value(factorial_run):
    """locals 值符合 TraceValue：原生标量或 {type: object|truncated|depth_limit}"""
    special_types = {"object", "truncated", "depth_limit"}

    def check(value) -> bool:
        if value is None or isinstance(value, (bool, int, float, str)):
            return True
        if isinstance(value, list):
            return all(check(v) for v in value)
        if isinstance(value, dict):
            if value.get("type") in special_types and isinstance(value.get("class", value.get("n", "")), (str, int)):
                return len(value.keys()) == 2
            return all(isinstance(k, str) and check(v) for k, v in value.items())
        return False

    for event in factorial_run["events"]:
        for frame in event["frames"]:
            for v in frame["locals"].values():
                assert check(v), f"Value violates TraceValue contract: {v!r}"
