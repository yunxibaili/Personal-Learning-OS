import { useEffect, useRef, useState } from "react";

import { apiGet } from "../../lib/api";
import { useUi, type ViewKey } from "../../stores/ui";
import type { SearchResponse } from "@shared/types/note";
import type { HomeResponse } from "@shared/types/home";

interface SyncStatusResponse {
  conflicts: Array<Record<string, unknown>>;  // /sync/status：冲突列表，空数组=无冲突
}

const OVERLAY_TITLES: Partial<Record<ViewKey, string>> = {
  graph: "知识图谱",
  universe: "知识星系",
  mindmap: "思维导图",
  tutor: "AI 导师",
  review: "复习",
  settings: "设置",
};

/**
 * TopBar（Phase 2 · ui/note-workspace + app-shell）：
 * 品牌 · 返回（浮层态）· 搜索（Ctrl+K）· 复习徽章（有才亮）· 同步状态。
 * 搜索/大纲/雷达一律不进编辑器工具栏（编辑器硬约束）。
 */
export function TopBar() {
  const activeView = useUi((s) => s.activeView);
  const setActiveView = useUi((s) => s.setActiveView);
  const openNote = useUi((s) => s.openNote);

  const [q, setQ] = useState("");
  const [results, setResults] = useState<Array<{ note_id: number; title: string }> | null>(null);
  const [reviewDue, setReviewDue] = useState(0);
  const [conflictCount, setConflictCount] = useState<number | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiGet<HomeResponse>("/home")
      .then((d) => setReviewDue(d.review_due))
      .catch(() => setReviewDue(0));
    apiGet<SyncStatusResponse>("/sync/status")
      .then((d) => setConflictCount(d.conflicts.length))
      .catch(() => setConflictCount(null));
  }, [activeView]);

  useEffect(() => {
    if (!q.trim()) { setResults(null); return; }
    const t = setTimeout(() => {
      apiGet<SearchResponse>(`/search?q=${encodeURIComponent(q)}`)
        .then((d) => setResults(d.results))
        .catch(() => setResults(null));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setResults(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const isOverlay = activeView !== "notes";

  return (
    <header className="topbar">
      <div className="topbar__left">
        {isOverlay ? (
          <button className="topbar__back" onClick={() => setActiveView("notes")}>← 返回笔记</button>
        ) : (
          <span className="topbar__brand">
            <span className="topbar__dot" aria-hidden="true" />
            Learning OS
          </span>
        )}
        {isOverlay && OVERLAY_TITLES[activeView] && (
          <span className="topbar__title">{OVERLAY_TITLES[activeView]}</span>
        )}
      </div>

      <div className="topbar__search" ref={boxRef}>
        <input
          className="topbar__search-input"
          placeholder="搜索笔记、概念…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="搜索"
        />
        {results && results.length > 0 && (
          <div className="topbar__search-results">
            {results.map((r) => (
              <button
                key={r.note_id}
                className="topbar__search-result"
                onClick={() => { openNote(r.note_id); setQ(""); setResults(null); }}
              >
                {r.title}
              </button>
            ))}
          </div>
        )}
        {results && results.length === 0 && q.trim() && (
          <div className="topbar__search-results">
            <div className="topbar__search-empty">没有匹配的笔记</div>
          </div>
        )}
      </div>

      <div className="topbar__right">
        <button
          className={`topbar__review ${reviewDue > 0 ? "topbar__review--due" : ""}`}
          onClick={() => setActiveView("review")}
          aria-label={reviewDue > 0 ? `今日待复习 ${reviewDue} 个` : "复习"}
        >
          复习{reviewDue > 0 ? ` ${reviewDue}` : ""}
        </button>
        <button
          className={`topbar__settings ${activeView === "settings" ? "topbar__settings--active" : ""}`}
          onClick={() => setActiveView("settings")}
          aria-current={activeView === "settings" ? "page" : undefined}
        >
          设置
        </button>
        <span
          className={`topbar__sync ${conflictCount ? "topbar__sync--conflict" : ""}`}
          title={conflictCount == null
            ? "同步状态未知"
            : conflictCount > 0 ? `${conflictCount} 个冲突待解决` : "无冲突 · 同步正常"}
        >
          ● {conflictCount == null ? "同步 ?" : conflictCount > 0 ? `${conflictCount} 冲突` : "已同步"}
        </span>
      </div>
    </header>
  );
}
