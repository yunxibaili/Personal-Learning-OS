"""Auto-Link 核心（B4）：基于内容重叠的链接建议（确定性，非 LLM）。

为指定的笔记计算与之内容相似的其它笔记，作为 `related` 链接候选返回
（只建议、不自动写入——写入仍需用户确认，符合「先内容结构，后自动」）。

设计约束：
  - 纯逻辑层，不 import FastAPI
  - 不写库，不产生 learning_event / mastery（ADR-019/022 边界）
  - 已有链接（source→target，任意 relation）与自链接被排除

分词：
  - 拉丁/数字按词
  - CJK 按字符 bigram（无分词器依赖，中文可用；不引 jieba）
  - 2026-09-02（ADR-027）：底层切分规则收敛到 `cjk_bigram.tokens`（FTS 写入/
    查询共用同一 tokenizer）；autolink 保留自身历史语义——**过滤单字 CJK
    词元**（孤立单字噪声大，bigram 更有区分度）。因此对原文与对 segment 后
    的检索文本切分结果一致（`suggest_note_links` 读 notes_fts.body 即检索文本）。
"""
from __future__ import annotations

import math

from . import cjk_bigram


def tokenize(text: str) -> set[str]:
    """正文 → 词元集合（拉丁词 + CJK 字符 bigram；单字 CJK 词元过滤）。

    底层规则来自 cjk_bigram.tokens（ADR-027 收敛）；本函数只叠加 autolink
    自身的集合语义：小写化 + 过滤单字 CJK。
    """
    return {
        t.lower()
        for t in cjk_bigram.tokens(text)
        if not (len(t) == 1 and cjk_bigram.is_single_cjk(t))
    }


def content_overlap(tokens_a: set[str], tokens_b: set[str]) -> float:
    """两组词元的余弦相似度（0~1）。空集返回 0。"""
    if not tokens_a or not tokens_b:
        return 0.0
    inter = len(tokens_a & tokens_b)
    if inter == 0:
        return 0.0
    return round(inter / math.sqrt(len(tokens_a) * len(tokens_b)), 4)


def suggest_note_links(
    conn,
    note_id: int,
    *,
    limit: int = 5,
    min_score: float = 0.0,
) -> list[dict]:
    """为 note_id 建议其它笔记的 related 链接候选。

    排除：自身 · 已存在的链接（source=note_id 或 target=note_id 的任一 relation）。
    返回：[{source_note_id, target_note_id, target_title, score}]（score 降序）。
    """
    me = conn.execute(
        "SELECT n.title, f.body FROM notes n LEFT JOIN notes_fts f ON f.note_id=n.id "
        "WHERE n.id=?", (note_id,),
    ).fetchone()
    if me is None:
        return []
    tokens_me = tokenize(me["body"] or me["title"] or "")

    # 已存在链接（双向）排除
    linked: set[int] = set()
    for row in conn.execute(
        "SELECT source_id, target_id FROM links WHERE source_type='note' AND target_type='note' "
        "AND (source_id=? OR target_id=?)",
        (note_id, note_id),
    ).fetchall():
        linked.add(row["source_id"])
        linked.add(row["target_id"])
    linked.discard(note_id)

    rows = conn.execute(
        "SELECT n.id, n.title, f.body FROM notes n LEFT JOIN notes_fts f ON f.note_id=n.id "
        "WHERE n.id<>?",
        (note_id,),
    ).fetchall()

    scored: list[tuple[float, dict]] = []
    for r in rows:
        if r["id"] in linked:
            continue
        score = content_overlap(tokens_me, tokenize(r["body"] or r["title"] or ""))
        if score < min_score:
            continue
        scored.append((score, {
            "source_note_id": note_id,
            "target_note_id": r["id"],
            "target_title": r["title"],
            "score": score,
        }))

    scored.sort(key=lambda pair: pair[0], reverse=True)
    return [item for _, item in scored[:limit]]


__all__ = ["tokenize", "content_overlap", "suggest_note_links"]
