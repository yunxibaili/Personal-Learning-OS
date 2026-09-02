/**
 * SuggestionList（B3.2 + B7.1）：AI 概念建议人工确认入口。
 *
 * 显示 unconfirmed 的 ai_suggested 概念，提供 Accept/Ignore 操作。
 * 挂载于 TutorPanel，因果关系：Conversation → Extractor → Suggestion。
 *
 * 约束：
 *   - 不新增 API（复用 GET/PATCH/DELETE /concepts）
 *   - 不修改 Graph/Universe 投影
 *   - 不处理 Extractor connects
 */
import { useCallback, useEffect, useState } from "react";
import { apiDelete, apiGet, apiPatch } from "../../lib/api";
import "./SuggestionList.css";

interface ConceptSuggestion {
  id: number;
  title: string;
  summary: string | null;
  origin: string;
  status: string;
  created_at: string;
}

interface Props {
  /** B7.1：对话后递增触发重新拉取 */
  refreshKey?: number;
}

export function SuggestionList({ refreshKey = 0 }: Props) {
  const [suggestions, setSuggestions] = useState<ConceptSuggestion[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSuggestions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<{ concepts: ConceptSuggestion[] }>(
        "/concepts?status=unconfirmed&origin=ai_suggested",
      );
      setSuggestions(data.concepts ?? []);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSuggestions();
  }, [fetchSuggestions, refreshKey]);

  const handleAccept = useCallback(async (id: number) => {
    try {
      await apiPatch(`/concepts/${id}`, { status: "active" });
      setSuggestions((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      // B7.1：记录错误但不阻断用户操作（主对话不受影响）
      console.error("Failed to accept suggestion:", e);
    }
  }, []);

  const handleIgnore = useCallback(async (id: number) => {
    try {
      await apiDelete(`/concepts/${id}`);
      setSuggestions((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      // B7.1：记录错误但不阻断用户操作
      console.error("Failed to ignore suggestion:", e);
    }
  }, []);

  if (suggestions.length === 0 && !loading) {
    return null;
  }

  return (
    <div className="suggestion-list">
      <div className="suggestion-header">
        <span className="suggestion-title">AI 建议</span>
        {suggestions.length > 0 && (
          <span className="suggestion-count">{suggestions.length}</span>
        )}
      </div>
      {loading && <div className="suggestion-loading">加载中…</div>}
      <ul className="suggestion-items">
        {suggestions.map((s) => (
          <li key={s.id} className="suggestion-item">
            <div className="suggestion-item-header">
              <span className="suggestion-item-title">{s.title}</span>
              <span className="suggestion-item-origin">来自 AI</span>
            </div>
            {s.summary && (
              <div className="suggestion-item-summary">{s.summary}</div>
            )}
            <div className="suggestion-item-actions">
              <button
                className="suggestion-accept-btn"
                onClick={() => void handleAccept(s.id)}
              >
                采纳
              </button>
              <button
                className="suggestion-ignore-btn"
                onClick={() => void handleIgnore(s.id)}
              >
                忽略
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
