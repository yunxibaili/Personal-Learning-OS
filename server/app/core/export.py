"""T-EXPORT（B11）：一键全量导出——用户数据永不锁死红线的兑现。

范围契约（docs/release/EXPORT_MANIFEST.md + AGENTS §3）：
  必含：vault/**（md + mindmap json）· attachments/** ·
        metadata/eventlogs/*.jsonl · concepts.json（概念+掌握度快照，BUG-1）·
        settings（脱敏后）
  必排：db/ · metadata/devices.json · metadata/manifest.json · 一切 API key 明文

concepts.json（BUG-1 修复，2026-08-31）：概念与学习状态只存 SQLite，此前不随
导出走——「删 SQLite 仅凭导出包可恢复核心学习数据」不变量不成立（场景 C 实测
概念 1→0 / 掌握度 1→0）。现把概念全量清单 + concept_mastery（含 SM-2 字段）
导出为单文件 JSON 快照；重建侧 admin/reindex 消费它恢复概念与掌握度。
L1/L2 分层（ADR-020）语义：md+eventlogs 仍是事件真相，concepts.json 是
「当前学习状态」的用户可读快照——两者都随包走，恢复时快照优先、事件回放兜底。

纯标准库（zipfile），读侧不触碰任何写入路径。

settings 过滤规则：复用 core/ai/constants.is_sensitive_setting（三规则并集），
**与 routers/settings 判定同源**（2026-08-29 修：此前两处规则不同步，
settings 端点明文返回 password/token/sk- 值）。
唯一区别是消费语义：
  - 这里：命中 → 整体排除（导出包不该有不完整凭据占位）
  - 那里：命中 → 掩码为 ******（保留键，前端需知道配置项存在）
"""
from __future__ import annotations

import json
import zipfile
from io import BytesIO
from pathlib import Path

from ..db import connect, workspace_root
from .ai.constants import is_sensitive_setting

# 目录白名单（相对 workspace）；eventlogs 单列以便未来差异化处理
EXPORT_DIRS = ("vault", "attachments", "mind_maps", "metadata/eventlogs")

# 显式排除（防御性：白名单已排除，这里保证"哪怕白名单错配也不出包"）
FORBIDDEN_EXPORT_NAMES = ("devices.json", "manifest.json")


def _collect_files(workspace: Path) -> dict[str, bytes]:
    """按白名单目录收集文件（相对 POSIX 路径 → 字节）。"""
    files: dict[str, bytes] = {}
    for sub in EXPORT_DIRS:
        base = workspace / sub
        if not base.is_dir():
            continue
        for p in sorted(base.rglob("*")):
            if not p.is_file():
                continue
            rel = f"{sub}/{p.relative_to(base).as_posix()}"
            if any(name in rel for name in FORBIDDEN_EXPORT_NAMES):
                continue
            files[rel] = p.read_bytes()
    return files


def _collect_settings_sanitized(conn) -> dict[str, str]:
    """settings 导出：命中敏感规则的条目整体排除（非掩码——掩码值无导出价值）。"""
    rows = conn.execute("SELECT key, value FROM settings").fetchall()
    return {
        r["key"]: r["value"]
        for r in rows
        if not is_sensitive_setting(r["key"], r["value"])
    }


def collect_concepts_snapshot(conn) -> dict:
    """概念 + 学习状态快照（BUG-1）：导出全量 concepts 与 concept_mastery。

    - concepts：全部生命周期状态（active/unconfirmed/archived）都导出——
      unconfirmed stub 是链接拓扑的一部分，archived 是软删除（数据不锁死）。
    - mastery：SM-2 排期字段（ease_factor/interval/review_count/next_review）
      原样带走，重建后复习节奏不归零。
    结构带 version 字段，未来 schema 演进时可做迁移。
    """
    concepts = [
        dict(r)
        for r in conn.execute(
            "SELECT id, title, aliases_json, summary, domain, origin, status, "
            "created_at, updated_at FROM concepts ORDER BY id"
        ).fetchall()
    ]
    mastery = [
        dict(r)
        for r in conn.execute(
            "SELECT concept_id, dimensions, effective, next_review, ease_factor, "
            "interval, review_count, created_at, updated_at "
            "FROM concept_mastery ORDER BY concept_id"
        ).fetchall()
    ]
    review_queue = [
        dict(r)
        for r in conn.execute(
            "SELECT concept_id, due_at, priority, status, last_result, "
            "created_at, updated_at FROM review_queue ORDER BY concept_id"
        ).fetchall()
    ]
    return {
        "version": 1,
        "exported_at": __import__("datetime").datetime.now().isoformat(timespec="seconds"),
        "concepts": concepts,
        "mastery": mastery,
        "review_queue": review_queue,
    }


def create_export_zip(workspace: Path | None = None) -> bytes:
    """生成全量导出 zip（内存构建，个人库规模可控）。

    返回 zip 字节流；调用方（router）负责 HTTP 包装。
    """
    ws = workspace or workspace_root()
    conn = connect()
    try:
        files = _collect_files(ws)
        settings = _collect_settings_sanitized(conn)
        if settings:  # 空 settings 不产出空文件（保持导出包只含真实数据）
            files["settings.json"] = json.dumps(
                settings, ensure_ascii=False, indent=2,
            ).encode("utf-8")
        snapshot = collect_concepts_snapshot(conn)
        # 概念快照：只要有概念就导出（ mastery/review_queue 挂在概念上，随行）
        if snapshot["concepts"]:
            files["concepts.json"] = json.dumps(
                snapshot, ensure_ascii=False, indent=2,
            ).encode("utf-8")
    finally:
        conn.close()

    buf = BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for rel in sorted(files):
            zf.writestr(rel, files[rel])
    return buf.getvalue()


__all__ = [
    "create_export_zip",
    "EXPORT_DIRS",
    "FORBIDDEN_EXPORT_NAMES",
    "collect_concepts_snapshot",
]
