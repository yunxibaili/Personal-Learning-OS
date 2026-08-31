/**
 * TutorDrawer（BUG-4 代码分割）：TutorPanel 的懒加载薄包装。
 *
 * App.tsx 经 lazy() 引本文件 → TutorPanel（含其依赖链）单独成 chunk，
 * 主包不再包含 Tutor 面板代码。除组合外无任何逻辑。
 */
import { TutorPanel } from "./TutorPanel";

export function TutorDrawer() {
  return <TutorPanel />;
}
