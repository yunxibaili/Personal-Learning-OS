"""Conversations Core（B7）：对话与消息的持久化函数。

纯逻辑层：不 import FastAPI。conversations / messages 两张表的生产者
（TABLE_AUDIT (b)→(a)）。context_json 快照随 assistant 消息落库——
上下文透视与审计的数据基础。
"""
from __future__ import annotations

import json

from .tutor_types import TutorContext

DEFAULT_TITLE = "新对话"


class ConversationNotFoundError(Exception):
    """conversation_id 不存在。"""
    def __init__(self, conversation_id: int) -> None:
        self.conversation_id = conversation_id
        super().__init__(f"conversation {conversation_id} not found")


def create_conversation(conn, title: str = DEFAULT_TITLE) -> int:
    """新建对话，返回 id。空标题回退默认。"""
    title = (title or "").strip() or DEFAULT_TITLE
    cur = conn.execute(
        "INSERT INTO conversations (title) VALUES (?)", (title,))
    conn.commit()
    return cur.lastrowid


def list_conversations(conn) -> list[dict]:
    """对话列表（含消息数，按最近消息时间倒序）。"""
    rows = conn.execute(
        "SELECT c.id, c.title, c.created_at, "
        "  (SELECT COUNT(*) FROM messages m WHERE m.conversation_id=c.id) AS message_count "
        "FROM conversations c ORDER BY c.id DESC"
    ).fetchall()
    return [dict(r) for r in rows]


def conversation_exists(conn, conversation_id: int) -> bool:
    return conn.execute(
        "SELECT 1 FROM conversations WHERE id=?", (conversation_id,)
    ).fetchone() is not None


def get_messages(conn, conversation_id: int) -> list[dict]:
    """某对话的全部消息（角色/内容/快照/时间）。不存在抛错。"""
    if not conversation_exists(conn, conversation_id):
        raise ConversationNotFoundError(conversation_id)
    rows = conn.execute(
        "SELECT id, role, content, context_json, created_at "
        "FROM messages WHERE conversation_id=? ORDER BY id",
        (conversation_id,),
    ).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        try:
            d["context"] = json.loads(d.pop("context_json") or "{}")
        except json.JSONDecodeError:
            d["context"] = {}
        out.append(d)
    return out


def append_message(conn, conversation_id: int, *, role: str,
                   content: str, context: TutorContext | dict | None = None) -> int:
    """追加一条消息；assistant 消息携带 context 快照（上下文透视）。"""
    if role not in ("user", "assistant"):
        raise ValueError(f"invalid role: {role}")
    snapshot = json.dumps(context or {}, ensure_ascii=False, default=str)
    cur = conn.execute(
        "INSERT INTO messages (conversation_id, role, content, context_json) "
        "VALUES (?, ?, ?, ?)",
        (conversation_id, role, content, snapshot),
    )
    conn.commit()
    return cur.lastrowid


def delete_conversation(conn, conversation_id: int) -> None:
    """删除对话（messages 经 FK CASCADE 级联消失）。不存在抛错。"""
    if not conversation_exists(conn, conversation_id):
        raise ConversationNotFoundError(conversation_id)
    conn.execute("DELETE FROM conversations WHERE id=?", (conversation_id,))
    conn.commit()


__all__ = [
    "ConversationNotFoundError", "create_conversation", "list_conversations",
    "conversation_exists", "get_messages", "append_message",
    "delete_conversation", "DEFAULT_TITLE",
]
