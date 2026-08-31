/**
 * ReviewSessionView（P8-003A）：SM-2 复习流程 MVP。
 *
 * 不是 Quiz，不是考试。是记忆强度反馈。
 *
 * 状态机：
 *   idle → loading → ready → answering → feedback → ready/done
 *
 * 数据流：
 *   GET /review/today → ReviewItem[]
 *   POST /review/{id}/answer { quality } → AnswerResponse
 *
 * 不修改后端、不新增 API、不引入新依赖。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { apiGet, apiPost } from "../lib/api";
import { useUi } from "../stores/ui";
import type {
  AnswerResponse,
  ReviewItem,
  ReviewTodayResponse,
} from "@shared/types/mastery";

type Phase = "idle" | "loading" | "ready" | "answering" | "feedback" | "done";

/** 质量评分 → 按钮配置 */
const QUALITY_OPTIONS = [
  { quality: 1, label: "忘记了", icon: "😵", desc: "完全不记得" },
  { quality: 3, label: "有点模糊", icon: "🤔", desc: "想了一会儿" },
  { quality: 5, label: "记得很清楚", icon: "✨", desc: "立刻想起" },
] as const;

/** mastery 变化箭头 */
function masteryArrow(before: number, after: number): string {
  const diff = after - before;
  if (Math.abs(diff) < 0.005) return "";
  return diff > 0 ? "↑" : "↓";
}

/** mastery 变化颜色 */
function masteryColor(before: number, after: number): string {
  const diff = after - before;
  if (Math.abs(diff) < 0.005) return "var(--text-secondary)";
  return diff > 0 ? "var(--ok, #4a9)" : "var(--err, #c44)";
}

