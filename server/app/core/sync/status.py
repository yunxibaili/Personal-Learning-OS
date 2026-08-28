"""M7 Sync Engine: Status — 同步冲突的只读查询与用户裁决。

M7-005 冻结范围（方案 a）：
  - 冲突源：mindmap conflict artifacts（M7-004）与 vault/*.md.conflict
    副本（M7-007，方案 a 后缀隔离白名单）。status v1 只派生 mindmap 源；
    vault .conflict 副本列出属后续增量
  - 只读 + 唯一写动作 resolve；不做自动解决/智能合并/学习状态写入

边界：stdlib only；落盘统一走 transfer.write_file_atomic（与 Apply 同一规则）。
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import PurePosixPath
from typing import Any

from .transfer import is_syncable, read_file_bytes, write_file_atomic

MINDMAP_DIR = "mind_maps"
PREVIEW_CHARS = 600  # status 内联只读预览上限，避免 Compare 需要第二个端点


@dataclass(frozen=True)
class ConflictItem:
    """一个待用户裁决的 mindmap 冲突。"""

    path: str               # 主文件，如 mind_maps/math.mindmap.json
    kind: str = "mindmap"
    local_path: str = ""    # 本地版备份（.local.json）
    remote_path: str = ""   # 远端版副本（.remote.json），当前 Apply 不产生，预留只读展示
    local_updated_at: str = ""
    remote_updated_at: str = ""
    local_preview: str = ""
    remote_preview: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "path": self.path,
            "kind": self.kind,
            "local_path": self.local_path,
            "remote_path": self.remote_path,
            "local_updated_at": self.local_updated_at,
            "remote_updated_at": self.remote_updated_at,
            "local_preview": self.local_preview,
            "remote_preview": self.remote_preview,
        }


def _mtime_iso(p: os.PathLike | None) -> str:
    if p is None or not os.path.exists(p):
        return ""
    try:
        ts = os.stat(p).st_mtime
        return datetime.fromtimestamp(ts, tz=timezone.utc).strftime(
            "%Y-%m-%d %H:%M:%S")
    except OSError:
        return ""


def _preview(ws_path) -> str:
    try:
        text = ws_path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return ""
    one_line = " ".join(text.split())
    return one_line[:PREVIEW_CHARS] + ("…" if len(one_line) > PREVIEW_CHARS else "")


def find_conflicts(workspace) -> list[ConflictItem]:
    """扫描 mind_maps/ 目录，把 conflict artifact 派生成冲突列表。

    判定规则：存在 `<name>.mindmap.json` 主文件且同名 `.local.json` 备份同时存在，
    即一个未处理冲突（主=远端胜者，备份=被替换的本地版）。`.remote.json` 若存在
    则一并列入展示。
    """
    root = workspace / MINDMAP_DIR
    if not root.is_dir():
        return []

    items: list[ConflictItem] = []
    for backup in sorted(root.glob("*.local.json")):
        # 命名与 M7-004 Apply 一致：主文件 math.mindmap.json 的备份是
        # math.local.json（剥离 .mindmap.json 后接 .local.json）
        stem = backup.name[: -len(".local.json")]
        if not stem or "/" in stem or "\\" in stem:
            continue
        main_name = stem + ".mindmap.json"
        main = root / main_name
        if not main.is_file():
            # 备份存在但主文件已被处理/删除 → 不是活动冲突，留给 recovery 流程
            continue
        remote_sidecar = root / (stem + ".remote.json")

        rel_main = f"{MINDMAP_DIR}/{main_name}"
        if not is_syncable(rel_main):
            continue
        items.append(ConflictItem(
            path=rel_main,
            local_path=f"{MINDMAP_DIR}/{backup.name}",
            remote_path=(f"{MINDMAP_DIR}/{remote_sidecar.name}"
                         if remote_sidecar.is_file() else ""),
            local_updated_at=_mtime_iso(backup),
            remote_updated_at=_mtime_iso(main),
            local_preview=_preview(backup),
            remote_preview=_preview(main),
        ))
    return items


def resolve_conflict(workspace, path: str, resolution: str) -> tuple[bool, str]:
    """按用户裁决处理一个冲突。resolution ∈ {keep_local, keep_remote}。

    keep_local：本地备份内容原子覆盖主文件（选回自己的版本）
    keep_remote：主文件已是远端胜者，无需写入
    两者都删除全部 sidecar artifact（.local.json / .remote.json）——冲突关闭。

    返回 (ok, message)。路径不合法或名称不是目录内扫描派生的 pattern 一律拒绝。
    """
    if resolution not in ("keep_local", "keep_remote"):
        return False, f"unknown resolution: {resolution}"

    p = PurePosixPath(path)
    # 只接受 mind_maps/<x>.mindmap.json 形态；客户端提供的路径必须在白名单内且
    # 能在目录中反查到对应 artifact，不接受自由拼路径
    if (p.drive or p.is_absolute() or len(p.parts) != 2
            or p.parts[0] != MINDMAP_DIR
            or not p.parts[1].endswith(".mindmap.json")):
        return False, f"illegal conflict path: {path}"
    if not is_syncable(path):
        return False, f"path not syncable: {path}"

    stem = p.parts[1][: -len(".mindmap.json")]
    main = workspace / MINDMAP_DIR / p.parts[1]
    backup = workspace / MINDMAP_DIR / (stem + ".local.json")

    if resolution == "keep_local":
        if not backup.is_file():
            return False, "local backup missing"
        data = read_file_bytes(workspace, f"{MINDMAP_DIR}/{backup.name}")
        if data is None:
            return False, "local backup unreadable"
        if write_file_atomic(workspace, path, data) is None:
            return False, "write failed"

    # 清理 sidecar（含可能的 .remote.json）；清理失败不回滚裁决，报告即可
    removed = []
    errors = []
    for extra in (backup.name,
                  stem.replace(".mindmap.json", "") + ".remote.json"):
        target = workspace / MINDMAP_DIR / extra
        if target.is_file():
            try:
                target.unlink()
                removed.append(extra)
            except OSError as exc:
                errors.append(f"{extra}: {exc}")
    if errors:
        return True, f"resolved, but cleanup failed: {'; '.join(errors)}"
    return True, f"resolved ({resolution}), removed {len(removed)} artifact(s)"


__all__ = ["ConflictItem", "find_conflicts", "resolve_conflict"]
