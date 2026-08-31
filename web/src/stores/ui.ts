import { create } from "zustand";

/** UI 层唯一全局状态：当前激活视图。业务数据一律来自 API，不进 store。 */
export type ViewKey =
  | "notes"
  | "graph"
  | "universe"
  | "mindmap"
  | "tutor"
  | "review";

/**
 * 进入 Tutor 时携带的一次性上下文预填包（P8-006）。
 * 语义：预填 ≠ 自动发送——seed 只减少重复输入，提问永远由用户主动触发
 * （ADR-022：Tutor =「你问，我答」）。消费即清除。
 */
export interface TutorSeed {
  conceptId?: number | null;
  /** ≤2 篇（/chat note_ids 上限）；带 id+title 供面板直接渲染引用 chip */
  noteIds?: Array<{ note_id: number; title: string }>;
  mode?: "explain" | "hint" | "review";
  query?: string;
}

interface UiState {
  activeView: ViewKey;
  /** 跨视图跳转：图谱点击笔记节点 → 打开笔记视图并聚焦该笔记 */
  focusNoteId: number | null;
  /** 跨视图跳转：图谱/Universe 点击概念节点 → Tutor 视图聚焦该概念（P8-003D） */
  focusConceptId: number | null;
  /** 当前打开的笔记 id（Phase 2：右栏上下文数据源，NoteEditor 回写） */
  activeNoteId: number | null;
  /** P8-006：Tutor 一次性预填包（消费即清除，见 TutorSeed 注释） */
  tutorSeed: TutorSeed | null;
  /** P8-006：进入 Tutor 前所在视图——关闭 Tutor 时回到哪里（从 Review 进 → 回 Review） */
  tutorReturnView: ViewKey | null;
  setActiveNoteId: (id: number | null) => void;
  setActiveView: (v: ViewKey) => void;
  openNote: (id: number) => void;
  clearFocus: () => void;
  openTutorForConcept: (id: number) => void;
  clearConceptFocus: () => void;
  /** P8-006 统一入口：记录返回视图 + 携带 seed 进入 Tutor */
  openTutor: (seed: TutorSeed | null) => void;
  /** P8-006：关闭 Tutor（回 tutorReturnView；无记录则回笔记工作区）并清 seed */
  closeTutor: () => void;
  /** P8-006：消费 seed（取走并清除） */
  consumeTutorSeed: () => TutorSeed | null;
}

export const useUi = create<UiState>((set, get) => ({
  activeView: "notes",
  focusNoteId: null,
  focusConceptId: null,
  activeNoteId: null,
  tutorSeed: null,
  tutorReturnView: null,
  setActiveNoteId: (id) => set({ activeNoteId: id }),
  setActiveView: (v) => set({ activeView: v }),
  openNote: (id) => set({ activeView: "notes", focusNoteId: id }),
  clearFocus: () => set({ focusNoteId: null }),
  /** 兼容包装（P8-003D 既有调用方）：等价 openTutor({ conceptId }) */
  openTutorForConcept: (id) => get().openTutor({ conceptId: id }),
  clearConceptFocus: () => set({ focusConceptId: null }),
  openTutor: (seed) =>
    set((s) => ({
      activeView: "tutor",
      tutorSeed: seed,
      tutorReturnView: s.activeView === "tutor" ? s.tutorReturnView : s.activeView,
    })),
  closeTutor: () =>
    set((s) => ({
      activeView: s.tutorReturnView ?? "notes",
      tutorSeed: null,
      tutorReturnView: null,
    })),
  consumeTutorSeed: () => {
    const seed = get().tutorSeed;
    if (seed) set({ tutorSeed: null });
    return seed;
  },
}));
