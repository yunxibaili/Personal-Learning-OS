/**
 * VisualizeOverlay（M9-007 · ADR-025 核心链路的 web 端业务壳）
 *
 * 职责（仅此四件，不做扩展）：
 *   1. 按概念标题匹配示例清单（GET /trace/examples，调用方传入匹配结果）
 *   2. 取示例源码（GET /trace/examples/{id}）并执行受信任示例（POST /trace/run）
 *   3. TraceRun 成功返回后渲染 ui 库 <VisualEngine>
 *   4. 「点击即记录」visualize 学习事件（POST /events，§6.3）——
 *      在本层触发一次（ref 去重，StrictMode 双挂载安全），失败静默
 *      （辅助学习信号不影响主功能，AGENTS §12 错误隔离）
 *
 * 不做：示例选择器（V1 一个概念至多一个示例）、历史记录、M9.5 VTA。
 */
import { useCallback, useEffect, useRef, useState } from "react";

import type {
  ExampleDetail,
  TraceRun,
} from "@shared/types/trace";
import { VisualEngine, Skeleton } from "../ui";
import type { ExampleDefinition } from "../ui";
import { apiGet, apiPost, ApiError } from "../../lib/api";

interface Props {
  conceptId: number;
  /** 示例清单匹配结果（GraphView 按 concept_title 过滤后传入） */
  exampleId: string;
  /** 本次打开的唯一键（GraphView 点击时生成）——StrictMode 双实例据此去重事件 */
  openKey: string;
  onClose: () => void;
}

type Phase =
  | { kind: "loading" }
  | { kind: "error"; code: string; message: string }
  | { kind: "ready"; example: ExampleDefinition; run: TraceRun };

const ERR_TEXT: Record<string, string> = {
  trace_busy: "已有另一个可视化在执行，请稍后再试",
  unknown_example: "示例不存在（清单可能已更新），请刷新图谱后重试",
};

/**
 * 模块级 inflight 去重：同一 exampleId 的取数+执行只发一次请求。
 * 背景：StrictMode 双挂载会让 effect 跑两次，两次 POST /trace/run 会撞上
 * 服务端并发护栏（§5.7，第二发 429 trace_busy）——去重必须在请求发起层。
 */
const inflight = new Map<string, Promise<{ example: ExampleDefinition; run: TraceRun }>>();
const visualizedKeys = new Set<string>();

function loadTrace(exampleId: string): Promise<{ example: ExampleDefinition; run: TraceRun }> {
  const existing = inflight.get(exampleId);
  if (existing) return existing;
  const p = (async () => {
    // 源码与轨迹分开取（ADR-025 §3.2：源码是静态资产，不随每帧回传）
    const detail = await apiGet<ExampleDetail>(`/trace/examples/${encodeURIComponent(exampleId)}`);
    const run = await apiPost<TraceRun>("/trace/run", { example_id: exampleId });
    return {
      example: {
        example_id: detail.example_id,
        title: detail.title,
        concept_title: detail.concept_title,
        template: detail.template,
        file: detail.file,
        source: detail.source,
      },
      run,
    } as const;
  })().finally(() => inflight.delete(exampleId));
  inflight.set(exampleId, p);
  return p;
}

export function VisualizeOverlay({ conceptId, exampleId, openKey, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });

  useEffect(() => {
    let alive = true;
    setPhase({ kind: "loading" });
    loadTrace(exampleId)
      .then((data) => {
        if (alive) setPhase({ kind: "ready", ...data });
      })
      .catch((e: unknown) => {
        if (!alive) return;
        const code = e instanceof ApiError ? e.code : "network_error";
        const message = e instanceof Error ? e.message : String(e);
        setPhase({ kind: "error", code, message });
      });
    return () => {
      alive = false;
    };
  }, [exampleId]);

  // 「点击即记录」：ready 渲染即记录一次（§6.3 不等待播放完成）。
  // 每次用户点击 = 一次记录（新 openKey）；模块级 Set 只去重同一次打开的
  // StrictMode 双实例（两个实例共享同一 openKey）。
  const visualizedRef = useRef(false);
  useEffect(() => {
    if (phase.kind !== "ready" || visualizedRef.current) return;
    visualizedRef.current = true;
    if (visualizedKeys.has(openKey)) return;
    visualizedKeys.add(openKey);
    apiPost("/events", {
      concept_id: conceptId,
      event_type: "visualize",
      source: "visual_engine",
    }).catch(() => {
      // 辅助学习信号失败静默：不影响可视化主功能
    });
  }, [phase, conceptId, openKey]);

  const handleStepChange = useCallback(() => {}, []);

  return (
    <div
      className="visualize-overlay"
      role="dialog"
      aria-label={`算法可视化 · ${exampleId}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section className="visualize-panel">
        <button
          type="button"
          className="visualize-panel__close"
          aria-label="关闭可视化"
          onClick={onClose}
        >
          ×
        </button>
        {phase.kind === "loading" && (
          <div className="visualize-panel__loading" role="status">
            <span className="sr-only">正在执行示例并采集轨迹…</span>
            <Skeleton height={28} width={280} />
            <div className="visualize-panel__loading-grid">
              <Skeleton variant="rect" height={380} />
              <Skeleton variant="rect" height={380} />
            </div>
          </div>
        )}
        {phase.kind === "error" && (
          <div className="visualize-panel__error" role="alert">
            <strong>可视化启动失败</strong>
            <span>{ERR_TEXT[phase.code] ?? phase.message}</span>
            <code className="visualize-panel__errcode">{phase.code}</code>
          </div>
        )}
        {phase.kind === "ready" && (
          <VisualEngine
            example={phase.example}
            run={phase.run}
            onStepChange={handleStepChange}
          />
        )}
      </section>
    </div>
  );
}
