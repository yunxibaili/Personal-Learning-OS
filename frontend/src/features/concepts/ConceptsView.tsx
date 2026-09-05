import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../../api/client";
import {
  getConcept,
  getConceptDomains,
  getConceptRelatedNotes,
  listConcepts,
  type ConceptSummary,
  type RelatedNote,
} from "../../api/concepts";

// MVP-03：最小 Knowledge Consumer（ADR-029 §8 第 3 项）。
// 列表（domain/status 筛选 + 分页，均由后端执行）→ 详情（metadata + mastery 原样
// 展示）→ 关联笔记（/graph 只读投影，depth=1，点击复用 Notes 打开链路）。
// 本轮无 POST/PATCH/DELETE UI；桩（unconfirmed）与 active 列表互斥展示，
// 不做自动确认/提升；前端零知识语义计算（L1/L3）。

const PAGE_SIZE = 50;

type ListState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "done"; concepts: ConceptSummary[] }
  | { kind: "error"; message: string };

type DetailState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "done"; concept: ConceptSummary; related: RelatedNote[] }
  | { kind: "error"; message: string };

function errText(e: unknown): string {
  return e instanceof ApiError ? `${e.status} ${e.code}: ${e.message}` : String(e);
}

function masteryLine(effective: number): string {
  return `掌握度：effective ${effective}`;
}

export default function ConceptsView({
  onOpenNote,
}: {
  onOpenNote: (noteId: number) => void;
}) {
  const [list, setList] = useState<ListState>({ kind: "idle" });
  const [domains, setDomains] = useState<string[]>([]);
  const [domain, setDomain] = useState("");
  const [showStubs, setShowStubs] = useState(false);
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<ConceptSummary | null>(null);
  const [detail, setDetail] = useState<DetailState>({ kind: "idle" });

  const status = showStubs ? "unconfirmed" : "active";

  const reload = useCallback(async (nextOffset: number) => {
    setOffset(nextOffset);
    setList({ kind: "loading" });
    try {
      const concepts = await listConcepts({
        domain: domain || undefined,
        status,
        limit: PAGE_SIZE,
        offset: nextOffset,
      });
      setList({ kind: "done", concepts });
    } catch (e) {
      setList({ kind: "error", message: errText(e) });
    }
  }, [domain, status]);

  // 筛选（domain/status）变化 → 回到第 0 页重取
  useEffect(() => {
    reload(0);
  }, [reload]);

  useEffect(() => {
    getConceptDomains()
      .then(setDomains)
      .catch(() => setDomains([])); // 筛选项加载失败不阻断列表，退化为无筛选
  }, []);

  async function openConcept(c: ConceptSummary) {
    setSelected(c);
    setDetail({ kind: "loading" });
    try {
      const concept = await getConcept(c.id);
      let related: RelatedNote[] = [];
      try {
        related = await getConceptRelatedNotes(c.id);
      } catch (e) {
        // 关系投影失败不阻断详情本体，明确标注而非静默
        setDetail({ kind: "done", concept, related: [] });
        setDetail({ kind: "error", message: `详情已加载，但关联笔记加载失败：${errText(e)}` });
        return;
      }
      setDetail({ kind: "done", concept, related });
    } catch (e) {
      setDetail({ kind: "error", message: errText(e) });
    }
  }

  return (
    <div className="concepts-layout">
      <aside className="concepts-sidebar">
        <div className="concepts-filters">
          <select
            value={domain}
            onChange={(e) => {
              setDomain(e.target.value);
            }}
          >
            <option value="">全部领域</option>
            {domains.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <label className="stub-toggle">
            <input
              type="checkbox"
              checked={showStubs}
              onChange={(e) => setShowStubs(e.target.checked)}
            />
            显示未确认桩
          </label>
        </div>
        {list.kind === "loading" && <p className="state-loading">加载中…</p>}
        {list.kind === "error" && <p className="state-error">列表加载失败：{list.message}</p>}
        {list.kind === "done" && list.concepts.length === 0 && (
          <p className="state-empty">
            {showStubs ? "没有未确认概念桩。" : "暂无 active 概念。"}
          </p>
        )}
        <ul className="concepts-list">
          {(list.kind === "done" ? list.concepts : []).map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className={selected?.id === c.id ? "active" : ""}
                onClick={() => openConcept(c)}
              >
                <span className="concept-title">{c.title}</span>
                <span className="concept-meta">
                  {c.domain ?? "未分域"} · {c.origin}
                </span>
              </button>
            </li>
          ))}
        </ul>
        {list.kind === "done" && (
          <div className="pager">
            <button
              type="button"
              disabled={offset === 0}
              onClick={() => reload(Math.max(0, offset - PAGE_SIZE))}
            >
              上一页
            </button>
            <span className="pager-pos">offset {offset}</span>
            <button
              type="button"
              disabled={(list.kind === "done" ? list.concepts.length : 0) < PAGE_SIZE}
              onClick={() => reload(offset + PAGE_SIZE)}
            >
              下一页
            </button>
          </div>
        )}
      </aside>

      <section className="concept-detail">
        {detail.kind === "loading" && <p className="state-loading">打开概念…</p>}
        {detail.kind === "error" && <p className="state-error">{detail.message}</p>}
        {detail.kind === "done" && (
          <>
            <header>
              <h2>{detail.concept.title}</h2>
            </header>
            <dl className="concept-fields">
              <dt>domain</dt>
              <dd>{detail.concept.domain ?? "未分域"}</dd>
              <dt>origin</dt>
              <dd>{detail.concept.origin}</dd>
              <dt>status</dt>
              <dd>{detail.concept.status}</dd>
              <dt>aliases</dt>
              <dd>
                {detail.concept.aliases.length > 0
                  ? detail.concept.aliases.join("、")
                  : "—"}
              </dd>
              <dt>summary</dt>
              <dd>{detail.concept.summary || "—"}</dd>
              <dt>created / updated</dt>
              <dd>
                {detail.concept.created_at} / {detail.concept.updated_at}
              </dd>
            </dl>
            {detail.concept.mastery !== null && (
              <p className="mastery-line">
                {masteryLine(detail.concept.mastery.effective)}
                （knowledge {detail.concept.mastery.knowledge} · practice{" "}
                {detail.concept.mastery.practice} · recall {detail.concept.mastery.recall} ·
                transfer {detail.concept.mastery.transfer}）
              </p>
            )}
            <h3>关联笔记</h3>
            {detail.related.length === 0 ? (
              <p className="state-empty">无（relation 投影 depth=1）</p>
            ) : (
              <ul className="concepts-list">
                {detail.related.map((n) => (
                  <li key={n.note_id}>
                    <button type="button" onClick={() => onOpenNote(n.note_id)}>
                      {n.title}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        {detail.kind === "idle" && <p className="state-empty">← 从左侧选择一个概念</p>}
      </section>
    </div>
  );
}
