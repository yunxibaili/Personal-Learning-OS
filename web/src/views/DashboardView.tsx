import { useCallback, useEffect, useState } from "react";

import { apiGet, apiPost } from "../lib/api";
import { SyncStatusPanel } from "../components/sync/SyncStatusPanel";
import { KnowledgePlanet } from "../components/planet/KnowledgePlanet";
import type {
  MasteryDetail,
  MasteryListResponse,
  ReviewTodayResponse,
  ReviewItem,
  AnswerResponse,
} from "@shared/types/mastery";

interface HistoryEvent {
  id: number;
  concept_id: number;
  title: string;
  event_type: string;
  source: string;
  created_at: string;
}

/**
 * DashboardView（M5 版）：
 * 今日复习 + 掌握度排行 + 学习时间线。
 * 禁止：知识宇宙视觉 / 动画 / 复杂统计（属 M3b）。
 */
export function DashboardView() {
  const [mastery, setMastery] = useState<MasteryDetail[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [history, setHistory] = useState<HistoryEvent[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const m = await apiGet<MasteryListResponse>("/mastery");
      setMastery(m.mastery);
      const r = await apiGet<ReviewTodayResponse>("/review/today");
      setReviews(r.reviews);
      const h = await apiGet<{ history: HistoryEvent[] }>("/review/history?limit=15");
      setHistory(h.history);
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
    eff >= 0.7 ? "var(--ok)" : eff >= 0.4 ? "var(--brand)" : "var(--err)";

  const eventLabel = (type: string) => {
    const labels: Record<string, string> = {
      answer_correct: "答对",
      answer_wrong: "答错",
      explain: "讲解",
      review: "复习",
      visualize: "可视化",
      code_run: "代码",
    };
    return labels[type] || type;
  };

  const sourceLabel = (src: string) => {
    const labels: Record<string, string> = {
      manual: "手动",
      review: "复习",
      tutor: "Tutor",
      code_trace: "代码",
      exam: "考试",
    };
    return labels[src] || src;
  };

  return (
    <section className="dashboard-view">
      {error && <div className="error-banner">{error}</div>}

      <SyncStatusPanel />

      <KnowledgePlanet />

      <div className="dash-section">
        <h3>今日复习（{reviews.length}）</h3>
        {reviews.length === 0 && <p className="muted">暂无待复习概念</p>}
        {reviews.map((r) => (
          <div key={r.concept_id} className="review-card">
            <span className="review-title">{r.title}</span>
            <span className="review-due">
              {r.last_result === "wrong" ? "上次答错" : ""}
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
        <h3>掌握度排行</h3>
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

      <div className="dash-section">
        <h3>学习时间线</h3>
        {history.length === 0 && <p className="muted">暂无学习记录</p>}
        <div className="timeline">
          {history.map((ev) => (
            <div key={ev.id} className="timeline-item">
              <span className="timeline-dot" />
              <div className="timeline-content">
                <span className="timeline-event">{eventLabel(ev.event_type)}</span>
                <span className="timeline-title">{ev.title}</span>
                <span className="timeline-source">{sourceLabel(ev.source)}</span>
                <span className="timeline-time">
                  {new Date(ev.created_at + "Z").toLocaleString("zh-CN")}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
