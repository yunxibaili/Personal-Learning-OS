"""Memories API (B28) - /api/v1/memories 端点。

管理面：AI 自动写入的用户记忆必须可见 / 可改 / 可删，否则「用户数据永不锁死」
在记忆这块就是空的。

- GET /memories - 列表（kind 过滤 + 分页，全量可见）
- GET /memories/{id} - 详情
- PATCH /memories/{id} - 部分改写
- DELETE /memories/{id} - 删除（硬删）

边界：
- Router 只调 core，不直写 SQL（tests/api/test_memories_api.py 静态守护）
- **不做敏感前缀过滤**——与消费面 get_memories 相反，且是故意的。
  过滤是「不进 prompt」的保护；管理面若同样过滤，`sk-` 记忆会变成
  用户看不见、删不掉的暗账。理由见 core/memories.py 模块 docstring。
- 不提供 POST（创建）：memories 的唯一生产者是 B3 Extractor 的 upsert_memory，
  用户手写记忆没有需求来源（AGENTS.md §1 YAGNI）。
- 错误码：404 不存在 / 400 查询参数非法 / 409 改写后前缀重复 / 422 请求体校验
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from ..core.memories import (
    DuplicateMemoryError,
    InvalidMemoryError,
    MemoryValidationError,
    VALID_KINDS,
    delete_memory,
    get_memory,
    list_memories,
    memory_maintenance,
    update_memory,
)
from ..db import connect

router = APIRouter(prefix="/api/v1/memories", tags=["memories"])


class MemoryPatch(BaseModel):
    """部分改写：所有字段可选，None 表示不修改。"""
    kind: str | None = Field(default=None, pattern="^(fact|preference|goal|mistake_pattern)$")
    content: str | None = Field(default=None, min_length=1, max_length=2000)
    importance: float | None = Field(default=None, ge=0.0, le=1.0)
    confidence: float | None = Field(default=None, ge=0.0, le=1.0)
    concepts: list[str] | None = None


@router.get("")
def list_memories_api(
    kind: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> dict:
    """记忆列表（管理面全量可见）。

    total 为过滤后总数，前端据此算页数。
    """
    conn = connect()
    try:
        return list_memories(conn, kind=kind, limit=limit, offset=offset)
    except MemoryValidationError as e:
        raise HTTPException(
            status_code=400, detail=f"{e.field} must be one of {sorted(VALID_KINDS)}"
        )
    finally:
        conn.close()


@router.get("/maintenance")
def memory_maintenance_api() -> dict:
    """Memory Agent 维护视图：按 value（importance×新近度）排序 + 保留建议。

    只建议不删除（删除仍走 DELETE /memories/{id}）。
    注意：须定义在 /memories/{memory_id} 之前，避免被 {id} 捕获。
    """
    conn = connect()
    try:
        return memory_maintenance(conn)
    finally:
        conn.close()


@router.get("/{memory_id}")
def get_memory_api(memory_id: int) -> dict:
    """单条记忆详情。"""
    conn = connect()
    try:
        memory = get_memory(conn, memory_id)
        if memory is None:
            raise HTTPException(status_code=404, detail="memory not found")
        return memory
    finally:
        conn.close()


@router.patch("/{memory_id}")
def patch_memory_api(memory_id: int, body: MemoryPatch) -> dict:
    """部分改写一条记忆。"""
    conn = connect()
    try:
        memory = update_memory(
            conn,
            memory_id,
            kind=body.kind,
            content=body.content,
            importance=body.importance,
            confidence=body.confidence,
            concepts_json=body.concepts,
        )
    except DuplicateMemoryError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except (MemoryValidationError, InvalidMemoryError) as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        conn.close()

    if memory is None:
        raise HTTPException(status_code=404, detail="memory not found")
    return memory


@router.delete("/{memory_id}")
def delete_memory_api(memory_id: int) -> dict:
    """删除一条记忆（硬删）。"""
    conn = connect()
    try:
        if not delete_memory(conn, memory_id):
            raise HTTPException(status_code=404, detail="memory not found")
        return {"ok": True}
    finally:
        conn.close()
