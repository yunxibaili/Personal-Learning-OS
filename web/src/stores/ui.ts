import { create } from "zustand";

/** UI 层唯一全局状态：当前激活视图。业务数据一律来自 API，不进 store。 */
export type ViewKey =
  | "notes"
  | "graph"
  | "universe"
  | "mindmap"
  | "tutor"
  | "review"
  | "dashboard";

interface UiState {
  activeView: ViewKey;
  /** 跨视图跳转：图谱点击笔记节点 → 打开笔记视图并聚焦该笔记 */
  focusNoteId: number | null;
  setActiveView: (v: ViewKey) => void;
  openNote: (id: number) => void;
  clearFocus: () => void;
}

export const useUi = create<UiState>((set) => ({
  activeView: "notes",
  focusNoteId: null,
  setActiveView: (v) => set({ activeView: v }),
  openNote: (id) => set({ activeView: "notes", focusNoteId: id }),
  clearFocus: () => set({ focusNoteId: null }),
}));
