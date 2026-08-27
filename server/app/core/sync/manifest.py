"""M7 Sync Engine: Manifest — 文件清单数据结构。

ADR-005/020 冻结：
  - 同步只发生在 Layer 1（Truth Source）
  - vault/*.md + eventlogs/*.jsonl + mind_maps/*.mindmap.json
  - SQLite / settings / API keys 永不同步
"""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


# ── 同步范围白名单（ADR-005/020）─────────────────────────────

# Layer 1 Truth Source 文件模式
SYNC_PATTERNS = [
    "vault/**/*.md",
    "metadata/eventlogs/**/*.jsonl",
    "mind_maps/**/*.mindmap.json",
]

# 永不同步黑名单目录
SYNC_BLACKLIST = [
    "db",
    "metadata/devices.json",
]


@dataclass(frozen=True)
class FileEntry:
    """单个文件的清单条目。"""
    path: str           # 相对于 workspace 的路径
    sha256: str         # 文件内容哈希
    size: int           # 字节数
    mtime: float        # 修改时间戳（Unix）

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> FileEntry:
        return cls(
            path=d["path"],
            sha256=d["sha256"],
            size=d["size"],
            mtime=d["mtime"],
        )


@dataclass
class Manifest:
    """设备的文件清单。

    结构：
      {
        "device_id": "abc",
        "version": 1,
        "generated_at": "2026-08-27T12:00:00Z",
        "files": {
          "vault/ml.md": { "sha256": "...", "size": 1024, "mtime": 1234567890.0 }
        }
      }
    """
    device_id: str
    version: int = 1
    generated_at: str = ""
    files: dict[str, FileEntry] = field(default_factory=dict)

    def __post_init__(self):
        if not self.generated_at:
            self.generated_at = datetime.now(timezone.utc).isoformat()

    def to_dict(self) -> dict[str, Any]:
        return {
            "device_id": self.device_id,
            "version": self.version,
            "generated_at": self.generated_at,
            "files": {k: v.to_dict() for k, v in self.files.items()},
        }

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), indent=2, ensure_ascii=False)

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> Manifest:
        files = {}
        for k, v in d.get("files", {}).items():
            files[k] = FileEntry.from_dict(v)
        return cls(
            device_id=d["device_id"],
            version=d.get("version", 1),
            generated_at=d.get("generated_at", ""),
            files=files,
        )

    @classmethod
    def from_json(cls, text: str) -> Manifest:
        return cls.from_dict(json.loads(text))


def file_sha256(path: Path) -> str:
    """计算文件 SHA-256 哈希。"""
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()
