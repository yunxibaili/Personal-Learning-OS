"""文档变更抽象层：Revision / Snapshot / Diff（ADR-028）。

本模块是「与 Git 解耦的文档变更抽象层」的 Core 实现，不是 Git 客户端：
不调用 git CLI、不实现 branch / commit / merge / rebase / stash / cherry-pick。

## 为什么快照落文件系统而不落 SQLite

`AGENTS.md §3` 多端可见性铁律 + ADR-005：SQLite 在任何设备上都只是**可重建的本地缓存**，
db 永不参与同步。`EXPORT_DIRS`（core/export.py）与 `SYNC_PATTERNS`（core/sync/manifest.py）
两处白名单都只收 workspace/ 下的文件。快照若落表，就既不进导出包、也不参与多端同步，
直接违反「用户数据永不锁死」红线。故：

    workspace/metadata/revisions/<vault 相对路径>/<YYYYmmddTHHMMSSZ>-<hash8>.md

## 为什么目录不在 vault/ 下

`reindex.py` 用 `vault_root.rglob("*.md")` 递归扫描且无隐藏目录豁免 —— 快照放在 vault/
下会被当成正式笔记吞进索引，并触发 vault_watcher 的 reindex 风暴。

## 为什么目录键用路径而非 note_id

`note_id` 是 SQLite 自增主键，db 不同步（ADR-005），跨设备不保证一致。故目录键 =
vault 相对路径（含 `.md`，镜像 vault 目录结构，天然支持 `importer` 产生的嵌套路径）。
重命名时由 `rename_revision_dir()` 迁移。

## 快照文件即合法 Markdown

内容 = `compose_file({**笔记原 frontmatter, **rev_* 元数据}, body)`。
`rev_` 前缀命名空间避免与用户 frontmatter key 冲突；去掉 `rev_*` 后即可
`compose_file(note_meta, body)` 原样还原笔记文件。

`rev_note_path` 记录的是**快照创建时**的路径，不随重命名回改 —— 修订记录应当记录历史，
而非当前状态。

纯逻辑层：不 import FastAPI，可被 pytest 直接测试（separation.md §一）。
"""
from __future__ import annotations

import hashlib
import logging
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from difflib import SequenceMatcher, unified_diff
from pathlib import Path

from ..db import workspace_root
from .knowledge import atomic_write_file, compose_file, parse_frontmatter, resolve_vault_file
from .timeutil import now_iso

logger = logging.getLogger(__name__)

# ── 常量 ──────────────────────────────────────────────────────────

REVISIONS_SUBDIR = "metadata/revisions"

#: 受支持的 revision source。Git adapter 是后续独立任务，此处**不**占位。
REVISION_SOURCES = ("current", "snapshot")

#: `current` 虚拟 revision 的 ref 常量。
CURRENT_REF = "current"

#: 写前去抖窗口（秒）：距上次快照不足该间隔则跳过，防 autosave 风暴。
DEFAULT_MIN_INTERVAL_SECONDS = 300.0

#: 单篇笔记保留的快照上限（超出按时间序淘汰最旧）。
MAX_SNAPSHOTS_PER_NOTE = 50

#: 快照文件名时间戳格式（含微秒，定宽 → 字典序 == 时间序）。
#: 秒级精度不够：同一秒内可能产生多份快照（auto + manual），届时按 hash8
#: 字典序排序会让"最新"失真——实测踩过。
_TS_FORMAT = "%Y%m%dT%H%M%S%f"

#: 快照 frontmatter 元数据键（全部 rev_ 前缀，避免与用户 key 冲突）。
#: 术语区分：`source` = revision source（current/snapshot，抽象层轴）；
#: `origin` = 快照触发方式（auto/manual），与 concepts.origin 用词一致。
_REV_KEYS = (
    "rev_id", "rev_origin", "rev_hash", "rev_prev_hash",
    "rev_created_at", "rev_note_path",
)


# ── 路径解析 ──────────────────────────────────────────────────────

