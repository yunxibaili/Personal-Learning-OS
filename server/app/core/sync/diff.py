"""M7 Sync Engine: Diff — 对比两个设备的 Manifest，生成 SyncPlan。

ADR-005/020 冻结：
  - 同步只复制事实，不产生学习行为
  - SQLite 永不同步
  - 冲突保留双份 + 用户手动合并
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any

from .manifest import Manifest


class Action(str, Enum):
    """同步动作类型。"""
    UPLOAD = "upload"       # 本设备有，对方没有 → 上传
    DOWNLOAD = "download"   # 对方有，本设备没有 → 下载
    CONFLICT = "conflict"   # 双方都有修改 → 冲突
    SKIP = "skip"           # 相同或不需要同步 → 跳过


@dataclass(frozen=True)
class SyncItem:
    """单个文件的同步决策。"""
    path: str
    action: Action
    local_hash: str | None = None
    remote_hash: str | None = None
    reason: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "path": self.path,
            "action": self.action.value,
            "local_hash": self.local_hash,
            "remote_hash": self.remote_hash,
            "reason": self.reason,
        }


@dataclass
class SyncPlan:
    """同步计划：两个 Manifest 的差异对比结果。

    结构：
      {
        "local_device": "device-a",
        "remote_device": "device-b",
        "items": [
          { "path": "vault/ml.md", "action": "upload", ... },
          { "path": "mind_maps/p.json", "action": "download", ... },
          { "path": "vault/python.md", "action": "conflict", ... }
        ],
        "summary": {
          "upload": 2,
          "download": 1,
          "conflict": 0,
          "skip": 10
        }
      }
    """
    local_device: str
    remote_device: str
    items: list[SyncItem] = field(default_factory=list)

    @property
    def summary(self) -> dict[str, int]:
        counts = {a.value: 0 for a in Action}
        for item in self.items:
            counts[item.action.value] += 1
        return counts

    @property
    def has_conflicts(self) -> bool:
        return any(i.action == Action.CONFLICT for i in self.items)

    def to_dict(self) -> dict[str, Any]:
        return {
            "local_device": self.local_device,
            "remote_device": self.remote_device,
            "items": [i.to_dict() for i in self.items],
            "summary": self.summary,
        }

    def get_items_by_action(self, action: Action) -> list[SyncItem]:
        return [i for i in self.items if i.action == action]


def diff_manifests(
    local: Manifest,
    remote: Manifest,
    *,
    conflict_on_both_modified: bool = True,
) -> SyncPlan:
    """对比两个设备的 Manifest，生成 SyncPlan。

    对比逻辑（ADR-020）：
      1. 本地有，远程没有 → UPLOAD
      2. 远程有，本地没有 → DOWNLOAD
      3. 双方都有，哈希相同 → SKIP
      4. 双方都有，哈希不同 → CONFLICT（v1: 保留双份）

    Args:
        local: 本设备的 Manifest
        remote: 远程设备的 Manifest
        conflict_on_both_modified: True=双方修改视为冲突，False=last-write-wins
    """
    plan = SyncPlan(
        local_device=local.device_id,
        remote_device=remote.device_id,
    )

    all_paths = set(local.files.keys()) | set(remote.files.keys())

    for path in sorted(all_paths):
        local_entry = local.files.get(path)
        remote_entry = remote.files.get(path)

        if local_entry and not remote_entry:
            # 本设备有，远程没有 → 上传
            plan.items.append(SyncItem(
                path=path,
                action=Action.UPLOAD,
                local_hash=local_entry.sha256,
                reason="local only",
            ))

        elif remote_entry and not local_entry:
            # 远程有，本设备没有 → 下载
            plan.items.append(SyncItem(
                path=path,
                action=Action.DOWNLOAD,
                remote_hash=remote_entry.sha256,
                reason="remote only",
            ))

        elif local_entry.sha256 == remote_entry.sha256:
            # 双方相同 → 跳过
            plan.items.append(SyncItem(
                path=path,
                action=Action.SKIP,
                local_hash=local_entry.sha256,
                remote_hash=remote_entry.sha256,
                reason="identical",
            ))

        else:
            # 双方都有，但不同 → 冲突
            if conflict_on_both_modified:
                plan.items.append(SyncItem(
                    path=path,
                    action=Action.CONFLICT,
                    local_hash=local_entry.sha256,
                    remote_hash=remote_entry.sha256,
                    reason="both modified",
                ))
            else:
                # last-write-wins（v1 MindMap 策略）
                if local_entry.mtime >= remote_entry.mtime:
                    plan.items.append(SyncItem(
                        path=path,
                        action=Action.UPLOAD,
                        local_hash=local_entry.sha256,
                        remote_hash=remote_entry.sha256,
                        reason="local newer (LWW)",
                    ))
                else:
                    plan.items.append(SyncItem(
                        path=path,
                        action=Action.DOWNLOAD,
                        local_hash=local_entry.sha256,
                        remote_hash=remote_entry.sha256,
                        reason="remote newer (LWW)",
                    ))

    return plan
