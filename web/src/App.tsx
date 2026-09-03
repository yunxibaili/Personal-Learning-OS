import { lazy, Suspense } from "react";
import { ToastProvider } from "./components/ui";
import { AppShell } from "./components/shell/AppShell";
import { ContextRail } from "./components/shell/ContextRail";
import { useUi } from "./stores/ui";
import { NoteEditorView } from "./views/NoteEditor";
import { HomeHero } from "./views/HomeHero";

// 浮层视图按需加载（BUG-4 代码分割）：React Flow/dagre/cobe 等重组件只在
// 首次进入对应视图时下载，主包回落到编辑器+骨架可用的体积。
// 懒加载回退 = 空 div（浮层切换有 150ms 过渡，无 CLS：视图容器定高全屏）。
const GraphView = lazy(() =>
  import("./views/GraphView").then((m) => ({ default: m.GraphView })),
);
const GalaxyView = lazy(() =>
  import("./components/galaxy/GalaxyCanvas").then((m) => ({ default: m.GalaxyView })),
);
const MindMapCanvas = lazy(() =>
  import("./components/mindmap/MindMapCanvas").then((m) => ({ default: m.MindMapCanvas })),
);
const ReviewSessionView = lazy(() =>
  import("./views/ReviewSessionView").then((m) => ({ default: m.ReviewSessionView })),
);
// TutorPanel 仅含 api/轻组件，但抽屉态低频，一并分包
const TutorDrawer = lazy(() =>
  import("./components/tutor/TutorDrawer").then((m) => ({ default: m.TutorDrawer })),
);
const SettingsView = lazy(() =>
  import("./views/SettingsView").then((m) => ({ default: m.SettingsView })),
);

function LazyFallback() {
  return <div className="lazy-view-fallback" aria-hidden="true" />;
}

function ActiveView() {
  const activeView = useUi((s) => s.activeView);
  const activeNoteId = useUi((s) => s.activeNoteId);
  const closeTutor = useUi((s) => s.closeTutor);
  // P8-006：进入 Tutor 前的视图——底层画它，关闭时才能真正「回去」
  const tutorReturnView = useUi((s) => s.tutorReturnView);

  // Tutor = 右栏抽屉（Phase 3 ④）：遮罩点击返回来源视图（P8-006：从 Review 进 → 回 Review）
  if (activeView === "tutor") {
    const underlying = tutorReturnView ?? "notes";
    return (
      <>
        <div className="workspace">
          {underlying === "review" ? (
            <Suspense fallback={<LazyFallback />}>
              <ReviewSessionView />
            </Suspense>
          ) : (
            <NoteEditorView />
          )}
          {underlying !== "review" && <ContextRail activeNoteId={activeNoteId} />}
        </div>
        <div
          className="tutor-drawer-overlay"
          onMouseDown={(e) => { if (e.target === e.currentTarget) closeTutor(); }}
        >
          <aside className="tutor-drawer" role="dialog" aria-label="AI 导师">
            <Suspense fallback={<LazyFallback />}>
              <TutorDrawer />
            </Suspense>
          </aside>
        </div>
      </>
    );
  }

  if (activeView === "home") {
    // P1-12-B1 Bright UI Assembly G1：产品入口页（home-hero.html 定稿）
    return <HomeHero />;
  }

  if (activeView === "notes") {
    // Phase 2 笔记工作区：列表+编辑器（NoteEditor 内聚）+ 右栏上下文 320
    return (
      <div className="workspace">
        <NoteEditorView />
        <ContextRail activeNoteId={activeNoteId} />
      </div>
    );
  }
  // 浮层态：顶栏「← 返回笔记」回去（取消平级 tab，裁决 A）
  return (
    <Suspense fallback={<LazyFallback />}>
      {activeView === "graph" && <GraphView />}
      {activeView === "universe" && <GalaxyView />}
      {activeView === "mindmap" && <MindMapCanvas />}
      {activeView === "review" && <ReviewSessionView />}
      {activeView === "settings" && <SettingsView />}
    </Suspense>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppShell>
        <ActiveView />
      </AppShell>
    </ToastProvider>
  );
}
