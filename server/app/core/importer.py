"""Import 核心（B19）：外部 Markdown 目录 → vault 导入。

Obsidian / Notion / 任意 Markdown 目录本质上都是一组 `.md` 文件——
本模块把用户指定的本地目录（或单文件）导入到 vault，保留相对目录结构，
逐篇写入文件 + 更新 SQLite 索引（复用 knowledge 层原语）。

设计约束：
  - 只读外部源，只写 vault（导入 = 复制真相，不改源）
  - 目录结构保留在 vault 的 <prefix>/ 下，避免覆盖已有同名笔记
  - 逐篇独立：imported | duplicate | io_error，部分成功不阻断
  - 纯逻辑层，不 import FastAPI

BUG-1（2026-08-31）：导入源若含 concepts.json（本项目导出包的解压产物），
则复制到 workspace metadata/ 下——后续 admin/reindex 会消费它恢复概念与
掌握度（导出→重建闭环的最后一块）。
"""
from __future__ import annotations

import shutil
import time
from pathlib import Path

from . import knowledge as K


def _stage_concepts_snapshot(source: Path, base: Path) -> bool:
    """把导入源中的 concepts.json 复制到 workspace metadata/（BUG-1）。

    识别位置（两处，均为顶层）：
      - base/concepts.json：source 目录顶层
      - base.parent/concepts.json：导出包解压后用户指向其 vault/ 子目录的场景
        （concepts.json 与 vault/ 同级——本项目 /export 的包布局）
    返回是否发生了复制。
    """
    candidates = [base / "concepts.json"]
    if base.parent != base:
        candidates.append(base.parent / "concepts.json")
    candidate = next((c for c in candidates if c.is_file()), None)
    if candidate is None:
        return False
    try:
        import json
        data = json.loads(candidate.read_text(encoding="utf-8"))
        if not isinstance(data, dict) or not isinstance(data.get("concepts"), list):
            return False  # 不是本项目快照格式，忽略（外部 md 目录常见同名文件防御）
    except (OSError, ValueError):
        return False
    from ..db import workspace_root
    meta = workspace_root() / "metadata"
    meta.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(candidate, meta / "concepts.json")
    return True


def import_markdown(conn, source: Path, prefix: str = "imported") -> dict:
    """扫描 source（文件或目录）下的 .md，写入 vault 并索引。

    Returns:
        {
          "imported": int, "skipped": int,
          "concepts_snapshot_staged": bool,       # BUG-1：快照是否被暂存
          "files": [{"rel", "title", "status"}]   # status: imported|duplicate|io_error
        }
    """
    if source.is_file():
        base = source.parent
        files = [source]
    elif source.is_dir():
        base = source
        files = sorted(source.rglob("*.md"))
    else:
        return {"imported": 0, "skipped": 0, "concepts_snapshot_staged": False,
                "files": [], "error": f"source not found: {source}"}

    snapshot_staged = _stage_concepts_snapshot(source, base)

    imported = skipped = 0
    out: list[dict] = []
    for f in files:
        rel = f.relative_to(base).as_posix()
        # 规范化目标相对路径（vault 内），防穿越
        vault_rel = (Path(prefix) / rel).as_posix()
        if ".." in Path(vault_rel).parts:
            skipped += 1
            out.append({"rel": rel, "title": f.stem, "status": "io_error"})
            continue
        title = f.stem
        try:
            content = f.read_text(encoding="utf-8")
        except OSError:
            skipped += 1
            out.append({"rel": rel, "title": title, "status": "io_error"})
            continue
        status = _import_one(conn, vault_rel, title, content)
        if status == "imported":
            imported += 1
        else:
            skipped += 1
        out.append({"rel": rel, "title": title, "status": status})

    return {"imported": imported, "skipped": skipped,
            "concepts_snapshot_staged": snapshot_staged, "files": out}


def _import_one(conn, vault_rel: str, title: str, content: str) -> str:
    """把单篇写入 vault（<prefix>/<rel>）并索引，重复则跳过。

    Returns: imported | duplicate | io_error
    """
    if conn.execute("SELECT 1 FROM notes WHERE path=?", (vault_rel,)).fetchone():
        return "duplicate"
    target = K.vault_root() / vault_rel
    if target.exists():
        return "duplicate"

    cur = conn.execute(
        "INSERT INTO notes (path, title, tags_json, content_hash) "
        "VALUES (?, ?, '[]', '')",
        (vault_rel, title),
    )
    note_id = cur.lastrowid
    try:
        target.parent.mkdir(parents=True, exist_ok=True)
        K.atomic_write_file(target, K.compose_file({}, content))
        mtime = time.time()
        _, _, body_text = K.parse_frontmatter(target.read_text(encoding="utf-8"))
        K.upsert_note_index(conn, note_id=note_id, path=vault_rel, title=title,
                            tags=[], body=body_text, mtime=mtime)
        K.promote_stub_to_note(conn, note_id, title)
        K.rebuild_note_links(conn, note_id, body_text)
        conn.commit()
    except OSError:
        conn.rollback()
        return "io_error"
    return "imported"


__all__ = ["import_markdown", "_stage_concepts_snapshot"]
