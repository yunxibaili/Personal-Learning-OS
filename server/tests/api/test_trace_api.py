"""Trace API 测试（ADR-025 §4.4 / §4.5 / §5.3 / §5.7 + §8 守护测试 11/12/13/16/17）

API 只接受清单内的 example_id，因此「while True → timeout」「1MB print →
output_limit」等 worker 行为由 core 层测试覆盖（test_tracer_poc.py）；
这里锁定 HTTP 映射、字段校验与并发护栏。
非 completed 状态的 HTTP 200 语义用 monkeypatch 桩锁定（真实触发需 10s+）。
"""
from __future__ import annotations

import inspect

from app.main import create_app


def _post(client, **body):
    return client.post("/api/v1/trace/run", json=body)


# --- 正向：completed + 契约 metadata ---

def test_completed_200_with_contract_metadata(client):
    r = _post(client, example_id="factorial")
    assert r.status_code == 200
    body = r.json()
    assert body["version"] == "1"
    assert body["language"] == "python"
    assert body["status"] == "completed"
    # §4.1：metadata 必含 example_id + template
    assert body["metadata"]["example_id"] == "factorial"
    assert body["metadata"]["template"] == "FrameStackView"
    assert len(body["events"]) > 0
    assert any("factorial(5) = 120" in e["stdout"] for e in body["events"])


def test_all_manifest_examples_run_200(client):
    from app.core.tracer.examples.manifest import list_examples

    for ex in list_examples():
        r = _post(client, example_id=ex.example_id)
        assert r.status_code == 200, ex.example_id
        body = r.json()
        assert body["status"] == "completed", ex.example_id
        assert body["metadata"]["example_id"] == ex.example_id
        assert body["metadata"]["template"] == ex.template


# --- 调用方错误映射 ---

def test_unknown_example_404(client):
    """守护测试 13：未知 example_id → 404"""
    r = _post(client, example_id="no-such-example")
    assert r.status_code == 404


def test_path_traversal_is_404(client):
    """守护测试 17：路径穿透 → 404，绝不触达路径拼接"""
    for evil in ("../../secrets", "../runner", "factorial/../../../x", ".\\factorial"):
        r = _post(client, example_id=evil)
        assert r.status_code == 404, evil


def test_mode_vta_400_unsupported_mode(client):
    """守护测试 11：mode:"vta" → 400 unsupported_mode"""
    r = _post(client, example_id="factorial", mode="vta")
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "unsupported_mode"


def test_mode_unknown_value_400(client):
    r = _post(client, example_id="factorial", mode="bogus")
    assert r.status_code == 400


def test_code_field_422(client):
    """§11 偏离 1：code 是禁止字段——收到即 422，不静默忽略"""
    r = _post(client, example_id="factorial", code="1 + 1")
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "unknown_field"


def test_unknown_field_422(client):
    r = _post(client, example_id="factorial", whatever=1)
    assert r.status_code == 422


def test_missing_example_id_400(client):
    r = _post(client)
    assert r.status_code == 400


def test_empty_example_id_400(client):
    r = _post(client, example_id="")
    assert r.status_code == 400


# --- §5.3 红线：handler 必须同步 def（守护测试 12）---

def test_handler_is_sync_def():
    from app.routers.trace import run_trace_endpoint

    assert not inspect.iscoroutinefunction(run_trace_endpoint)
    assert not inspect.isasyncgenfunction(run_trace_endpoint)


def test_route_mounted_at_expected_path():
    """FastAPI 0.141：include_router 不展开子路由，挂在 _IncludedRouter 壳内
    （见 test_router_registration.py 模块注释）。展开壳后断言。"""
    app = create_app()
    paths: set[str] = set()
    for r in app.routes:
        inner = getattr(r, "original_router", None)
        for sub in (inner.routes if inner is not None else [r]):
            if hasattr(sub, "path"):
                paths.add(sub.path)
    assert "/api/v1/trace/run" in paths


# --- §5.7 并发护栏（守护测试 16）---

def test_concurrent_limit_429_trace_busy(client):
    """已有 1 个 trace 在跑时再发请求 → 429 trace_busy，不排队"""
    from app.routers.trace import _trace_semaphore

    assert _trace_semaphore.acquire(blocking=False)
    try:
        r = _post(client, example_id="factorial")
        assert r.status_code == 429
        assert r.json()["error"]["code"] == "trace_busy"
    finally:
        _trace_semaphore.release()


def test_semaphore_released_after_run(client):
    """成功执行后信号量必须归还（泄漏 → 后续请求全部 429）"""
    assert _post(client, example_id="factorial").status_code == 200

    from app.routers.trace import _trace_semaphore

    assert _trace_semaphore.acquire(blocking=False)
    _trace_semaphore.release()


# --- §4.4：非 completed 状态一律 HTTP 200 ---

