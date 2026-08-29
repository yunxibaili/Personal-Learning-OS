"""Memories Core（B3）：用户记忆的写入与校验 + 管理面读写（B28）。

memories 表的生产者（TABLE_AUDIT (b)→(a)）与唯一读写口。
职责：
  - 应用层校验（kind ∈ {fact, preference, goal, mistake_pattern}）
  - 应用层校验（importance/confidence ∈ [0, 1]）
  - 前缀去重（content 归一化前 50 字符相同视为重复，跳过）
  - 写入 memories 表
  - 管理面（B28）：列出 / 读取 / 改写 / 删除——AI 自动写入记忆的可见性与可撤销性

两条通道的区分（B28 冻结，勿混用）：

| 通道 | 函数 | 敏感前缀处理 | 用途 |
|---|---|---|---|
| 消费面 | get_memories | **过滤**（不进 prompt） | AI 读取，防御密钥泄漏 |
| 管理面 | list_memories / get_memory | **不过滤** | 用户查看与管理 |

管理面不做敏感过滤的理由：敏感前缀过滤是「不进 prompt」的消费面保护；
若管理面同样过滤，`sk-` 前缀的记忆会变成用户看不见、删不掉的暗账，
与产品第一原则「用户数据永不锁死 / 本地优先可审计」直接冲突。
管理面必须全量可见，用户才能删除被误写入的敏感内容。

禁止：
  - 直接调用 LLM
  - import FastAPI
  - 修改 learning_events / concept_mastery
"""
from __future__ import annotations

import json

# 校验常量（冻结）
VALID_KINDS = frozenset({"fact", "preference", "goal", "mistake_pattern"})
DEDUP_PREFIX_LEN = 50


class MemoryValidationError(Exception):
    """memories 校验失败（kind/importance 非法）。"""
    def __init__(self, field: str, value: str) -> None:
        self.field = field
        self.value = value
        super().__init__(f"invalid {field}: {value}")


class InvalidMemoryError(Exception):
    """memories 内容非法（空内容/空白）。"""
    pass


class DuplicateMemoryError(Exception):
    """改写后与既有记忆前缀重复（B28：update_memory 的冲突信号）。

    与 upsert_memory 的「返回 None 静默跳过」语义不同：写入路径是无人值守的
    AI 提取，跳过即可；改写路径是用户显式操作，静默无变化不可接受，必须报错。
    """
    pass


def _normalize_content(content: str) -> str:
    """内容归一化：strip + 小写（前缀去重用）。"""
    return content.strip().lower()


# ── 校验助手（写入面与改写面共用，B28 冻结） ──────────────────────
#
# 两条写入路径必须抛同一批异常、同样的边界值，否则前端要为同一字段
# 写两套错误处理。抽出来的唯一目的就是这个，不是为了抽象而抽象。

def _validate_kind(kind: str) -> None:
    if kind not in VALID_KINDS:
        raise MemoryValidationError("kind", kind)


def _validate_score(field: str, value: float) -> None:
    if not (0.0 <= value <= 1.0):
        raise MemoryValidationError(field, str(value))


def _validate_content(content: str) -> None:
    if not content or not content.strip():
        raise InvalidMemoryError("content cannot be empty or whitespace")


def _serialize_concepts(concepts_json: str | list | None) -> str:
    """concepts 序列化：list → JSON 字符串；None → '[]'（表默认值）。"""
    if isinstance(concepts_json, list):
        return json.dumps(concepts_json, ensure_ascii=False)
    if concepts_json is None:
        return "[]"
    return str(concepts_json)


def _row_to_memory(row) -> dict:
    """memories 行 → API 形态 dict（解析 concepts_json → concepts）。

    统一管理面与消费面的行转换，避免同一解析逻辑散落多处。
    """
    d = dict(row)
    try:
        d["concepts"] = json.loads(d["concepts_json"]) if d["concepts_json"] else []
    except (json.JSONDecodeError, TypeError):
        d["concepts"] = []
    return d


def _dup_conflict(conn, content: str, exclude_id: int | None = None) -> bool:
    """归一化前缀是否与既有记忆冲突（exclude_id 为改写时排除自身）。"""
    normalized = _normalize_content(content)
    prefix = normalized[:DEDUP_PREFIX_LEN]
    if not prefix:
        return False
    rows = conn.execute("SELECT id, content FROM memories").fetchall()
    for row in rows:
        if exclude_id is not None and row["id"] == exclude_id:
            continue
        existing = _normalize_content(row["content"])[:DEDUP_PREFIX_LEN]
        min_len = min(len(prefix), len(existing))
        if min_len > 0 and prefix[:min_len] == existing[:min_len]:
            return True
    return False


