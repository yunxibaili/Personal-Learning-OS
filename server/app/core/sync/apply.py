"""M7 Sync Engine: Apply — 远端数据进入本地 workspace 的唯一写入口。

M7-004 冻结规则（docs/ai/ACTIVE_TASK.md）：
  Rule 1  Apply 是唯一写入口——transport 只交字节，落盘只经本模块
  Rule 2  双重校验——路径白名单复检 + 对收到的字节重算哈希（不信任 remote 声明）
  Rule 3  eventlogs/*.jsonl 追加合并，按 event_id 幂等去重，禁止 LWW/replace
  Rule 4  mind_maps/*.json LWW，冲突时保留双份（<name>.local.json 备份）

边界：
  - stdlib only（与 core/sync 其余模块一致）
  - 不读墙钟、不生成时间戳——同一输入重复 apply 结果必须一致（确定性）
  - 永不触达 SQLite / settings / metadata/devices.json（ADR-020 Layer 3）
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path, PurePosixPath
from typing import Any, Iterable

from .transfer import (
    is_syncable,
    write_file_atomic,
    validate_hash,
)


class ApplyAction(str, Enum):
    """单个文件的落盘结果类型。"""
    WRITTEN = "written"                # 直接写入（markdown 等）
    MERGED = "merged"                  # eventlog 追加合并
    CONFLICT_BACKUP = "conflict_backup"  # mindmap 冲突：远端为主，本地备份为 .local.json
    SKIPPED = "skipped"                # 内容相同或空计划
    REJECTED = "rejected"              # 校验失败（白名单/路径/哈希）


@dataclass
class ApplyItemResult:
    path: str
    action: ApplyAction
    success: bool
    message: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "path": self.path,
            "action": self.action.value,
            "success": self.success,
            "message": self.message,
        }


@dataclass
class SyncApplyResult:
    items: list[ApplyItemResult] = field(default_factory=list)

    @property
    def total(self) -> int:
        return len(self.items)

    @property
    def applied(self) -> int:
        return sum(1 for r in self.items if r.success)

    @property
    def rejected(self) -> int:
        return sum(1 for r in self.items if r.action == ApplyAction.REJECTED)

    def to_dict(self) -> dict[str, Any]:
        counts: dict[str, int] = {}
        for r in self.items:
            counts[r.action.value] = counts.get(r.action.value, 0) + 1
        return {
            "total": self.total,
            "applied": self.applied,
            "rejected": self.rejected,
            "actions": counts,
            "items": [r.to_dict() for r in self.items],
        }


_DRIVE_RE = re.compile(r"^[A-Za-z]:")


def validate_rel_path(rel_path: str) -> str | None:
    """规范化并校验相对路径。合法返回 POSIX 风格路径，非法返回 None。

    拒绝：绝对路径 · 盘符（含 PurePosixPath 识别不到的 `C:x` 形式）·
    .. 穿越 · 反斜杠分隔符 · 空段。
    """
    if not rel_path or "\\" in rel_path or _DRIVE_RE.match(rel_path):
        return None
    p = PurePosixPath(rel_path)
    if p.is_absolute() or p.drive or any(part in ("..", "") for part in p.parts):
        return None
    return p.as_posix()


def _is_eventlog(path: str) -> bool:
    return path.startswith("metadata/eventlogs/") and path.endswith(".jsonl")


def _is_mindmap(path: str) -> bool:
    return path.startswith("mind_maps/") and path.endswith(".mindmap.json")


def _dedupe_eventlog(local_text: str, remote_text: str) -> tuple[str, int]:
    """按 event_id 合并：local 全量保留 + remote 新增行（保持 remote 顺序）。

    返回 (merged_text, appended_lines)。缺 event_id 的行不参与去重，跳过不计。
    """
    seen: set[str] = set()
    kept_local = 0
    local_lines: list[str] = []
    for line in local_text.splitlines():
        s = line.strip()
        if not s:
            continue
        try:
            eid = json.loads(s).get("event_id")
        except json.JSONDecodeError:
            eid = None
        if isinstance(eid, str) and eid:
            seen.add(eid)
        local_lines.append(s)
        kept_local += 1

    appended = 0
    merged = list(local_lines)
    for line in remote_text.splitlines():
        s = line.strip()
        if not s:
            continue
        try:
            eid = json.loads(s).get("event_id")
        except json.JSONDecodeError:
            continue  # 无法识别的行不做去重，拒绝合入
        if not (isinstance(eid, str) and eid) or eid in seen:
            continue
        seen.add(eid)
        merged.append(s)
        appended += 1

    return ("\n".join(merged) + "\n") if merged else "", appended


class SyncApply:
    """同步落盘器。用法：

        applyer = SyncApply()
        result = applyer.apply_file(ws, "vault/a.md", b"...", expected_hash=sha)
    """

    def apply_many(
        self,
        workspace: Path,
        files: Iterable[tuple[str, bytes]],
        *,
        expected_hashes: dict[str, str] | None = None,
    ) -> SyncApplyResult:
        hashes = expected_hashes or {}
        result = SyncApplyResult()
        for path, data in files:
            result.items.append(
                self.apply_file(workspace, path, data, expected_hash=hashes.get(path, ""))
            )
        return result

    def apply_file(
        self,
        workspace: Path,
        rel_path: str,
        data: bytes,
        *,
        expected_hash: str = "",
    ) -> ApplyItemResult:
        """把一份远端文件字节安全落入本地 workspace。

        统一闸门顺序（Rule 2）：路径规范化 → 白名单复检 → 哈希重算 → 分类落盘。
        """
        # 1. 路径校验（穿越/绝对路径/盘符）
        normalized = validate_rel_path(rel_path)
        if normalized is None:
            return ApplyItemResult(rel_path, ApplyAction.REJECTED, False,
                                   "illegal path")

        # 2. 同步白名单复检（不信任 plan 上游的判断）
        if not is_syncable(normalized):
            return ApplyItemResult(normalized, ApplyAction.REJECTED, False,
                                   f"path not syncable: {normalized}")

        # 3. 字节级哈希重算（Rule 2 加强版：remote 声明不作数）
        if not validate_hash(data, expected_hash):
            return ApplyItemResult(normalized, ApplyAction.REJECTED, False,
                                   "hash mismatch")

        # 4. 分类落盘
        if _is_eventlog(normalized):
            return self._apply_events(workspace, normalized, data)
        if _is_mindmap(normalized):
            return self._apply_mindmap(workspace, normalized, data)
        return self._apply_lww(workspace, normalized, data)

    # ── Markdown 及其他普通文件：LWW 原子替换 ──────────────────────

    def _apply_lww(self, workspace: Path, path: str, data: bytes) -> ApplyItemResult:
        target = workspace / path
        if target.exists() and target.read_bytes() == data:
            return ApplyItemResult(path, ApplyAction.SKIPPED, True, "identical")
        if write_file_atomic(workspace, path, data) is None:
            return ApplyItemResult(path, ApplyAction.REJECTED, False, "write failed")
        return ApplyItemResult(path, ApplyAction.WRITTEN, True,
                               f"wrote {len(data)} bytes")

    # ── eventlogs：追加合并（Rule 3，禁 replace）──────────────────

    def _apply_events(self, workspace: Path, path: str, data: bytes) -> ApplyItemResult:
        target = workspace / path
        local_text = ""
        if target.exists():
            try:
                local_text = target.read_text(encoding="utf-8")
            except OSError:
                return ApplyItemResult(path, ApplyAction.REJECTED, False,
                                       "unreadable local eventlog")

        remote_text = data.decode("utf-8", errors="strict")
        merged_text, appended = _dedupe_eventlog(local_text, remote_text)

        if appended == 0:
            return ApplyItemResult(path, ApplyAction.MERGED, True,
                                   "no new events")
        # 注意：写回的是「local ∪ remote」整体，而非追加远程原文——
        # 保证已有损坏行修复后重放一致（确定性优先于增量写性能）。
        if write_file_atomic(workspace, path, merged_text.encode("utf-8")) is None:
            return ApplyItemResult(path, ApplyAction.REJECTED, False, "write failed")
        return ApplyItemResult(path, ApplyAction.MERGED, True,
                               f"appended {appended} events")

    # ── mindmap：LWW + 本地冲突备份（Rule 4，ADR-019 用户空间）─────

    def _apply_mindmap(self, workspace: Path, path: str, data: bytes) -> ApplyItemResult:
        target = workspace / path
        local_bytes: bytes | None = None
        if target.exists():
            local_bytes = target.read_bytes()

        if local_bytes == data:
            return ApplyItemResult(path, ApplyAction.SKIPPED, True, "identical")

        had_conflict = local_bytes is not None
        if had_conflict:
            backup_name = path[:-len(".mindmap.json")] + ".local.json"
            backup_path = workspace / "mind_maps" / Path(backup_name).name
            if not backup_path.exists():
                # 首次冲突才备份；已存在的备份代表更早的分叉点，不可覆盖
                if write_file_atomic(workspace,
                                     f"mind_maps/{backup_path.name}",
                                     local_bytes) is None:
                    return ApplyItemResult(path, ApplyAction.REJECTED, False,
                                           "backup write failed")

        if write_file_atomic(workspace, path, data) is None:
            return ApplyItemResult(path, ApplyAction.REJECTED, False, "write failed")
        return ApplyItemResult(path, ApplyAction.CONFLICT_BACKUP if had_conflict
                               else ApplyAction.WRITTEN, True,
                               "remote wins, local backed up"
                               if had_conflict else f"wrote {len(data)} bytes")


__all__ = [
    "SyncApply",
    "SyncApplyResult",
    "ApplyItemResult",
    "ApplyAction",
    "validate_rel_path",
]
