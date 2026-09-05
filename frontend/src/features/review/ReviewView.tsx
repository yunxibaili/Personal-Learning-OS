import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../../api/client";
import {
  getReviewHistory,
  getReviewStats,
  getTodayQueue,
  submitAnswer,
  type AnswerResult,
  type ReviewHistoryItem,
  type ReviewQueueItem,
  type ReviewStats,
} from "../../api/review";

// MVP-05：最小 Review Consumer（ADR-029 §8 第 5 项）。
// 今日队列（后端排序，不重排）→ 每项 quality 0–6 六按钮提交 → 展示后端返回的
// SM-2 结果 → 刷新队列（重排期概念自然离队）。统计/历史原样消费。
// 无轮询、无卡片流、无 Tutor/AI/memory/模型选择；SM-2 判断逻辑不进前端（L1）。

const QUALITIES = [0, 1, 2, 3, 4, 5] as const;

type SectionState<T> =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "done"; data: T }
  | { kind: "error"; message: string };

function errText(e: unknown): string {
  return e instanceof ApiError ? `${e.status} ${e.code}: ${e.message}` : String(e);
}

interface LastResult {
  title: string;
  quality: number;
  result: AnswerResult;
}

export default function ReviewView() {
  const [queue, setQueue] = useState<SectionState<ReviewQueueItem[]>>({ kind: "loading" });
  const [stats, setStats] = useState<SectionState<ReviewStats>>({ kind: "loading" });
  const [history, setHistory] = useState<SectionState<ReviewHistoryItem[]>>({ kind: "loading" });
  const [submitting, setSubmitting] = useState<number | null>(null);
  const [answerError, setAnswerError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<LastResult | null>(null);

  const reloadAll = useCallback(async () => {
    const jobs: Promise<void>[] = [
      getTodayQueue()
        .then((items) => setQueue({ kind: "done", data: items }))
        .catch((e: unknown) => setQueue({ kind: "error", message: errText(e) })),
      getReviewStats()
        .then((data) => setStats({ kind: "done", data }))
        .catch((e: unknown) => setStats({ kind: "error", message: errText(e) })),
      getReviewHistory()
        .then((data) => setHistory({ kind: "done", data }))
        .catch((e: unknown) => setHistory({ kind: "error", message: errText(e) })),
    ];
    await Promise.all(jobs);
  }, []);

  useEffect(() => {
    reloadAll();
  }, [reloadAll]);

  async function answer(conceptId: number, title: string, quality: number) {
    if (submitting !== null) return;
    setSubmitting(conceptId);
    setAnswerError(null);
    try {
      const result = await submitAnswer(conceptId, quality);
      setLastResult({ title, quality, result });
      // 重排期概念离开今日队列；统计/历史随之变化，一并刷新（非轮询）
      await reloadAll();
    } catch (e) {
      setAnswerError(`${title}（quality ${quality}）提交失败：${errText(e)}`);
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="review-layout">
      <section>
        <h2>今日队列</h2>
        {lastResult !== null && (
          <p className="answer-result">
            {lastResult.title}（quality {lastResult.quality}）已排期：next_review{" "}
            {lastResult.result.next_review} · interval {lastResult.result.interval} 天 ·
            ease_factor {lastResult.result.ease_factor}
          </p>
        )}
        {answerError !== null && <p className="state-error">{answerError}</p>}
        {queue.kind === "loading" && <p className="state-loading">加载中…</p>}
        {queue.kind === "error" && <p className="state-error">队列加载失败：{queue.message}</p>}
        {queue.kind === "done" &&
          (queue.data.length === 0 ? (
            <p className="state-empty">今日无到期复习。</p>
          ) : (
            <ul className="review-queue">
              {queue.data.map((item) => (
                <li key={item.concept_id} className="review-item">
                  <div className="review-item-head">
                    <strong>{item.title}</strong>
                    <span className="review-meta">
                      due {item.due_at} · 当前掌握度 {item.effective_now}
                      {item.last_result !== null && ` · 上次 ${item.last_result === "wrong" ? "答错" : "答对"}`}
                    </span>
                  </div>
                  <div className="quality-row">
                    {QUALITIES.map((q) => (
                      <button
                        key={q}
                        type="button"
                        disabled={submitting !== null}
                        onClick={() => answer(item.concept_id, item.title, q)}
                      >
                        {q}
                      </button>
                    ))}
                    <span className="review-meta">= quality（0 完全忘记 … 5 完美）</span>
                  </div>
                </li>
              ))}
            </ul>
          ))}
      </section>

      <section>
        <h2>复习统计</h2>
        {stats.kind === "loading" && <p className="state-loading">加载中…</p>}
        {stats.kind === "error" && <p className="state-error">统计加载失败：{stats.message}</p>}
        {stats.kind === "done" && (
          <>
            <p className="stats-line">
              共 {stats.data.total_reviews} 次 · 正确 {stats.data.correct} · 错误{" "}
              {stats.data.wrong} · 正确率 {stats.data.accuracy} · 当前连对{" "}
              {stats.data.current_streak}
            </p>
            {stats.data.by_concept.length > 0 && (
              <table className="mastery-table">
                <thead>
                  <tr>
                    <th>概念</th>
                    <th>次数</th>
                    <th>正确</th>
                    <th>错误</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.data.by_concept.map((b) => (
                    <tr key={b.concept_id}>
                      <td>{b.title}</td>
                      <td>{b.count}</td>
                      <td>{b.correct}</td>
                      <td>{b.wrong}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </section>

      <section>
        <h2>复习历史</h2>
        {history.kind === "loading" && <p className="state-loading">加载中…</p>}
        {history.kind === "error" && <p className="state-error">历史加载失败：{history.message}</p>}
        {history.kind === "done" &&
          (history.data.length === 0 ? (
            <p className="state-empty">还没有复习记录。</p>
          ) : (
            <ul className="review-history">
              {history.data.map((h) => (
                <li key={h.id}>
                  <span className={h.event_type === "answer_correct" ? "ok" : "bad"}>
                    {h.event_type === "answer_correct" ? "答对" : "答错"}
                  </span>
                  {h.title} · {h.created_at}
                </li>
              ))}
            </ul>
          ))}
      </section>
    </div>
  );
}
