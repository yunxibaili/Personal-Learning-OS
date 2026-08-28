"""T-EXPORT（B11）：一键全量导出——用户数据永不锁死红线的兑现。

范围契约（docs/release/EXPORT_MANIFEST.md + AGENTS §3）：
  必含：vault/**（md + mindmap json）· attachments/** ·
        metadata/eventlogs/*.jsonl · settings（脱敏后）
  必排：db/ · metadata/devices.json · metadata/manifest.json · 一切 API key 明文

纯标准库（zipfile），读侧不触碰任何写入路径。

settings 过滤规则（P1 修正：三规则并集，强于任何单一来源）：
  - 键名含 "api_key" 子串（拦 llm_api_key）
  - 键名精确命中 core/ai/constants.SENSITIVE_FIELD_NAMES（拦 token/password）
  - 值以 SENSITIVE_CONTENT_PREFIXES 开头（拦 sk-/Bearer/ghp_/xoxb- 值）
注意与 routers/settings 的区别：那里是**掩码**（值变 ****** 保留键），
这里是**整体排除**（导出包不该有不完整凭据占位）。
"""
from __future__ import annotations

import re
import zipfile
from io import BytesIO
from pathlib import Path

from ..db import connect, workspace_root
from .ai.constants import SENSITIVE_CONTENT_PREFIXES, SENSITIVE_FIELD_NAMES

# 子串规则（拦 llm_api_key 等组合命名）
SENSITIVE_SETTING_TOKEN = "api_key"

# 目录白名单（相对 workspace）；entrylogs 单列以便未来差异化处理
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


def _is_sensitive_setting(key: str, value: str) -> bool:
    """三规则并集：子串 ∪ 命名段命中 ∪ 值前缀（P1：互补单一规则的盲区）。

    命名段匹配：settings 键多为复合命名（llm.token / db.password），
    按 . _ - 切段后任一段命中 SENSITIVE_FIELD_NAMES 即视为敏感。
    """
    k = key.lower()
    if SENSITIVE_SETTING_TOKEN in k:
        return True
    segments = re.split(r"[._-]", k)
    if any(seg in SENSITIVE_FIELD_NAMES for seg in segments):
        return True
    return any(value.startswith(prefix) for prefix in SENSITIVE_CONTENT_PREFIXES)


def _collect_settings_sanitized(conn) -> dict[str, str]:
    """settings 导出：命中敏感规则的条目整体排除（非掩码——掩码值无导出价值）。"""
    rows = conn.execute("SELECT key, value FROM settings").fetchall()
    return {
        r["key"]: r["value"]
        for r in rows
        if not _is_sensitive_setting(r["key"], r["value"])
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
            import json
            files["settings.json"] = json.dumps(
                settings, ensure_ascii=False, indent=2,
            ).encode("utf-8")
    finally:
        conn.close()

    buf = BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for rel in sorted(files):
            zf.writestr(rel, files[rel])
    return buf.getvalue()


__all__ = ["create_export_zip", "EXPORT_DIRS", "FORBIDDEN_EXPORT_NAMES"]