def upsert_memory(
    conn,
    *,
    kind: str,
    content: str,
    importance: float = 0.5,
    confidence: float = 0.5,
    concepts_json: str | list | None = None,
) -> int | None:
    """写入一条用户记忆。应用层校验 + 前缀去重。

    Args:
        conn: SQLite 连接
        kind: 记忆类型（fact/preference/goal/mistake_pattern）
        content: 记忆内容
        importance: 重要性 [0, 1]
        confidence: 置信度 [0, 1]
        concepts_json: 关联概念列表 JSON 字符串或 Python 列表

    Returns:
        memory id（写入成功）或 None（去重跳过）

    Raises:
        MemoryValidationError: kind/importance 非法
    """
    _validate_kind(kind)
    _validate_score("importance", importance)
    _validate_score("confidence", confidence)
    _validate_content(content)

    # 前缀去重：归一化前 50 字符相同 → 跳过
    # 使用 Python 侧比较（SQLite SUBSTR 对多字节字符处理不一致）
    normalized = _normalize_content(content)
    prefix = normalized[:DEDUP_PREFIX_LEN]

    rows = conn.execute("SELECT content FROM memories").fetchall()
    for row in rows:
        existing_prefix = _normalize_content(row["content"])[:DEDUP_PREFIX_LEN]
        # 比较较短的前缀（处理内容短于50字符的情况）
        min_len = min(len(prefix), len(existing_prefix))
        if min_len > 0 and prefix[:min_len] == existing_prefix[:min_len]:
            return None  # 去重跳过

    # 写入
    cur = conn.execute(
        "INSERT INTO memories (kind, content, importance, confidence, concepts_json, last_used_at) "
        "VALUES (?, ?, ?, ?, ?, datetime('now'))",
        (kind, content, importance, confidence, _serialize_concepts(concepts_json)),
    )
    conn.commit()
    return cur.lastrowid


def get_memories(conn, *, limit: int = 5, touch_on_hit: bool = False) -> list[dict]:
    """获取用户记忆（importance × recency 复合排序，B8.1）。

    排序规则（确定性）：
      1. importance DESC — 重要性优先
      2. last_used_at DESC — 最近命中优先
      3. created_at DESC — 最近创建优先
      4. id DESC — 同分 tie-breaker（保证幂等）

    Args:
        conn: SQLite 连接
        limit: 返回条数
        touch_on_hit: 是否更新 last_used_at（B8 接入后使用）
    """
    from .ai.constants import SENSITIVE_CONTENT_PREFIXES

    rows = conn.execute(
        "SELECT id, kind, content, importance, confidence, concepts_json, "
        "  last_used_at, created_at "
        "FROM memories "
        "ORDER BY importance DESC, last_used_at DESC, created_at DESC, id DESC "
        "LIMIT ?",
        (limit * 10,),  # 多取一些以便过滤后仍够数
    ).fetchall()
    result = []
    for row in rows:
        # 过滤敏感内容
        content = row["content"]
        if any(content.startswith(p) for p in SENSITIVE_CONTENT_PREFIXES):
            continue

        result.append(_row_to_memory(row))
        if len(result) >= limit:
            break

    # touch_on_hit: 更新 last_used_at（B8.1：命中后刷新 recency 排序位）
    if touch_on_hit and result:
        ids = [r["id"] for r in result]
        placeholders = ",".join("?" * len(ids))
        conn.execute(
            f"UPDATE memories SET last_used_at = datetime('now') WHERE id IN ({placeholders})",
            ids,
        )
        conn.commit()
    return result


def get_recent_memories(conn, *, limit: int = 5) -> list[dict]:
    """获取最近的用户记忆（按 created_at 倒序）。"""
    rows = conn.execute(
        "SELECT id, kind, content, importance, confidence, concepts_json, "
        "  last_used_at, created_at "
        "FROM memories ORDER BY created_at DESC LIMIT ?",
        (limit,),
    ).fetchall()
    return [dict(r) for r in rows]


# ── 管理面（B28）────────────────────────────────────────────────
#
# AI 自动写入的记忆必须对用户可见、可改、可删，否则「用户数据永不锁死」
# 这条第一原则在记忆这块就是空的。以下四个函数是管理面的唯一读写口。

_MEMORY_COLUMNS = (
    "id, kind, content, importance, confidence, concepts_json, "
    "last_used_at, created_at, updated_at"
)


