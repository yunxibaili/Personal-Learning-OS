import { useCallback, useEffect, useState } from "react";

import { apiGet, apiPost } from "../lib/api";
import type {
  MasteryDetail,
  MasteryListResponse,
  ReviewTodayResponse,
  ReviewItem,
  AnswerResponse,
} from "@shared/types/mastery";

/**
 * DashboardView（M3 最小化版）：
 * 今日复习 + 掌握度排行 + 薄弱概念。
 * 禁止：知识宇宙视觉 / 动画 / 复杂统计（属 M3b）。
 */
export function DashboardView() {
  const [mastery, setMastery] = useState<MasteryDetail[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const m = await apiGet<MasteryListResponse>("/mastery");
      setMastery(m.mastery);
      const r = await apiGet<ReviewTodayResponse>("/review/today");
      setReviews(r.reviews);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const submitAnswer = useCallback(async (conceptId: number, quality: number) => {
    try {
      await apiPost<AnswerResponse>(`/review/${conceptId}/answer`, { quality });
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [load]);

  const barColor = (eff: number) =>
    eff >= 0.7 ? "var(--ok)" : eff >= 0.4 ? "#e6a817" : "var(--err)";

  return (
    <section className="dashboard-view">
      {error && <div className="error-banner">{error}</div>}

      <div className="dash-section">
        <h3>📋 今日复习（{reviews.length}）</h3>
        {reviews.length === 0 && <p className="muted">暂无待复习概念</p>}
        {reviews.map((r) => (
          <div key={r.concept_id} className="review-card">
            <span className="review-title">{r.title}</span>
            <span className="review-due">
              {r.last_result === "wrong" ? "❌ 上次答错" : ""}
            </span>
            <div className="review-actions">
              <button onClick={() => void submitAnswer(r.concept_id, 1)}>忘了</button>
              <button onClick={() => void submitAnswer(r.concept_id, 3)}>勉强</button>
              <button onClick={() => void submitAnswer(r.concept_id, 5)}>完美</button>
            </div>
          </div>
        ))}
      </div>

      <div className="dash-section">
        <h3>📊 掌握度排行</h3>
        {mastery.length === 0 && <p className="muted">暂无掌握度数据</p>}
        {mastery.map((m) => (
          <div key={m.concept_id} className="mastery-row">
            <span className="mastery-title">{m.title}</span>
            <div className="mastery-bar-wrap">
              <div
                className="mastery-bar"
                style={{
                  width: `${Math.round(m.effective * 100)}%`,
                  background: barColor(m.effective),
                }}
              />
            </div>
            <span className="mastery-pct">{Math.round(m.effective * 100)}%</span>
          </div>
        ))}
      </div>
    </section>
  );
}
