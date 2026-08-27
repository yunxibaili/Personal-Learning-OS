"""M7 Sync Engine: Scanner — 扫描 workspace Truth Source 生成 Manifest。

ADR-005/020 冻结：
  - 扫描范围：vault/*.md + eventlogs/*.jsonl + mind_maps/*.mindmap.json
  - 不扫描：db/ / settings / API keys
"""
from __future__ import annotations

import fnmatch
import os
from pathlib import Path

from .manifest import FileEntry, Manifest, file_sha256, SYNC_PATTERNS, SYNC_BLACKLIST


def _is_blacklisted(rel_path: str) -> bool:
    """检查路径是否在黑名单中。"""
    for pattern in SYNC_BLACKLIST:
        if rel_path.startswith(pattern) or fnmatch.fnmatch(rel_path, pattern):
            return True
    return False


def _matches_patterns(rel_path: str) -> bool:
    """检查路径是否匹配同步白名单模式。

    支持 ** 通配符：匹配零个或多个目录层级。
    """
    for pattern in SYNC_PATTERNS:
        if _path_matches(rel_path, pattern):
            return True
    return False


def _path_matches(path: str, pattern: str) -> bool:
    """简化 glob 匹配，支持 ** 匹配任意目录层级。

    将 pattern 拆分为含 ** 的完整段列表，然后递归匹配。
    """
    # 将 pattern 拆分为段，保留 ** 作为独立段
    # "vault/**/*.md" → ["vault", "**", "*.md"]
    pat_parts = pattern.split("/")
    path_parts = path.split("/") if path else []

    def _match(pi: int, si: int) -> bool:
        if si == len(pat_parts):
            return pi == len(path_parts)

        sp = pat_parts[si]
        if sp == "**":
            # ** 匹配零个或多个路径段
            for k in range(pi, len(path_parts) + 1):
                if _match(k, si + 1):
                    return True
            return False
        elif sp == "*":
            if pi >= len(path_parts):
                return False
            return _match(pi + 1, si + 1)
        else:
            if pi >= len(path_parts):
                return False
            if not fnmatch.fnmatch(path_parts[pi], sp):
                return False
            return _match(pi + 1, si + 1)

    return _match(0, 0)


def scan_workspace(workspace: Path, device_id: str) -> Manifest:
    """扫描 workspace 目录，生成 Manifest。

    只扫描 Layer 1 Truth Source 文件（vault/eventlogs/mind_maps）。
    """
    manifest = Manifest(device_id=device_id)

    for root, dirs, files in os.walk(workspace):
        # 跳过隐藏目录和黑名单目录
        dirs[:] = [
            d for d in dirs
            if not d.startswith(".")
            and not _is_blacklisted(
                os.path.relpath(os.path.join(root, d), workspace)
            )
        ]

        for fname in files:
            full_path = Path(root) / fname
            rel_path = os.path.relpath(full_path, workspace).replace("\\", "/")

            # 检查黑名单
            if _is_blacklisted(rel_path):
                continue

            # 检查白名单
            if not _matches_patterns(rel_path):
                continue

            # 收集文件信息
            try:
                stat = full_path.stat()
                entry = FileEntry(
                    path=rel_path,
                    sha256=file_sha256(full_path),
                    size=stat.st_size,
                    mtime=stat.st_mtime,
                )
                manifest.files[rel_path] = entry
            except (OSError, PermissionError):
                # 跳过无法读取的文件
                continue

    return manifest
