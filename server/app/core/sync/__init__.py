"""M7 Sync Engine Core — 纯 Core，无网络。

ADR-005/020 冻结：
  - 同步只发生在 Layer 1（Truth Source）
  - vault/*.md + eventlogs/*.jsonl + mind_maps/*.mindmap.json
  - SQLite / settings / API keys 永不同步

模块：
  manifest: FileEntry + Manifest 数据结构
  scanner: 扫描 workspace 生成 Manifest
  diff: 对比两个 Manifest → SyncPlan
"""
from .manifest import FileEntry, Manifest, file_sha256
from .scanner import scan_workspace
from .diff import Action, SyncItem, SyncPlan, diff_manifests

__all__ = [
    "FileEntry",
    "Manifest",
    "file_sha256",
    "scan_workspace",
    "Action",
    "SyncItem",
    "SyncPlan",
    "diff_manifests",
]
