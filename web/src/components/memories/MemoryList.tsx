/**
 * MemoryList（B28）：AI 自动写入记忆的人工兜底入口。
 *
 * 与 SuggestionList（B3.2，AI 概念建议）对称挂载于 TutorPanel——
 * 两者都是 Extractor 产物的人工确认面：概念走 Accept/Ignore，记忆走编辑/删除。
 *
 * 存在理由：B3 Extractor 自动写 memories，用户看不见就删不掉。
 * 「用户数据永不锁死」在记忆这块必须落到 UI，否则只是 API 层成立。
 *
 * 约束（PROJECT_STATE §0 规则二：新 API 的最小接线）：
 *   - 只做「调得通、结果可见」：列表 + 改内容 + 删除
 *   - 不做样式打磨、不做交互打磨、不做空状态设计
 *   - 不新增入口（无 tab、无路由），挂载在既有 TutorPanel 内
 */
import { useCallback, useEffect, useState } from "react";
import { apiDelete, apiGet, apiPatch } from "../../lib/api";
import type { MemoryAdmin, MemoryListResponse } from "@shared/types/memory";
import "./MemoryList.css";

interface Props {
  /** 对话后递增触发重新拉取（/chat → Extractor → 可能新增记忆） */
  refreshKey?: number;
}

const KIND_LABELS: Record<string, string> = {
  fact: "Fact",
  preference: "Preference",
  goal: "Goal",
  mistake_pattern: "Mistake pattern",
};

export function MemoryList({ refreshKey = 0 }: Props) {
  const [memories, setMemories] = useState<MemoryAdmin[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 编辑态：同时只有一条处于编辑（editingId 为 null 表示无）
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchMemories = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<MemoryListResponse>("/memories?limit=50");
      setMemories(data.memories ?? []);
    } catch {
      setMemories([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchMemories();
  }, [fetchMemories, refreshKey]);

  const startEdit = useCallback((m: MemoryAdmin) => {
    setError("");
    setEditingId(m.id);
    setDraft(m.content);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setDraft("");
    setError("");
  }, []);

  const saveEdit = useCallback(
    async (id: number) => {
      const content = draft.trim();
      if (!content) {
        setError("Content cannot be empty");
        return;
      }
      setSaving(true);
      setError("");
      try {
        const updated = await apiPatch<MemoryAdmin>(`/memories/${id}`, { content });
        setMemories((prev) => prev.map((m) => (m.id === id ? updated : m)));
        setEditingId(null);
        setDraft("");
      } catch (e) {
        // 409 = 改写后与既有记忆前缀重复；400 = 校验失败
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setSaving(false);
      }
    },
    [draft],
  );

  const remove = useCallback(async (id: number) => {
    setError("");
    try {
      await apiDelete(`/memories/${id}`);
      setMemories((prev) => prev.filter((m) => m.id !== id));
      if (editingId === id) cancelEdit();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [editingId, cancelEdit]);

  if (memories.length === 0 && !loading) {
    return null;
  }

  return (
    <div className="memory-list">
      <div className="memory-header">
        <span className="memory-title">Memories</span>
        {memories.length > 0 && (
          <span className="memory-count">{memories.length}</span>
        )}
      </div>

      {loading && <div className="memory-loading">Loading...</div>}

      <ul className="memory-items">
        {memories.map((m) => (
          <li key={m.id} className="memory-item">
            <div className="memory-item-header">
              <span className="memory-kind">{KIND_LABELS[m.kind] ?? m.kind}</span>
              <span className="memory-importance">
                {Math.round(m.importance * 100)}%
              </span>
            </div>

            {editingId === m.id ? (
              <div className="memory-edit">
                <textarea
                  className="memory-textarea"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={3}
                />
                <div className="memory-item-actions">
                  <button
                    className="memory-save-btn"
                    onClick={() => void saveEdit(m.id)}
                    disabled={saving}
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                  <button className="memory-cancel-btn" onClick={cancelEdit}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="memory-content">{m.content}</div>
                <div className="memory-item-actions">
                  <button
                    className="memory-edit-btn"
                    onClick={() => startEdit(m)}
                  >
                    Edit
                  </button>
                  <button
                    className="memory-delete-btn"
                    onClick={() => void remove(m.id)}
                  >
                    Delete
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>

      {error && <div className="memory-error">{error}</div>}
    </div>
  );
}