def list_memories(
    conn,
    *,
    kind: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> dict:
    """管理面列表：全量可见，**不过滤敏感前缀**。

    排序与消费面有意不同：
      - 消费面 get_memories：importance × recency —— 给 AI 挑「最值得说的」
      - 管理面 list_memories：created_at DESC, id DESC —— 给用户看「刚提取了什么」

    Args:
        kind: 按类型过滤；None 表示不过滤
        limit / offset: 分页

    Returns:
        {"memories": [...], "total": int} —— total 是过滤后总数，不是当页条数

    Raises:
        MemoryValidationError: kind 非法
    """
    where = ""
    params: list = []
    if kind is not None:
        _validate_kind(kind)
        where = "WHERE kind = ?"
        params.append(kind)

    total = conn.execute(
        f"SELECT COUNT(*) FROM memories {where}", params
    ).fetchone()[0]

    rows = conn.execute(
        f"SELECT {_MEMORY_COLUMNS} FROM memories {where} "
        "ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?",
        (*params, limit, offset),
    ).fetchall()
    return {"memories": [_row_to_memory(r) for r in rows], "total": total}


def get_memory(conn, memory_id: int) -> dict | None:
    """管理面单条读取：全量可见，不过滤敏感前缀。不存在返回 None。"""
    row = conn.execute(
        f"SELECT {_MEMORY_COLUMNS} FROM memories WHERE id = ?", (memory_id,)
    ).fetchone()
    return _row_to_memory(row) if row else None


def update_memory(
    conn,
    memory_id: int,
    *,
    kind: str | None = None,
    content: str | None = None,
    importance: float | None = None,
    confidence: float | None = None,
    concepts_json: str | list | None = None,
) -> dict | None:
    """管理面改写：部分更新，只动传入的字段。

    与 upsert_memory 的去重语义不同（见 DuplicateMemoryError）：
    写入路径是无人值守的 AI 提取，撞车跳过即可；改写路径是用户显式操作，
    静默无变化不可接受，必须抛错让前端提示。

    Args:
        各字段 None 表示「不修改」

    Returns:
        更新后的 memory dict；不存在返回 None

    Raises:
        MemoryValidationError: kind/importance/confidence 非法
        InvalidMemoryError: content 为空
        DuplicateMemoryError: 改写后的 content 与既有记忆前缀冲突
    """
    existing = get_memory(conn, memory_id)
    if existing is None:
        return None

    # 先全量校验再落库——不允许出现「改了 content 但 importance 非法」的半写态
    new_kind = kind if kind is not None else existing["kind"]
    new_content = content if content is not None else existing["content"]
    new_importance = importance if importance is not None else existing["importance"]
    new_confidence = confidence if confidence is not None else existing["confidence"]

    if kind is not None:
        _validate_kind(new_kind)
    if importance is not None:
        _validate_score("importance", new_importance)
    if confidence is not None:
        _validate_score("confidence", new_confidence)
    if content is not None:
        _validate_content(new_content)
        # exclude_id：改自己不算撞车，否则连改个 importance 都动不了
        if _dup_conflict(conn, new_content, exclude_id=memory_id):
            raise DuplicateMemoryError(
                f"content 与既有记忆前缀重复（前 {DEDUP_PREFIX_LEN} 字符）"
            )

    if concepts_json is not None:
        new_concepts = _serialize_concepts(concepts_json)
    else:
        new_concepts = existing["concepts_json"]

    conn.execute(
        "UPDATE memories SET kind = ?, content = ?, importance = ?, confidence = ?, "
        "concepts_json = ?, updated_at = datetime('now') WHERE id = ?",
        (new_kind, new_content, new_importance, new_confidence,
         new_concepts, memory_id),
    )
    conn.commit()
    return get_memory(conn, memory_id)


def delete_memory(conn, memory_id: int) -> bool:
    """管理面删除（硬删）。不存在返回 False。

    硬删而非软删的理由：memories 是 AI 的派生推断，不是用户创作内容，
    没有 status 列也不需要「忽略」语义；用户点删除就是让它彻底消失，
    留在表里只是下次还会进 prompt。
    """
    cur = conn.execute("DELETE FROM memories WHERE id = ?", (memory_id,))
    conn.commit()
    return cur.rowcount > 0


__all__ = [
    "VALID_KINDS",
    "DEDUP_PREFIX_LEN",
    "MemoryValidationError",
    "InvalidMemoryError",
    "DuplicateMemoryError",
    "upsert_memory",
    "get_memories",
    "get_recent_memories",
    "list_memories",
    "get_memory",
    "update_memory",
    "delete_memory",
]