def revisions_root() -> Path:
    """快照根目录；不存在则创建。"""
    root = workspace_root() / "metadata" / "revisions"
    root.mkdir(parents=True, exist_ok=True)
    return root


def revision_dir(rel_path: str) -> Path | None:
    """vault 相对路径 → 快照目录；越界/非法返回 None。

    目录键 = 完整相对路径（含 `.md`），镜像 vault 目录结构：
    `imported/sub/note.md` → `<root>/imported/sub/note.md/`。
    以完整路径（而非去扩展名）作目录可彻底排除 `a/b.md` 与 `a/b/c.md` 的歧义。
    """
    if not rel_path or rel_path.startswith(("/", "\\")) or "\\" in rel_path:
        return None
    root = revisions_root()
    try:
        target = (root / rel_path).resolve()
    except (OSError, ValueError):
        return None
    root_resolved = root.resolve()
    if target == root_resolved or not str(target).startswith(str(root_resolved) + os.sep):
        return None
    return target


# ── 数据结构 ──────────────────────────────────────────────────────

@dataclass(frozen=True)
class Revision:
    """一个可读版本（current 或 snapshot）。"""
    source: str
    ref: str
    created_at: str
    content_hash: str
    content_md: str
    note_meta: dict  # 去掉 rev_* 后的笔记原 frontmatter

    def summary(self) -> dict:
        return {
            "source": self.source,
            "ref": self.ref,
            "created_at": self.created_at,
            "content_hash": self.content_hash,
            "size": len(self.content_md.encode("utf-8")),
        }

    def detail(self) -> dict:
        d = self.summary()
        d["content_md"] = self.content_md
        d["note_meta"] = dict(self.note_meta)
        return d


@dataclass(frozen=True)
class SnapshotMeta:
    """快照元数据（不含正文）。

    `origin` 是**触发方式**，不是 revision source ——
    快照的 revision source 恒为 `snapshot`，由调用方在响应里补。
    取值：`auto`（PATCH 写前去抖）| `manual`（显式打点）| `restore`（恢复前
    对被覆盖状态的留存，保证恢复本身可逆）。
    """
    rev_id: str
    origin: str          # auto | manual | restore
    content_hash: str
    prev_hash: str
    created_at: str
    note_path: str
    size: int

    def to_dict(self) -> dict:
        return {
            "rev_id": self.rev_id,
            "origin": self.origin,
            "content_hash": self.content_hash,
            "prev_hash": self.prev_hash,
            "created_at": self.created_at,
            "note_path": self.note_path,
            "size": self.size,
        }


# ── 内部读写 ──────────────────────────────────────────────────────

def _body_hash(body: str) -> str:
    return hashlib.sha256(body.encode("utf-8")).hexdigest()


def _snapshot_files(rel_path: str) -> list[Path]:
    """该笔记的全部快照文件，按时间序升序（文件名定宽时间戳 → 字典序即时间序）。"""
    d = revision_dir(rel_path)
    if d is None or not d.is_dir():
        return []
    return sorted(p for p in d.glob("*.md") if p.is_file())


def _read_snapshot_file(path: Path) -> tuple[SnapshotMeta, dict, str] | None:
    """读一个快照文件 → (meta, 笔记原 frontmatter, body)。坏文件返回 None。"""
    try:
        raw = path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return None
    meta, _, body = parse_frontmatter(raw)

    def _s(key: str) -> str:
        return str(meta.get(key, "") or "")

    note_meta = {k: v for k, v in meta.items() if k not in _REV_KEYS}
    snap = SnapshotMeta(
        rev_id=_s("rev_id") or path.stem,
        origin=_s("rev_origin") or "auto",
        content_hash=_s("rev_hash") or _body_hash(body),
        prev_hash=_s("rev_prev_hash"),
        created_at=_s("rev_created_at"),
        note_path=_s("rev_note_path"),
        size=len(body.encode("utf-8")),
    )
    return snap, note_meta, body


# ── 快照写入 ──────────────────────────────────────────────────────

