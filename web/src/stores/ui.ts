import { create } from "zustand";

/** UI 层唯一全局状态：当前激活视图。业务数据一律来自 API，不进 store。 */
export type ViewKey =
  | "notes"
  | "graph"
  | "mindmap"
  | "tutor"
  | "review"
  | "dashboard";

interface UiState {
  activeView: ViewKey;
  setActiveView: (v: ViewKey) => void;
}

export const useUi = create<UiState>((set) => ({
  activeView: "notes",
  setActiveView: (v) => set({ activeView: v }),
}));
