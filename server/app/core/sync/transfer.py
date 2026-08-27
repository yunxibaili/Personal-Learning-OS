"""M7 Sync Engine: Transfer — 低级文件传输操作。

ADR-020 冻结：
  - 只传输 Layer 1 Truth Source 文件（vault/eventlogs/mind_maps）
  - 永不传输 db/ / metadata/devices.json / settings
  - 文件写入使用原子写入（write → fsync → rename）
  - 不修改 mastery / review_queue / SQLite

职责：
  - is_syncable(path): 判断路径是否在同步白名单内
  - read_file_bytes(ws, path): 读取文件内容
  - write_file_atomic(ws, path, data): 原子写入文件
  - validate_hash(data, expected): 验证内容哈希
"""
from __future__ import annotations

import base64
import fnmatch
import hashlib
import os
import tempfile
from pathlib import Path

from .manifest import SYNC_PATTERNS, SYNC_BLACKLIST


def is_syncable(path: str) -> bool:
    """判断文件路径是否允许同步（ADR-020 白名单 + 黑名单）。

    使用递归路径匹配支持 ** 通配符（与 scanner.py 一致）。

    Args:
        path: 相对于 workspace 的路径，如 "vault/ml.md"

    Returns:
        True = 允许同步, False = 禁止同步
    """
    normalized = path.replace("\\", "/")

    # 黑名单检查
    for bl in SYNC_BLACKLIST:
        bl_norm = bl.replace("\\", "/")
        if normalized == bl_norm or normalized.startswith(bl_norm + "/"):
            return False

    # 白名单检查（递归路径匹配）
    for pattern in SYNC_PATTERNS:
        if _path_matches(normalized, pattern):
            return True

    return False


def _path_matches(path: str, pattern: str) -> bool:
    """递归路径匹配，支持 ** 通配符（与 scanner.py 一致）。"""
    path_parts = path.split("/")
    pattern_parts = pattern.split("/")
    return _match_parts(path_parts, pattern_parts)


def _match_parts(path_parts: list[str], pattern_parts: list[str]) -> bool:
    """递归匹配路径组件。"""
    if not pattern_parts:
        return not path_parts

    if pattern_parts[0] == "**":
        # ** 匹配零个或多个目录
        if _match_parts(path_parts, pattern_parts[1:]):
            return True
        if path_parts and _match_parts(path_parts[1:], pattern_parts):
            return True
        return False

    if not path_parts:
        return False

    if fnmatch.fnmatch(path_parts[0], pattern_parts[0]):
        return _match_parts(path_parts[1:], pattern_parts[1:])

    return False


def read_file_bytes(workspace: Path, rel_path: str) -> bytes | None:
    """读取 workspace 下的文件内容。

    Args:
        workspace: workspace 根目录
        rel_path: 相对路径

    Returns:
        文件内容，路径不存在返回 None
    """
    full_path = workspace / rel_path
    if not full_path.exists():
        return None
    try:
        return full_path.read_bytes()
    except OSError:
        return None


def write_file_atomic(workspace: Path, rel_path: str, data: bytes) -> str | None:
    """原子写入文件（write → fsync → rename）。

    Args:
        workspace: workspace 根目录
        rel_path: 相对路径
        data: 文件内容

    Returns:
        SHA-256 哈希，写入失败返回 None
    """
    full_path = workspace / rel_path
    try:
        full_path.parent.mkdir(parents=True, exist_ok=True)

        # 写入临时文件
        fd, tmp_path = tempfile.mkstemp(
            dir=full_path.parent,
            prefix=".sync_tmp_",
        )
        try:
            os.write(fd, data)
            os.fsync(fd)
        finally:
            os.close(fd)

        # 原子替换
        os.replace(tmp_path, str(full_path))

        # 计算哈希
        h = hashlib.sha256(data).hexdigest()
        return h
    except OSError:
        # 清理临时文件
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        return None


def validate_hash(data: bytes, expected: str) -> bool:
    """验证内容 SHA-256 哈希。

    Args:
        data: 文件内容
        expected: 期望的哈希值

    Returns:
        True = 哈希匹配
    """
    if not expected:
        return True  # 无哈希要求时跳过验证
    actual = hashlib.sha256(data).hexdigest()
    return actual == expected


def encode_content(data: bytes) -> str:
    """将文件内容编码为 base64 字符串。"""
    return base64.b64encode(data).decode("ascii")


def decode_content(encoded: str) -> bytes:
    """将 base64 字符串解码为文件内容。"""
    return base64.b64decode(encoded.encode("ascii"))
