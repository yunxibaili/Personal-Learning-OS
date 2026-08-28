"""T-EXPORT（B11）：一键全量导出——用户数据永不锁死红线的兑现。

范围契约（docs/release/EXPORT_MANIFEST.md + AGENTS §3）：
  必含：vault/**（md + mindmap json）· attachments/** ·
        metadata/eventlogs/*.jsonl · settings（脱敏后）
  必排：db/ · metadata/devices.json · metadata/manifest.json · 一切 API key 明文

纯标准库（zipfile），读侧不触碰任何写入路径；settings 经 db 读取但脱敏规则
与 routers/settings.MASK_SUFFIX 一致（key 含 api_key 即排除）。
"""
from __future__ import annotations

import zipfile
from io import BytesIO
from pathlib import Path

from ..db import connect, workspace_root

# settings 脱敏：与 routers/settings.MASK_SUFFIX 同规则（单一语义，双处引用）
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


def _collect_settings_sanitized(conn) -> dict[str, str]:
    """settings 全量导出，但 key 含 api_key 的条目整体排除（非掩码——掩码值无导出价值）。"""
    rows = conn.execute("SELECT key, value FROM settings").fetchall()
    return {
        r["key"]: r["value"]
        for r in rows
        if SENSITIVE_SETTING_TOKEN not in r["key"].lower()
    }


def create_export_zip(workspace: Path | None = None) -> bytes:
    """生成全量导出 zip（内存构建，个人库规模可控）。

    返回 zip 字节流；调用方（router）负责 HTTP 包装。
    """
    ws = workspace or workspace_root()
    conn = connect()
    try:
        files = _collect_files(ws)
        files["settings.json"] = (
            __import__("json").dumps(
                _collect_settings_sanitized(conn),
                ensure_ascii=False, indent=2,
            ).encode("utf-8")
        )
    finally:
        conn.close()

    buf = BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for rel in sorted(files):
            zf.writestr(rel, files[rel])
    return buf.getvalue()


__all__ = ["create_export_zip", "EXPORT_DIRS", "FORBIDDEN_EXPORT_NAMES"]