def create_snapshot(
    rel_path: str,
    note_meta: dict,
    body: str,
    *,
    origin: str = "auto",
) -> SnapshotMeta | None:
    """打一份快照。**内容未变则返回 None**（哈希去重，零新增 schema）。

    `note_meta` 为笔记原 frontmatter（不含 rev_*），与 rev_* 元数据合并后写入，
    保证快照可无损还原为原笔记文件。
    """
    d = revision_dir(rel_path)
    if d is None:
        return None

    content_hash = _body_hash(body)

    # 内容去重：与最新一份相同则不打
    files = _snapshot_files(rel_path)
    prev_hash = ""
    if files:
        last = _read_snapshot_file(files[-1])
        if last is not None:
            prev_hash = last[0].content_hash
            if prev_hash == content_hash:
                return None

    ts = datetime.now(timezone.utc).strftime(_TS_FORMAT)
    rev_id = f"{ts}-{content_hash[:8]}"

    snap_meta = {
        "rev_id": rev_id,
        "rev_origin": origin,
        "rev_hash": content_hash,
        "rev_prev_hash": prev_hash,
        "rev_created_at": now_iso(),
        "rev_note_path": rel_path,
    }
    merged = {**dict(note_meta or {}), **snap_meta}

    d.mkdir(parents=True, exist_ok=True)
    atomic_write_file(d / f"{rev_id}.md", compose_file(merged, body))
    prune_revisions(rel_path)

    return SnapshotMeta(
        rev_id=rev_id,
        origin=origin,
        content_hash=content_hash,
        prev_hash=prev_hash,
        created_at=snap_meta["rev_created_at"],
        note_path=rel_path,
        size=len(body.encode("utf-8")),
    )


def maybe_snapshot(
    rel_path: str,
    note_meta: dict,
    body: str,
    *,
    origin: str = "auto",
    min_interval: float = DEFAULT_MIN_INTERVAL_SECONDS,
) -> SnapshotMeta | None:
    """写前去抖快照：快照的是**即将被覆盖的旧内容**，须在写入新内容前调用。

    双重去抖（决策 B）：
      1. 内容哈希与最新快照相同 → 跳过；
      2. 距最新快照不足 `min_interval` 秒 → 跳过（防 autosave 风暴）。

    快照失败**不得**阻断笔记保存 —— vault 是唯一事实源，保存优先。
    故本函数的调用方应捕获异常（routers/notes.py 已包 try/except）。
    """
    files = _snapshot_files(rel_path)
    if files:
        last = _read_snapshot_file(files[-1])
        if last is not None:
            if last[0].content_hash == _body_hash(body):
                return None
            try:
                age = datetime.now(timezone.utc).timestamp() - files[-1].stat().st_mtime
            except OSError:
                age = min_interval  # stat 失败 → 视为可打
            if age < min_interval:
                return None
    return create_snapshot(rel_path, note_meta, body, origin=origin)


def prune_revisions(rel_path: str, keep: int = MAX_SNAPSHOTS_PER_NOTE) -> int:
    """按时间序淘汰最旧快照，只保留最近 `keep` 份。返回删除数量。"""
    if keep <= 0:
        return 0
    files = _snapshot_files(rel_path)
    excess = files[:-keep] if len(files) > keep else []
    removed = 0
    for f in excess:
        try:
            f.unlink()
            removed += 1
        except OSError:
            logger.warning("prune_revisions: 删除失败 %s", f, exc_info=True)
    return removed


def purge_revisions(rel_path: str) -> int:
    """清空该笔记的全部快照（显式清理端点用）。返回删除数量。"""
    d = revision_dir(rel_path)
    if d is None or not d.is_dir():
        return 0
    removed = 0
    for f in _snapshot_files(rel_path):
        try:
            f.unlink()
            removed += 1
        except OSError:
            logger.warning("purge_revisions: 删除失败 %s", f, exc_info=True)
    # 只删空目录，非空（有子目录残留）时保留，避免误删
    try:
        if not any(d.iterdir()):
            d.rmdir()
    except OSError:
        pass
    return removed


