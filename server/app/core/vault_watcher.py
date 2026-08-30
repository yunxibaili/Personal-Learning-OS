"""Vault Watcher（B16）：扫描 vault 变更 → 增量 reindex。

实现：**stdlib 轮询**（不引 watchguard/第三方）——后台守护线程周期扫 vault/*.md
的 mtime/size 快照，发现增/改/删则调用增量 reindex_vault。满足「vault 变 →
索引自动跟上」的闭环，避免手动 POST /admin/reindex。

纯逻辑部分（snapshot / diff / poll）分离出来便于单测；守护线程由 admin 端点控制。
"""
from __future__ import annotations

import logging
import threading
import time
from pathlib import Path

from . import reindex

logger = logging.getLogger(__name__)

DEFAULT_POLL_INTERVAL = 3.0  # 秒


def snapshot(vault: Path) -> dict[str, tuple[float, int]]:
    """扫描 vault 下所有 .md，返回 {相对路径: (mtime, size)}。"""
    if not vault.exists():
        return {}
    result: dict[str, tuple[float, int]] = {}
    for f in vault.rglob("*.md"):
        try:
            st = f.stat()
        except OSError:
            continue
        result[f.relative_to(vault).as_posix()] = (st.st_mtime, st.st_size)
    return result


def diff(prev: dict[str, tuple[float, int]],
         cur: dict[str, tuple[float, int]]) -> tuple[list[str], list[str]]:
    """比较两次快照：返回 (新增或修改的路径, 被删除的路径)。"""
    changed = [p for p, v in cur.items() if prev.get(p) != v]
    deleted = [p for p in prev if p not in cur]
    return changed, deleted


def poll(vault: Path, prev: dict[str, tuple[float, int]]
         ) -> tuple[dict[str, tuple[float, int]], list[str], list[str]]:
    """扫一次 + 与上次快照对比，返回 (新快照, changed, deleted)。"""
    cur = snapshot(vault)
    changed, deleted = diff(prev, cur)
    return cur, changed, deleted


class VaultWatcher:
    """后台轮询守护线程。start() 后每 interval 秒 poll 一次并增量 reindex。"""

    def __init__(self, vault: Path, interval: float = DEFAULT_POLL_INTERVAL) -> None:
        self.vault = vault
        self.interval = interval
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._snapshot: dict[str, tuple[float, int]] = {}
        self.last_poll_count = 0

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._stop.clear()
        self._snapshot = snapshot(self.vault)
        self._thread = threading.Thread(target=self._run, name="vault-watcher", daemon=True)
        self._thread.start()
        logger.info("vault watcher started: %s", self.vault)

    def stop(self) -> None:
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=2)
            self._thread = None
        logger.info("vault watcher stopped")

    @property
    def running(self) -> bool:
        return bool(self._thread and self._thread.is_alive())

    def _run(self) -> None:
        while not self._stop.is_set():
            try:
                from ..db import connect

                cur, changed, deleted = poll(self.vault, self._snapshot)
                if changed or deleted:
                    conn = connect()
                    try:
                        # deleted 路径对应文件已不在 → 增量 reindex 会删除相关 note
                        paths = sorted(set(changed) | set(deleted))
                        reindex.reindex_vault(conn, self.vault, changed_paths=paths)
                        conn.commit()
                    finally:
                        conn.close()
                    self.last_poll_count += 1
                    logger.info("vault change detected (%d paths) — reindexed", len(paths))
                self._snapshot = cur
            except Exception as exc:  # noqa: BLE001 — 守护线程不因单次异常退出
                logger.warning("vault watcher poll error: %s", exc)
            self._stop.wait(self.interval)


_watcher: VaultWatcher | None = None


def current_watcher(vault: Path | None = None) -> VaultWatcher | None:
    """获取进程级 watcher 单例（None 表示未启动）。"""
    return _watcher


def set_watcher(watcher: VaultWatcher | None) -> None:
    global _watcher
    _watcher = watcher


__all__ = ["snapshot", "diff", "poll", "VaultWatcher", "current_watcher", "set_watcher",
           "DEFAULT_POLL_INTERVAL"]
