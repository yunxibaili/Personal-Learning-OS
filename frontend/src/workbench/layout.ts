/**
 * Workbench 布局引擎（3C-1 · D-01 修订版）。
 * Owner 修正 1：680 是 **Reading Measure 目标**，不是 Layout Engine 无条件的物理最小宽度。
 * 优先级：Work Surface > Context > Explorer > Decorative margin。
 * Context / Explorer 是**可让位 pane**（空间不足时转抽屉/遮挡式，而不是压缩 Work Surface）。
 */
export interface LayoutInput {
  explorer: boolean;
  context: boolean;
  compare: boolean;
  focus: boolean;
  /** 视口宽度（px） */
  width: number;
}

export type PaneMode = "column" | "drawer" | "none";

export interface LayoutPlan {
  railWidth: number;
  columns: string;
  areas: string;
  explorerMode: PaneMode;
  contextMode: PaneMode;
  compareMode: PaneMode;
  /** 阅读度量目标（px）：大屏可放宽，空间紧张时回落 */
  readerMeasure: number;
}

const RAIL = 52;
const RAIL_LARGE = 56;
const EXPLORER_W = 264;
const CONTEXT_W = 320;
/** 当“可用宽度 - 所有 pane”低于此值时，次级 pane 让位（转抽屉） */
const SURFACE_COMFORT = 720;

export function computeLayout(i: LayoutInput): LayoutPlan {
  const rail = i.width >= 1920 ? RAIL_LARGE : RAIL;
  const available = Math.max(0, i.width - rail);

  // S4 Focus：只留 Work Surface（Apple 可临时隐藏工具栏以获得无干扰体验）
  if (i.focus) {
    return {
      railWidth: rail, columns: `${rail}px minmax(0, 1fr)`, areas: '"rail surface"',
      explorerMode: "none", contextMode: "none", compareMode: "none",
      readerMeasure: i.width >= 1920 ? 760 : 680,
    };
  }

  // S3 Compare：连续空间被分成两个工作场（均分，Context/Explorer 让位）
  if (i.compare) {
    // 窄屏 Compare：单列 + 右侧全高 Sheet（不并排挤压）
    if (i.width < 1024) {
      return {
        railWidth: 44, columns: "44px minmax(0, 1fr)", areas: '"rail surface"',
        explorerMode: "none", contextMode: "none", compareMode: "drawer", readerMeasure: 680,
      };
    }
    return {
      railWidth: rail, columns: `${rail}px minmax(0, 1fr) minmax(0, 1fr)`, areas: '"rail surface side"',
      explorerMode: "drawer", contextMode: "none", compareMode: "column",
      readerMeasure: i.width >= 1920 ? 760 : 680,
    };
  }

  // 窄屏：次级 pane 一律让位（抽屉），Work Surface 独占 [Owner 修正 1]
  if (i.width < 1024) {
    return {
      railWidth: 44,
      columns: "44px minmax(0, 1fr)",
      areas: '"rail surface"',
      explorerMode: i.explorer ? "drawer" : "none",
      contextMode: i.context ? "drawer" : "none",
      compareMode: "none",
      readerMeasure: 680,
    };
  }

  const both = i.explorer && i.context;
  const needed = (i.explorer ? EXPLORER_W : 0) + (i.context ? CONTEXT_W : 0);
  const surfaceWouldBe = available - needed;

  // 让位规则：Explorer 与 Context 同时开启且 Work Surface 不够舒适 → Context 让位为抽屉
  const contextYields = both && surfaceWouldBe < SURFACE_COMFORT;
  const explorerColumn = i.explorer;
  const contextColumn = i.context && !contextYields;

  const cols: string[] = [`${rail}px`];
  const names: string[] = ["rail"];
  if (explorerColumn) { cols.push(`${EXPLORER_W}px`); names.push("explorer"); }
  cols.push("minmax(0, 1fr)"); names.push("surface");
  if (contextColumn) { cols.push(`${CONTEXT_W}px`); names.push("context"); }

  return {
    railWidth: rail,
    columns: cols.join(" "),
    areas: `"${names.join(" ")}"`,
    explorerMode: explorerColumn ? "column" : i.explorer ? "drawer" : "none",
    contextMode: contextColumn ? "column" : i.context ? "drawer" : "none",
    compareMode: "none",
    readerMeasure: i.width >= 1920 ? 760 : 680,
  };
}
