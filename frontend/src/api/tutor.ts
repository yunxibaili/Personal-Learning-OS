// Tutor Context 消费端（MVP-06）。
// 契约（源码 + 隔离探针已核查，2026-09-05）：
//   POST /tutor/context {concept_id, note_ids?, auto_notes?} → 9 个 section 同构返回：
//     concept {id,title} · mastery {4维+effective}（无记录=全零对象，非 null）·
//     mistakes[{id,description,occurred_at}] ≤5 · related[{id,title,relation}] ≤10
//     （注入笔记时后端自动收缩至 6）· review {next_review,priority,last_result}|null
//     （无队列行=null，与 mastery 语义不同）· recent_events[{event_type,source,
//     created_at}] ≤5 · notes[{note_id,title,excerpt≤600}] ≤2（显式引用 + auto_notes
//     只补剩余名额）· memories[{kind,content,importance,last_used_at}] ≤5。
//   错误：404 concept_not_found / note_not_found · 400 too_many_notes（统一形状）。
//   GET /context/{id} 是 POST 的无引用子集（notes 恒 []），UI 不另设入口。
//   本模块零 AI 调用：/tutor/test、/chat 不消费。
// 响应体在 OpenAPI 中为自由 schema（后端 `-> dict`），窄化策略同 notes.ts。
import { api, ApiError } from "./client";
import { asString, isRecord } from "./validate";

export interface TutorConceptSection {
  id: number;
  title: string;
}

export interface TutorMasterySection {
  knowledge: number;
  practice: number;
  recall: number;
  transfer: number;
  effective: number;
}

export interface TutorMistake {
  id: number;
  description: string;
  occurred_at: string;
}

export interface TutorRelated {
  id: number;
  title: string;
  relation: string;
}

export interface TutorReviewSection {
  next_review: string;
  priority: number;
  last_result: string | null;
}

export interface TutorRecentEvent {
  event_type: string;
  source: string;
  created_at: string;
}

export interface TutorNoteExcerpt {
  note_id: number;
  title: string;
  excerpt: string;
}

export interface TutorMemory {
  kind: string;
  content: string;
  importance: number;
  last_used_at: string | null;
}

export interface TutorContext {
  concept: TutorConceptSection;
  mastery: TutorMasterySection;
  mistakes: TutorMistake[];
  related: TutorRelated[];
  review: TutorReviewSection | null;
  recent_events: TutorRecentEvent[];
  notes: TutorNoteExcerpt[];
  memories: TutorMemory[];
}

export interface TutorContextQuery {
  concept_id: number;
  note_ids?: number[];
  auto_notes?: boolean;
}

function asArray(v: unknown, field: string): unknown[] {
  if (!Array.isArray(v)) {
    throw new ApiError(0, "contract_mismatch", `tutor context.${field} 非数组`);
  }
  return v;
}

function asTutorContext(v: unknown): TutorContext {
  if (!isRecord(v)) {
    throw new ApiError(0, "contract_mismatch", "tutor context 非对象");
  }
  if (!isRecord(v.concept) || !isRecord(v.mastery)) {
    throw new ApiError(0, "contract_mismatch", "tutor context 缺 concept/mastery");
  }
  const review = v.review === null || v.review === undefined ? null : (() => {
    if (!isRecord(v.review)) {
      throw new ApiError(0, "contract_mismatch", "tutor review 非对象");
    }
    return {
      next_review: asString(v.review.next_review, "review.next_review"),
      priority: v.review.priority as number,
      last_result: typeof v.review.last_result === "string" ? v.review.last_result : null,
    };
  })();
  return {
    concept: { id: v.concept.id as number, title: asString(v.concept.title, "concept.title") },
    mastery: {
      knowledge: v.mastery.knowledge as number,
      practice: v.mastery.practice as number,
      recall: v.mastery.recall as number,
      transfer: v.mastery.transfer as number,
      effective: v.mastery.effective as number,
    },
    mistakes: asArray(v.mistakes, "mistakes").map((m) => {
      if (!isRecord(m)) throw new ApiError(0, "contract_mismatch", "mistake 非对象");
      return {
        id: m.id as number,
        description: asString(m.description, "mistake.description"),
        occurred_at: asString(m.occurred_at, "mistake.occurred_at"),
      };
    }),
    related: asArray(v.related, "related").map((r) => {
      if (!isRecord(r)) throw new ApiError(0, "contract_mismatch", "related 非对象");
      return {
        id: r.id as number,
        title: asString(r.title, "related.title"),
        relation: asString(r.relation, "related.relation"),
      };
    }),
    review,
    recent_events: asArray(v.recent_events, "recent_events").map((e) => {
      if (!isRecord(e)) throw new ApiError(0, "contract_mismatch", "recent_event 非对象");
      return {
        event_type: asString(e.event_type, "recent_event.event_type"),
        source: asString(e.source, "recent_event.source"),
        created_at: asString(e.created_at, "recent_event.created_at"),
      };
    }),
    notes: asArray(v.notes, "notes").map((n) => {
      if (!isRecord(n)) throw new ApiError(0, "contract_mismatch", "note 非对象");
      return {
        note_id: n.note_id as number,
        title: asString(n.title, "note.title"),
        excerpt: asString(n.excerpt, "note.excerpt"),
      };
    }),
    memories: asArray(v.memories, "memories").map((m) => {
      if (!isRecord(m)) throw new ApiError(0, "contract_mismatch", "memory 非对象");
      return {
        kind: asString(m.kind, "memory.kind"),
        content: asString(m.content, "memory.content"),
        importance: m.importance as number,
        last_used_at: typeof m.last_used_at === "string" ? m.last_used_at : null,
      };
    }),
  };
}

export async function postTutorContext(query: TutorContextQuery): Promise<TutorContext> {
  // auto_notes 在请求 schema 中有默认值但为必填键；false 时显式传 false（与后端语义一致）
  const body = {
    concept_id: query.concept_id,
    auto_notes: query.auto_notes === true,
    ...(query.note_ids !== undefined && query.note_ids.length > 0
      ? { note_ids: query.note_ids }
      : {}),
  };
  const res: unknown = await api.post("/api/v1/tutor/context", body);
  return asTutorContext(res);
}
