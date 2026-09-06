/**
 * Workbench 状态机（ADR-031 · UI-WORKBENCH-IA §1）。
 * 实现层状态 S0–S4；用户层只见任务动作（toggleExplorer 等），不见模式名。
 * 纯函数 reducer，无 IO —— 可测性优先。
 */

export type ObjectId =
  | { kind: "note"; id: number }
  | { kind: "concept"; id: number }
  | { kind: "review" }
  | { kind: "tutor" };

export interface WorkObject {
  key: string;
  obj: ObjectId;
  title: string;
}

/** 实现层布局状态（用户层不暴露） */
export type LayoutState = "S0" | "S1" | "S2" | "S3" | "S4";

export interface WorkbenchState {
  layout: LayoutState;
  tabs: WorkObject[];          // Work Surface 的多开工作任务
  activeKey: string;           // 当前 primary
  side: WorkObject | null;     // Compare 右槽（S3，天然 locked）
  explorerOpen: boolean;
  contextOpen: boolean;
  /** 进入 Focus 前的快照（退出时恢复） */
  snapshot: Pick<WorkbenchState, "layout" | "explorerOpen" | "contextOpen"> | null;
  annotations: Array<{ id: string; objKey: string; quote: string; note: string }>;
}

export const initialWorkbench: WorkbenchState = {
  layout: "S0",
  tabs: [],
  activeKey: "",
  side: null,
  explorerOpen: false,
  contextOpen: false,
  snapshot: null,
  annotations: [],
};

export type WorkbenchAction =
  | { type: "open"; object: WorkObject }               // 替换 primary（click/Enter）
  | { type: "openRight"; object: WorkObject }          // 并置（⇧ /「在右侧打开」）
  | { type: "activate"; key: string }
  | { type: "closeTab"; key: string }
  | { type: "closeSide" }
  | { type: "toggleExplorer" }
  | { type: "toggleContext" }
  | { type: "enterFocus" }
  | { type: "exitFocus" }
  | { type: "addAnnotation"; quote: string; note: string; objKey: string }
  | { type: "updateAnnotation"; id: string; note: string }
  | { type: "removeAnnotation"; id: string };

function layoutFor(s: WorkbenchState): LayoutState {
  // 派生规则（IA §1 状态机）：Compare>S3；Focus 由 enterFocus 显式进入；否则按 pane 开合
  if (s.side) return "S3";
  if (s.explorerOpen && s.contextOpen) return "S2";
  if (s.explorerOpen || s.contextOpen) return "S1";
  return "S0";
}

export function workbenchReducer(state: WorkbenchState, action: WorkbenchAction): WorkbenchState {
  switch (action.type) {
    case "open": {
      const exists = state.tabs.some((t) => t.key === action.object.key);
      const tabs = exists ? state.tabs : [...state.tabs, action.object];
      return { ...state, tabs, activeKey: action.object.key, layout: layoutFor({ ...state, tabs }) };
    }
    case "openRight": {
      // 并置槽位天然 locked：Side Object 不进 tabs、不被导航顶掉（VS Code locked group 转译）
      return { ...state, side: action.object, layout: "S3" };
    }
    case "activate": {
      if (!state.tabs.some((t) => t.key === action.key)) return state;
      return { ...state, activeKey: action.key };
    }
    case "closeTab": {
      const tabs = state.tabs.filter((t) => t.key !== action.key);
      const activeKey =
        state.activeKey === action.key ? (tabs[tabs.length - 1]?.key ?? "") : state.activeKey;
      return { ...state, tabs, activeKey };
    }
    case "closeSide":
      return { ...state, side: null, layout: layoutFor({ ...state, side: null }) };
    case "toggleExplorer":
    case "toggleContext": {
      const k = action.type === "toggleExplorer" ? "explorerOpen" : "contextOpen";
      const next = { ...state, [k]: !state[k] } as WorkbenchState;
      return { ...next, layout: layoutFor(next) };
    }
    case "enterFocus": {
      if (state.layout === "S4") return state;
      return {
        ...state,
        snapshot: { layout: state.layout, explorerOpen: state.explorerOpen, contextOpen: state.contextOpen },
        explorerOpen: false,
        contextOpen: false,
        layout: "S4",
      };
    }
    case "exitFocus": {
      if (!state.snapshot) return { ...state, layout: layoutFor(state) };
      const restored = { ...state, ...state.snapshot, snapshot: null };
      return { ...restored, layout: layoutFor(restored) };
    }
    case "addAnnotation": {
      const a = { id: `a${Date.now()}${Math.random()}`, ...action };
      return { ...state, annotations: [...state.annotations, a] };
    }
    case "updateAnnotation":
      return {
        ...state,
        annotations: state.annotations.map((a) => (a.id === action.id ? { ...a, note: action.note } : a)),
      };
    case "removeAnnotation":
      return { ...state, annotations: state.annotations.filter((a) => a.id !== action.id) };
    default:
      return state;
  }
}

export function objectKey(obj: ObjectId): string {
  return obj.kind === "review" || obj.kind === "tutor" ? obj.kind : `${obj.kind}:${obj.id}`;
}

/** 互斥规则（IA §7）：1024–1440 下 Explorer 与 Context 不同开；由视图层按断点调用 */
export function enforceMutualExclusion(s: WorkbenchState, narrow: boolean): WorkbenchState {
  if (!narrow) return s;
  if (s.explorerOpen && s.contextOpen) return { ...s, contextOpen: false, layout: "S1" };
  return s;
}
