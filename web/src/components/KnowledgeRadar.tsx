import { useCallback, useEffect, useState } from "react";

import { apiGet } from "../lib/api";
import type {
  SuggestionResponse,
} from "@shared/types/suggest";

/**
 * Knowledge Radar 组件（M3.5-A，ADR-012）。
 * 接收查询词，debounce 调用 /knowledge/suggest，渲染三区域。
 */
interface Props {
  query: string;
  noteId: number | null;
  onOpenNote: (id: number) => void;
}

export function KnowledgeRadar({ query, noteId, onOpenNote }: Props) {
  const [resp, setResp] = useState<SuggestionResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResp(null);
      return;
    }
    setLoading(true);
    try {
      const qs = new URLSearchParams({ q, limit: "5" });
      if (noteId) qs.set("note_id", String(noteId));
      const data = await apiGet<SuggestionResponse>(
        `/knowledge/suggest?${qs.toString()}`,
      );
      setResp(data);
    } catch {
      setResp(null);
    } finally {
      setLoading(false);
    }
  }, [noteId]);

  // debounce 500ms
  useEffect(() => {
    if (!query.trim()) {
      setResp(null);
      return;
    }
    const t = setTimeout(() => void fetchSuggestions(query), 500);
    return () => clearTimeout(t);
  }, [query, fetchSuggestions]);

  const matches = resp?.matches ?? [];
  const related = resp?.related ?? [];
  const hasData = matches.length > 0 || related.length > 0;

  if (!query.trim()) {
    return (
      <div className="radar-empty">
        <span className="muted">输入关键词或选中文本以触发知识雷达</span>
      </div>
    );
  }

  return (
    <div className="radar-content">
      {loading && <div className="radar-loading">搜索中…</div>}

      {!loading && !hasData && (
        <div className="radar-empty">
          <span className="muted">未找到相关知识</span>
        </div>
      )}

      {matches.length > 0 && (
        <div className="radar-section">
          <div className="radar-section-title">📘 匹配</div>
          {matches.map((m) => (
            <button
              key={`${m.type}-${m.id}`}
              className="radar-match"
              onClick={() => {
                if (m.type === "note") onOpenNote(m.id);
              }}
            >
              <span className="radar-match-title">{m.title}</span>
              <span className="radar-match-type">{m.type === "note" ? "笔记" : "概念"}</span>
            </button>
          ))}
        </div>
      )}

      {related.length > 0 && (
        <div className="radar-section">
          <div className="radar-section-title">🔗 相关概念</div>
          {related.map((r) => (
            <span key={r.title} className="radar-related-tag">
              {r.title}
            </span>
          ))}
        </div>
      )}

      <div className="radar-section">
        <div className="radar-section-title">🧠 学习状态</div>
        <span className="radar-memory-null muted">
          暂无数据（M3.5-B 接入）
        </span>
      </div>
    </div>
  );
}
