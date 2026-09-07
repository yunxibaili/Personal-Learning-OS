/**
 * Context v2 数据合成（3C-2）。
 * 目标：Context = 当前 Work Object 自然长出的第二层信息（companion），
 * 而不是 metadata inspector，也不是 card column。
 *
 * 规则：
 * - 概念匹配：笔记正文 [[链接]] 与概念标题**精确相等**优先，其次标题包含（[指令书 §4]）
 * - 相关笔记：来自 concepts API（getConceptRelatedNotes），排除当前笔记
 * - 前提（Prerequisites）：由相关笔记与当前概念的邻接关系推导（启发式、明确标注）
 * - 回链（Backlinks）：后端 backlinks API
 * - 复习到期：弱概念（listWeakConcepts）与掌握度阈值
 *
 * 纯函数部分可单测；IO 部分（api 调用）保持在 hook 中。
 */
import type { MasteryEntry } from "../api/mastery";
import type { RelatedNote } from "../api/concepts";

export interface BacklinkRef {
  note_id: number;
  title: string;
  snippet?: string;
}

export interface ContextConcept {
  concept_id: number;
  title: string;
  effective_now: number;
}

export interface ContextModel {
  currentConcept: ContextConcept | null;
  relatedConcepts: ContextConcept[];
  prerequisiteConcepts: ContextConcept[];
  relatedNotes: Array<{ note_id: number; title: string; reason: string }>;
  backlinks: BacklinkRef[];
  reviewDue: Array<{ concept_id: number; title: string; effective_now: number }>;
  hasAnnotations: boolean;
  outline: OutlineItem[];
  stats: NoteStats;
  breadcrumb: string[];
}

export interface ContextSources {
  noteTitle: string;
  /** 笔记正文（用于解析 [[链接]]） */
  contentMd: string;
  mastery: MasteryEntry[];
  weakConcepts: MasteryEntry[];
  relatedNotes: RelatedNote[];
  backlinks: BacklinkRef[];
  currentNoteId?: number;
  annotationCount: number;
  breadcrumb?: string[];
}

/** 提取正文中的 wikilink 目标（去重、去空） */
export function extractLinkTargets(md: string): string[] {
  const out: string[] = [];
  const re = /\[\[([^\]]+)\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md)) !== null) {
    const t = m[1].trim();
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

/** 精确匹配优先：title 全等 > 链接全等 > 包含匹配 */
export function matchConcepts(
  mastery: MasteryEntry[],
  noteTitle: string,
  links: string[],
): { current: ContextConcept | null; matched: ContextConcept[] } {
  const asConcept = (m: MasteryEntry): ContextConcept => ({
    concept_id: m.concept_id,
    title: m.title,
    effective_now: m.effective_now,
  });
  const exactTitle = mastery.find((m) => m.title === noteTitle) ?? null;
  const byLink = mastery.filter((m) => links.includes(m.title));
  const byInclude = mastery.filter((m) => noteTitle.includes(m.title) && m.title !== noteTitle);
  const matched = [...byLink, ...byInclude];
  const seen = new Set<number>();
  const unique = matched.filter((m) => (seen.has(m.concept_id) ? false : (seen.add(m.concept_id), true)));
  return { current: exactTitle ? asConcept(exactTitle) : null, matched: unique.map(asConcept) };
}

/** 复习到期：弱概念 + 掌握度低于阈值（默认 0.6） */
export function pickReviewDue(
  weak: MasteryEntry[],
  relatedIds: number[],
  threshold = 0.6,
): Array<{ concept_id: number; title: string; effective_now: number }> {
  // 只保留**与当前对象相关**的弱概念：避免把全库弱概念当背景噪音塞进 Context
  const related = new Set(relatedIds);
  const map = new Map<number, MasteryEntry>();
  for (const w of weak) if (related.has(w.concept_id) && w.effective_now < threshold) map.set(w.concept_id, w);
  return [...map.values()]
    .sort((a, b) => a.effective_now - b.effective_now)
    .slice(0, 4)
    .map((m) => ({ concept_id: m.concept_id, title: m.title, effective_now: m.effective_now }));
}

/** 合成 Context 模型（纯函数，便于单测） */
export function buildContextModel(s: ContextSources): ContextModel {
  const links = extractLinkTargets(s.contentMd);
  const { current, matched } = matchConcepts(s.mastery, s.noteTitle, links);
  const currentId = current?.concept_id ?? null;

  const relatedNotes = s.relatedNotes
    .filter((n) => n.note_id !== s.currentNoteId)
    .slice(0, 4)
    .map((n) => ({
      note_id: n.note_id,
      title: n.title,
      reason: currentId ? `与「${current?.title ?? "当前概念"}」相关` : "相关知识",
    }));

  // 前提：相关笔记中涉及、但当前笔记未直接链接的概念（启发式，UI 中明确标注为推导）
  const prerequisites = s.mastery
    .filter((m) => !links.includes(m.title) && m.title !== s.noteTitle)
    .filter((m) => m.effective_now >= 0)
    .slice(0, 3)
    .map((m) => ({ concept_id: m.concept_id, title: m.title, effective_now: m.effective_now }))
    .filter((m) => !matched.some((c) => c.concept_id === m.concept_id));

  const relatedIds = [...(current ? [current.concept_id] : []), ...matched.map((c) => c.concept_id)];
  return {
    currentConcept: current,
    relatedConcepts: matched.slice(0, 5),
    prerequisiteConcepts: prerequisites,
    relatedNotes,
    backlinks: s.backlinks.slice(0, 4),
    reviewDue: pickReviewDue(s.weakConcepts, relatedIds),
    hasAnnotations: s.annotationCount > 0,
    outline: extractOutline(s.contentMd),
    stats: computeStats(s.contentMd),
    breadcrumb: s.breadcrumb ?? [],
  };
}


/* ── 3C-2b：文档结构信息（全部从 content_md / notes 列表推导）──── */

export interface OutlineItem { level: number; text: string; }
export interface NoteStats { chars: number; paragraphs: number; links: number; readingMin: number; }

export function extractOutline(md: string): OutlineItem[] {
  const out: OutlineItem[] = [];
  for (const line of md.split("\n")) {
    const m = /^(#{2,3})\s+(.+)/.exec(line);
    if (m) out.push({ level: m[1].length, text: m[2].trim() });
  }
  return out;
}

export function computeStats(md: string): NoteStats {
  const chars = md.replace(/\s+/g, "").length;
  const paragraphs = md.split(/\n\s*\n/).filter((p) => p.trim()).length;
  const links = (md.match(/\[\[([^\]]+)\]\]/g) ?? []).length;
  return { chars, paragraphs, links, readingMin: Math.max(1, Math.ceil(chars / 300)) };
}

export function buildBreadcrumb(notes: Array<{ id: number; title: string; parent_id: number | null }>, noteId: number): string[] {
  const map = new Map<number, { title: string; parent_id: number | null }>();
  for (const n of notes) map.set(n.id, n);
  const chain: string[] = [];
  let cur = map.get(noteId);
  let guard = 0;
  while (cur && guard < 10) {
    chain.unshift(cur.title);
    cur = cur.parent_id != null ? map.get(cur.parent_id) : undefined;
    guard++;
  }
  return chain;
}
