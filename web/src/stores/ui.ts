import { create } from "zustand";

/** UI 层唯一全局状态：当前激活视图。业务数据一律来自 API，不进 store。 */
export type ViewKey =
  | "notes"
  | "graph"
  | "universe"
  | "mindmap"
  | "tutor"
  | "review";

interface UiState {
  activeView: ViewKey;
  /** 跨视图跳转：图谱点击笔记节点 → 打开笔记视图并聚焦该笔记 */
  focusNoteId: number | null;
  /** 跨视图跳转：图谱/Universe 点击概念节点 → Tutor 视图聚焦该概念（P8-003D） */
  focusConceptId: number | null;
  /** 当前打开的笔记 id（Phase 2：右栏上下文数据源，NoteEditor 回写） */
  activeNoteId: number | null;
  setActiveNoteId: (id: number | null) => void;
  setActiveView: (v: ViewKey) => void;
  openNote: (id: number) => void;
  clearFocus: () => void;
  openTutorForConcept: (id: number) => void;
  clearConceptFocus: () => void;
}

export const useUi = create<UiState>((set) => ({
  activeView: "notes",
  focusNoteId: null,
  focusConceptId: null,
  activeNoteId: null,
  setActiveNoteId: (id) => set({ activeNoteId: id }),
  setActiveView: (v) => set({ activeView: v }),
  openNote: (id) => set({ activeView: "notes", focusNoteId: id }),
  clearFocus: () => set({ focusNoteId: null }),
  openTutorForConcept: (id) => set({ activeView: "tutor", focusConceptId: id }),
  clearConceptFocus: () => set({ focusConceptId: null }),
}));