# ── 重命名 / 迁移 ─────────────────────────────────────────────────

def rename_revision_dir(old_rel: str, new_rel: str) -> bool:
    """笔记重命名时迁移快照目录（决策 D）。

    目标已存在时返回 False 且不覆盖 —— 重命名冲突在 notes.py 更早的阶段已被
    duplicate_title 拦截，此处属防御性兜底。
    """
    old_d = revision_dir(old_rel)
    new_d = revision_dir(new_rel)
    if old_d is None or new_d is None:
        return False
    if not old_d.is_dir() or new_d.exists():
        return False
    try:
        new_d.parent.mkdir(parents=True, exist_ok=True)
        old_d.rename(new_d)
    except OSError:
        logger.warning("rename_revision_dir 失败: %s → %s", old_rel, new_rel,
                       exc_info=True)
        return False
    return True


# ── 读取 ──────────────────────────────────────────────────────────

def list_snapshots(rel_path: str, *, limit: int | None = None) -> list[SnapshotMeta]:
    """快照列表，**时间倒序**（最新在前）。"""
    files = _snapshot_files(rel_path)
    out: list[SnapshotMeta] = []
    for f in reversed(files):
        got = _read_snapshot_file(f)
        if got is not None:
            out.append(got[0])
    if limit is not None and limit >= 0:
        out = out[:limit]
    return out


def list_orphan_paths() -> list[dict]:
    """孤儿快照目录：`metadata/revisions/` 下存在、但 `notes` 表已无对应行。

    决策 D「删除保留」的直接后果——快照还在，笔记没了。本函数给出可恢复清单；
    重建走 `routers/revisions.py` 的 `POST /admin/revisions/restore`。

    判定以 **notes 行**为准（文件在但索引缺失属 reindex 范畴，不算孤儿）。
    返回按路径排序：`[{path, snapshot_count, latest_rev_id, latest_created_at}]`。
    """
    from ..db import connect  # 局部导入避免循环（db 不依赖本模块）

    root = revisions_root()
    if not root.is_dir():
        return []
    dirs: set[Path] = set()
    for f in root.rglob("*.md"):
        if f.is_file():
            dirs.add(f.parent)
    if not dirs:
        return []

    conn = connect()
    try:
        out: list[dict] = []
        for d in sorted(dirs):
            rel = d.relative_to(root).as_posix()
            if conn.execute("SELECT 1 FROM notes WHERE path=?", (rel,)).fetchone():
                continue
            snaps = list_snapshots(rel)
            if not snaps:
                continue
            latest = snaps[0]
            out.append({
                "path": rel,
                "snapshot_count": len(snaps),
                "latest_rev_id": latest.rev_id,
                "latest_created_at": latest.created_at,
            })
        return out
    finally:
        conn.close()


def latest_snapshot(rel_path: str) -> SnapshotMeta | None:
    """最新一份快照；无则 None。"""
    files = _snapshot_files(rel_path)
    if not files:
        return None
    got = _read_snapshot_file(files[-1])
    return got[0] if got else None


def read_snapshot(rel_path: str, rev_id: str) -> tuple[SnapshotMeta, dict, str] | None:
    """按 rev_id 读快照 → (meta, 笔记原 frontmatter, body)。"""
    d = revision_dir(rel_path)
    if d is None or not rev_id or "/" in rev_id or "\\" in rev_id or rev_id.startswith("."):
        return None
    f = d / f"{rev_id}.md"
    if not f.is_file():
        return None
    return _read_snapshot_file(f)


