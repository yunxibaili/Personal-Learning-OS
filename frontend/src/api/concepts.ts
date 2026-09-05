// Concepts 消费端（MVP-03）。
// 契约（源码 + 隔离探针已核查，2026-09-05）：
//   GET /concepts?domain&origin&status&limit&offset → {concepts: [...]}，
//     status 默认 "active"，limit 1–500 / offset ≥0（越界 → 400 invalid_body），
//     ORDER BY id，mastery 为后端算好的投影（无记录 → null），前端原样消费不重算（L1）。
//   GET /concepts/domains → {domains: [...]}
//   GET /concepts/{id} → concept（同列表字段）；404 → http_404。
//   GET /graph?root_type=concept&root_id=N&depth=1 → 后端只读关系投影
//     {nodes: [{id:"note-1"|"concept-1", type, ref_id, title}], edges: [{source,target,relation}]}。
//     前端只按 edges 求邻接，不自行推导知识语义（L3）。
// 响应体在 OpenAPI 中为自由 schema（后端 `-> dict`），窄化策略同 notes.ts。
import { api, ApiError } from "./client";
import { asString, isRecord } from "./validate";

export interface MasteryProjection {
  effective: number;
  knowledge: number;
  practice: number;
  recall: number;
  transfer: number;
}

export interface ConceptSummary {
  id: number;
  title: string;
  aliases: string[];
  summary: string;
  domain: string | null;
  origin: string;
  created_at: string;
  updated_at: string;
  status: string;
  mastery: MasteryProjection | null;
}

export interface ConceptListQuery {
  domain?: string;
  status: string;
  limit: number;
  offset: number;
}

export interface RelatedNote {
  note_id: number;
  title: string;
}

function asMastery(v: unknown): MasteryProjection | null {
  if (v === null || v === undefined) return null;
  if (!isRecord(v)) {
    throw new ApiError(0, "contract_mismatch", "concept.mastery 非对象");
  }
  return {
    effective: v.effective as number,
    knowledge: v.knowledge as number,
    practice: v.practice as number,
    recall: v.recall as number,
    transfer: v.transfer as number,
  };
}

function asConcept(v: unknown): ConceptSummary {
  if (!isRecord(v)) {
    throw new ApiError(0, "contract_mismatch", "concept 非对象");
  }
  return {
    id: v.id as number,
    title: asString(v.title, "concept.title"),
    aliases: Array.isArray(v.aliases) ? (v.aliases as string[]) : [],
    summary: typeof v.summary === "string" ? v.summary : "",
    domain: typeof v.domain === "string" ? v.domain : null,
    origin: asString(v.origin, "concept.origin"),
    created_at: asString(v.created_at, "concept.created_at"),
    updated_at: asString(v.updated_at, "concept.updated_at"),
    status: asString(v.status, "concept.status"),
    mastery: asMastery(v.mastery),
  };
}

export async function listConcepts(query: ConceptListQuery): Promise<ConceptSummary[]> {
  const params: Record<string, string> = {
    status: query.status,
    limit: String(query.limit),
    offset: String(query.offset),
  };
  if (query.domain) params.domain = query.domain;
  const res = await api.get("/api/v1/concepts", params);
  const concepts = (res as { concepts?: unknown }).concepts;
  if (!Array.isArray(concepts)) {
    throw new ApiError(0, "contract_mismatch", "concepts 响应缺 concepts 数组");
  }
  return concepts.map(asConcept);
}

export async function getConceptDomains(): Promise<string[]> {
  const res = await api.get("/api/v1/concepts/domains");
  const domains = (res as { domains?: unknown }).domains;
  if (!Array.isArray(domains)) {
    throw new ApiError(0, "contract_mismatch", "domains 响应缺 domains 数组");
  }
  return domains.filter((d): d is string => typeof d === "string");
}

export async function getConcept(conceptId: number): Promise<ConceptSummary> {
  const path = "/api/v1/concepts/{concept_id}" as const;
  const res = await api.get(
    path.replace("{concept_id}", String(conceptId)) as typeof path,
  );
  return asConcept(res);
}

// 概念的关联笔记：消费 /graph 只读投影，按 edges 取 concept 节点的 note 邻居。
// 不做传递展开（depth 固定 1），不按 wikilink 自行推导（L3）。
export async function getConceptRelatedNotes(conceptId: number): Promise<RelatedNote[]> {
  // 先收窄为 unknown 再校验（graph 响应的生成类型经条件类型后不可直接索引）
  const res: unknown = await api.get("/api/v1/graph", {
    root_type: "concept",
    root_id: String(conceptId),
    depth: "1",
  });
  if (!isRecord(res)) {
    throw new ApiError(0, "contract_mismatch", "graph 响应非对象");
  }
  const nodes = res.nodes;
  const edges = res.edges;
  if (!Array.isArray(nodes) || !Array.isArray(edges)) {
    throw new ApiError(0, "contract_mismatch", "graph 响应缺 nodes/edges 数组");
  }
  const selfId = `concept-${conceptId}`;
  const neighborIds = new Set<string>();
  for (const e of edges) {
    if (!isRecord(e)) continue;
    if (e.source === selfId && typeof e.target === "string") neighborIds.add(e.target);
    if (e.target === selfId && typeof e.source === "string") neighborIds.add(e.source);
  }
  const related: RelatedNote[] = [];
  for (const n of nodes) {
    if (!isRecord(n)) continue;
    if (n.type !== "note" || !neighborIds.has(n.id as string)) continue;
    related.push({
      note_id: n.ref_id as number,
      title: asString(n.title, "graph node.title"),
    });
  }
  return related;
}