def test_non_completed_status_is_http_200(client, monkeypatch):
    from app.routers import trace as trace_router

    fake = {
        "version": "1", "language": "python", "events": [],
        "status": "timeout",
        "error": {"type": "TIMEOUT", "message": "Execution timed out"},
        "metadata": {},
    }
    monkeypatch.setattr(trace_router, "run_trace", lambda example_id: fake)
    r = _post(client, example_id="factorial")
    assert r.status_code == 200
    assert r.json()["status"] == "timeout"


# --- 只读端点：示例清单与源码（ADR-025 §3.3）---

def test_list_examples_returns_manifest_without_source(client):
    """清单不含源码：源码是静态资产，由单条端点单独取、前端可缓存"""
    r = client.get("/api/v1/trace/examples")
    assert r.status_code == 200
    body = r.json()
    examples = body["examples"]
    assert len(examples) == 6
    ids = {e["example_id"] for e in examples}
    assert ids == {
        "quicksort-basic", "binary-search", "bubble-sort",
        "factorial", "fibonacci", "linear-search",
    }
    for e in examples:
        assert set(e) == {"example_id", "title", "concept_title", "template", "file"}
        assert e["template"] in ("FrameStackView", "ArrayView", "GeneralView")
        assert e["file"].endswith(".py"), "file 仅供 UI 显示，来自清单 filename"
        assert "source" not in e
        # path 属服务端内部结构，不得外泄
        assert "path" not in e


def test_get_example_detail_returns_source(client):
    r = client.get("/api/v1/trace/examples/factorial")
    assert r.status_code == 200
    body = r.json()
    assert body["example_id"] == "factorial"
    assert body["template"] == "FrameStackView"
    assert "def factorial" in body["source"]
    assert body["source"].splitlines(), "source must be non-empty"


def test_example_source_lines_cover_all_trace_lines(client):
    """源码行数必须覆盖轨迹里出现的每个行号——代码 pane 才能对齐高亮"""
    detail = client.get("/api/v1/trace/examples/factorial").json()
    n_lines = len(detail["source"].splitlines())
    run = _post(client, example_id="factorial").json()
    assert run["status"] == "completed"
    lines = {e["line"] for e in run["events"]}
    lines |= {f["line"] for e in run["events"] for f in e["frames"]}
    assert lines, "expected at least one traced line"
    assert max(lines) <= n_lines, f"trace line {max(lines)} exceeds {n_lines} source lines"
    assert min(lines) >= 1


def test_unknown_example_detail_404(client):
    assert client.get("/api/v1/trace/examples/nope").status_code == 404
    body = client.get("/api/v1/trace/examples/nope").json()
    assert body["error"]["code"] == "unknown_example"


def test_path_traversal_on_detail_404(client):
    """清单是枚举键映射，路径穿透查不到条目 → 404，绝不触达文件系统"""
    for probe in ("../../etc/passwd", "..%2F..%2Fetc%2Fpasswd", "manifest", "runner"):
        r = client.get(f"/api/v1/trace/examples/{probe}")
        assert r.status_code == 404, f"{probe} should be 404, got {r.status_code}"


def test_detail_source_missing_is_500(client, monkeypatch):
    """清单有条目但示例文件缺失 = 应用资产损坏，属服务端故障"""
    from app.routers import trace as trace_router

    monkeypatch.setattr(trace_router, "read_example_source", lambda example_id: None)
    r = client.get("/api/v1/trace/examples/factorial")
    assert r.status_code == 500
    assert r.json()["error"]["code"] == "source_unavailable"


# --- M9-007：visualize 事件进入 Learning Memory（ADR-025 §6.3 / §8 守护 15）---

def test_visualize_event_increments_practice(client):
    """守护 15：TraceRun 成功后前端 POST /events event_type=visualize，
    practice 增量 = 0.05 × weight（mastery 侧映射在 core/mastery.py 事件表）。"""
    import pytest

    r = client.post("/api/v1/concepts", json={
        "title": "TraceVizConcept", "origin": "manual"})
    assert r.status_code == 201, r.text
    cid = r.json()["id"]

    # 首次事件：mastery 由 ensure_concept_learning_state 创建，全维 0 起
    r = client.post("/api/v1/events", json={
        "concept_id": cid, "event_type": "visualize", "source": "visual_engine"})
    assert r.status_code == 201, r.text
    m = r.json()["mastery"]
    assert m["dimensions"]["practice"] == pytest.approx(0.05)
    assert m["dimensions"]["knowledge"] == 0.0

    # weight 显式传入：0.05 × weight
    r = client.post("/api/v1/events", json={
        "concept_id": cid, "event_type": "visualize",
        "weight": 2.0, "source": "visual_engine"})
    assert r.status_code == 201
    m2 = r.json()["mastery"]
    assert m2["dimensions"]["practice"] == pytest.approx(0.05 + 0.05 * 2.0)


def test_visualize_event_unknown_concept_404(client):
    """事件的概念存在性校验不变（M9-007 不放宽）"""
    r = client.post("/api/v1/events", json={
        "concept_id": 999999, "event_type": "visualize", "source": "visual_engine"})
    assert r.status_code == 404