export function ReviewSessionView() {
  const submitAnswerRef = useRef<((q: number) => void) | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [queue, setQueue] = useState<ReviewItem[]>([]);
  const [index, setIndex] = useState(0);
  const [lastResult, setLastResult] = useState<AnswerResponse | null>(null);
  const [prevEffective, setPrevEffective] = useState(0);
  const [error, setError] = useState("");
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [sessionTotal, setSessionTotal] = useState(0);

  const current = useMemo(
    () => (index < queue.length ? queue[index] : null),
    [queue, index],
  );
  const setActiveView = useUi((s) => s.setActiveView);
  const openTutor = useUi((s) => s.openTutor);
  // P8-006：最近一次评分（feedback 阶段判断 quality≤2）
  const [lastQuality, setLastQuality] = useState<number | null>(null);

  const remaining = queue.length - index;

  // 键盘驱动（Phase 3 ②·spec：1–3 打分 / Space 翻面 / Esc 退出）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setActiveView("notes"); return; }
      if (phase === "ready" || phase === "answering") {
        if (e.key === "1") void submitAnswerRef.current?.(1);
        if (e.key === "2") void submitAnswerRef.current?.(3);
        if (e.key === "3") void submitAnswerRef.current?.(5);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, setActiveView]);

  const startSession = useCallback(async () => {
    setPhase("loading");
    setError("");
    try {
      const resp = await apiGet<ReviewTodayResponse>("/review/today");
      if (resp.reviews.length === 0) {
        setPhase("done");
        setQueue([]);
        return;
      }
      setQueue(resp.reviews);
      setIndex(0);
      setSessionCorrect(0);
      setSessionTotal(0);
      setPhase("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("idle");
    }
  }, []);

  const submitAnswer = useCallback(async (quality: number) => {
    if (!current) return;
    setPhase("answering");
    setError("");
    setLastQuality(quality); // P8-006：feedback 按此决定是否提供 Tutor hint 入口
    try {
      setPrevEffective(current.effective ?? 0);
      const resp = await apiPost<AnswerResponse>(
        `/review/${current.concept_id}/answer`,
        { quality },
      );
      setLastResult(resp);
      setSessionTotal((t) => t + 1);
      if (quality >= 3) setSessionCorrect((c) => c + 1);
      setPhase("feedback");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("ready");
    }
  }, [current]);
  submitAnswerRef.current = (q: number) => void submitAnswer(q);

  const goNext = useCallback(() => {
    if (index + 1 >= queue.length) {
      setPhase("done");
    } else {
      setIndex((i) => i + 1);
      setLastResult(null);
      setPhase("ready");
    }
  }, [index, queue.length]);

  // ── Idle: 开始复习 ──────────────────────────────────────
  if (phase === "idle") {
    return (
      <section className="review-session">
        <div className="review-session-idle">
          <h2>复习</h2>
          <p className="muted">SM-2 间隔重复 · 记忆强度反馈</p>
          <button className="review-start-btn" onClick={startSession}>
            开始复习
          </button>
        </div>
        {error && <div className="error-banner">{error}</div>}
      </section>
    );
  }

  // ── Loading ─────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <section className="review-session">
        <div className="review-session-loading">加载中...</div>
      </section>
    );
  }

  // ── Done: 完成统计 ──────────────────────────────────────
  if (phase === "done" || !current) {
    return (
      <section className="review-session">
        <div className="review-session-done">
          <h2>复习完成</h2>
          {sessionTotal > 0 ? (
            <>
              <p>
                复习了 <strong>{sessionTotal}</strong> 个概念
              </p>
              {sessionCorrect > 0 && (
                <p>
                  记忆保持 <strong>{sessionCorrect}/{sessionTotal}</strong>
                </p>
              )}
            </>
          ) : (
            <p className="muted">暂无待复习概念</p>
          )}
          <button className="review-start-btn" onClick={startSession}>
            {sessionTotal > 0 ? "再次复习" : "开始复习"}
          </button>
        </div>
      </section>
    );
  }

  // ── Ready / Answering / Feedback: 显示当前概念 ──────────
  return (
    <section className="review-session">
      {error && <div className="error-banner">{error}</div>}

      {/* 进度条 */}
      <div className="review-progress">
        <span>
          {index + 1} / {queue.length}
        </span>
        <div className="review-progress-bar">
          <div
            className="review-progress-fill"
            style={{ width: `${((index + 1) / queue.length) * 100}%` }}
          />
        </div>
      </div>

      {/* 概念卡片 */}
      {current && (
        <div className="review-card-main">
          <h3 className="review-concept-title">{current.title}</h3>

          {/* Mastery 信息 */}
          <div className="review-mastery-info">
            <div className="review-mastery-row">
              <span className="review-mastery-label">掌握度</span>
              <span className="review-mastery-value">
                {Math.round((current.effective ?? 0) * 100)}%
              </span>
            </div>
            {current.last_result && (
              <div className="review-mastery-row">
                <span className="review-mastery-label">上次</span>
                <span className="review-mastery-value">
                  {current.last_result === "wrong" ? "答错" : "答对"}
                </span>
              </div>
            )}
          </div>

          {/* Feedback 状态 */}
          {phase === "feedback" && lastResult && (
            <div className="review-feedback">
              <div className="review-feedback-change">
                <span>
                  掌握度{" "}
                  {Math.round(prevEffective * 100)}%
                </span>
                <span style={{ margin: "0 6px" }}>→</span>
                <span
                  style={{
                    color: masteryColor(prevEffective, lastResult.mastery.effective),
                    fontWeight: 600,
                  }}
                >
                  {Math.round(lastResult.mastery.effective * 100)}%
                  {masteryArrow(prevEffective, lastResult.mastery.effective)}
                </span>
              </div>
              <div className="review-feedback-next">
                下次复习：{lastResult.interval} 天后
              </div>
              {/* P8-006 入口②：Review 错答/模糊（quality≤2）→ Tutor Hint。
                  seed 带 concept_id；关闭 Tutor 后经 tutorReturnView 回到本视图。 */}
              {lastQuality != null && lastQuality <= 2 && current && (
                <button
                  className="review-tutor-btn"
                  onClick={() => openTutor({ conceptId: current.concept_id, mode: "hint" })}
                >
                  向 Tutor 求提示（{current.title}）
                </button>
              )}
            </div>
          )}

          {/* 评分按钮 */}
          {phase === "ready" && (
            <div className="review-actions-main">
              <p className="review-kbd-hint">按 1 / 2 / 3 评分 · Esc 退出</p>
              {QUALITY_OPTIONS.map((opt, i) => (
                <button
                  key={opt.quality}
                  className="review-quality-btn"
                  onClick={() => submitAnswer(opt.quality)}
                >
                  <kbd className="review-kbd">{i + 1}</kbd>
                  <span className="review-quality-icon">{opt.icon}</span>
                  <span className="review-quality-label">{opt.label}</span>
                  <span className="review-quality-desc">{opt.desc}</span>
                </button>
              ))}
            </div>
          )}

          {/* 继续按钮 */}
          {phase === "feedback" && (
            <button className="review-continue-btn" onClick={goNext}>
              {index + 1 >= queue.length ? "完成" : "继续"}
            </button>
          )}

          {/* Answering 加载态 */}
          {phase === "answering" && (
            <div className="review-submitting">提交中...</div>
          )}
        </div>
      )}

      {/* 剩余数量 */}
      <div className="review-remaining">
        还剩 {remaining - 1} 个
      </div>
    </section>
  );
}