def read_current(rel_path: str) -> Revision | None:
    """读 `current` source：直接读 vault 文件（唯一事实源，A027/ADR-001）。"""
    try:
        p = resolve_vault_file(rel_path)
    except ValueError:
        return None
    if not p.is_file():
        return None
    try:
        raw = p.read_text(encoding="utf-8")
        mtime = p.stat().st_mtime
    except OSError:
        return None
    meta, _, body = parse_frontmatter(raw)
    note_meta = {k: v for k, v in meta.items() if k not in _REV_KEYS}
    return Revision(
        source="current",
        ref=CURRENT_REF,
        created_at=datetime.fromtimestamp(mtime, tz=timezone.utc).strftime(
            "%Y-%m-%d %H:%M:%S"),
        content_hash=_body_hash(body),
        content_md=body,
        note_meta=note_meta,
    )


def resolve_revision(
    rel_path: str,
    source: str,
    ref: str | None = None,
) -> Revision | None:
    """按 (source, ref) 解析出一个可读版本。

    - `current`：ref 忽略；
    - `snapshot`：ref 为 rev_id，None/空表示取最新一份。

    source 非法或目标不存在 → None。
    """
    if source == "current":
        return read_current(rel_path)
    if source != "snapshot":
        return None

    if ref in (None, "", "latest"):
        snap = latest_snapshot(rel_path)
        target_ref = snap.rev_id if snap else None
    else:
        target_ref = ref
        snap = None

    got = read_snapshot(rel_path, target_ref) if target_ref else None
    if got is None:
        return None
    meta, note_meta, body = got
    return Revision(
        source="snapshot",
        ref=meta.rev_id,
        created_at=meta.created_at,
        content_hash=meta.content_hash,
        content_md=body,
        note_meta=note_meta,
    )


# ── Diff ──────────────────────────────────────────────────────────

def diff_texts(
    old: str,
    new: str,
    *,
    from_label: str = "from",
    to_label: str = "to",
) -> dict:
    """两段文本的行级 diff。

    返回：
      {
        "stats":   {"added": int, "removed": int, "changed": int},
        "hunks":   [{"op": equal|insert|delete|replace,
                     "old_start": int, "old_end": int,   # 0-based，左闭右开
                     "new_start": int, "new_end": int}],
        "unified": str   # 供人读/导出的 unified diff 文本
      }

    `hunks` **只含非 equal 段** —— 前端做块级高亮只需要变化区间。

    ⚠️ `autojunk=False` 是必需的：`SequenceMatcher` 默认启发式会把出现频次
    >1% 的行（b 长度 ≥200 时）判为 junk 并排除，对文本 diff 会产生错误结果。
    """
    old_lines = old.splitlines()
    new_lines = new.splitlines()

    matcher = SequenceMatcher(None, old_lines, new_lines, autojunk=False)
    opcodes = matcher.get_opcodes()

    stats = {"added": 0, "removed": 0, "changed": 0}
    hunks: list[dict] = []
    for op, i1, i2, j1, j2 in opcodes:
        if op == "equal":
            continue
        hunks.append({
            "op": op,
            "old_start": i1, "old_end": i2,
            "new_start": j1, "new_end": j2,
        })
        old_n, new_n = i2 - i1, j2 - j1
        if op == "insert":
            stats["added"] += new_n
        elif op == "delete":
            stats["removed"] += old_n
        elif op == "replace":
            common = min(old_n, new_n)
            stats["changed"] += common
            stats["removed"] += old_n - common
            stats["added"] += new_n - common

    unified = "\n".join(
        unified_diff(old_lines, new_lines,
                     fromfile=from_label, tofile=to_label, lineterm="")
    )
    return {"stats": stats, "hunks": hunks, "unified": unified}


__all__ = [
    "REVISIONS_SUBDIR", "REVISION_SOURCES", "CURRENT_REF",
    "DEFAULT_MIN_INTERVAL_SECONDS", "MAX_SNAPSHOTS_PER_NOTE",
    "Revision", "SnapshotMeta",
    "revisions_root", "revision_dir",
    "create_snapshot", "maybe_snapshot", "prune_revisions", "purge_revisions",
    "rename_revision_dir",
    "list_snapshots", "latest_snapshot", "read_snapshot",
    "read_current", "resolve_revision", "list_orphan_paths",
    "diff_texts",
]
