/**
 * Workbench 布局引擎 — VS Code 式紧凑布局（3C-3）。
 *
 * 核心模型：
 *   Rail (48px) │ Explorer (240px, 可关) │ Editor Area (flexible)
 *
 * Editor Area 内可 Split（Note A │ Note B），也可单栏。
 * Context / Inspector 不占固定列——按需以 overlay 浮层出现。
 *
 * Owner 裁定：
 * - 左边放笔记导航栏
 * - 可以双页面同屏
 * - 不要为了把屏幕塞满而把没用的东西塞进去
 * - 参考 VS Code：紧凑、内容密度高、没有多余 chrome
 */

export interface LayoutInput {
  explorer: boolean;
  /** Editor 是否 Split（双页同屏） */
  split: boolean;
  focus: boolean;
  width: number;
}

export interface LayoutPlan {
  railWidth: number;
  explorerWidth: number;
  /** true = Explorer 可见（column），false = 隐藏 */
  explorerVisible: boolean;
  /** true = Editor Area 分成两列 */
  splitActive: boolean;
  focus: boolean;
  /** 阅读度量目标 */
  readerMeasure: number;
}

const RAIL_W = 48;
const EXPLORER_W = 240;
const FOCUS_W = 48;

export function computeLayout(i: LayoutInput): LayoutPlan {
  const rail = i.focus ? FOCUS_W : RAIL_W;
  const explorerVisible = i.explorer && !i.focus;
  const explorerW = explorerVisible ? EXPLORER_W : 0;

  // 阅读度量：≥1920 放宽到 760，其余 680
  const readerMeasure = i.width >= 1920 ? 760 : 680;

  return {
    railWidth: rail,
    explorerWidth: explorerW,
    explorerVisible,
    splitActive: i.split,
    focus: i.focus,
    readerMeasure,
  };
}
