"""CJK bigram 检索切分（ADR-027）。

纯函数模块：无 IO、无业务依赖，可被 FTS 写入/查询两侧与 autolink 复用。

背景（ADR-011 → ADR-027）：FTS5 默认 unicode61 把连续汉字**整段**当成一个
token，中文短语/子串查询 0 命中。本项目选定**应用侧 bigram 预分词**（零新
依赖，所有者裁定 2026-09-02）：写入与查询前用同一个 `segment()` 把连续汉字
切成重叠 bigram（空格分隔），unicode61 即可正常索引；由于 bigram 序列与
子串一一对应，**短语匹配 ≈ 子串命中**。

契约（写入/查询必须共用，否则索引与查询词元错位——这是本模块存在的唯一理由）：
- `segment(text)`：
    非 CJK 片段（拉丁、数字、下划线、标点、空白）**原样保留**（含大小写）；
    连续汉字 run 长度 ≥ 2 → 重叠 bigram 序列，空格分隔；
    run 长度 == 1 → 单字原样保留（孤立单字自成词元）。
  返回值是「检索文本」，**不是原文快照**——原文唯一事实源是 vault/ 的
  Markdown 文件（ADR-001/005），`notes_fts` 列内容只服务检索。
- `tokens(text)`：`segment` 的词元序列视图（拉丁/数字/下划线词 + 汉字
  bigram/单字，保序）。供 autolink 等集合语义消费者复用；autolink 在自身
  层过滤单字 CJK 词元（其历史语义），因此喂原文或喂 segment 后文本等价。
- `is_single_cjk(text)`：strip 后恰为一个汉字（检索侧单字 LIKE 兜底路由用）。
- `has_token(text)`：是否含可索引词元字符（字母/数字/下划线/汉字）。

设计边界（所有者裁定 2026-09-02）：
- 不引 jieba / ICU / 自定义 SQLite tokenizer（六连问 ③ 即止 + stdlib
  sqlite3 不暴露 tokenizer 注册 API）；
- 不新增业务表、不新增 truth state、不把 bigram 文本写回 Markdown；
- autolink 可复用底层规则，但本模块**不得反向依赖 autolink 业务语义**。
"""
from __future__ import annotations

import re

_CJK_RUN_RE = re.compile(r"[\u4e00-\u9fff]+")
_CJK_SINGLE_RE = re.compile(r"^[\u4e00-\u9fff]$")
_TOKEN_RE = re.compile(r"[A-Za-z0-9_]+|[\u4e00-\u9fff]+")
_TOKEN_CHAR_RE = re.compile(r"[A-Za-z0-9_\u4e00-\u9fff]")


def segment(text: str) -> str:
    """任意文本 → 检索文本（CJK 连续 run 转重叠 bigram，其余原样）。"""
    if not text:
        return ""
    parts: list[str] = []
    pos = 0
    for m in _CJK_RUN_RE.finditer(text):
        parts.append(text[pos:m.start()])
        run = m.group()
        if len(run) == 1:
            parts.append(run)
        else:
            parts.append(" ".join(run[i:i + 2] for i in range(len(run) - 1)))
        pos = m.end()
    parts.append(text[pos:])
    return "".join(parts)


def tokens(text: str) -> list[str]:
    """文本 → 词元序列（**文档序**）：拉丁/数字/下划线词 + 汉字 bigram/单字。"""
    if not text:
        return []
    out: list[str] = []
    for m in _TOKEN_RE.finditer(text):
        run = m.group()
        if _CJK_RUN_RE.fullmatch(run):
            if len(run) == 1:
                out.append(run)
            else:
                out.extend(run[i:i + 2] for i in range(len(run) - 1))
        else:
            out.append(run)
    return out


def is_single_cjk(text: str) -> bool:
    """strip 后是否恰为一个汉字。"""
    return bool(_CJK_SINGLE_RE.match((text or "").strip()))


def has_token(text: str) -> bool:
    """是否含可索引词元字符（用于拦截纯标点/符号查询）。"""
    return bool(_TOKEN_CHAR_RE.search(text or ""))


__all__ = ["segment", "tokens", "is_single_cjk", "has_token"]
