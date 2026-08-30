import { useState } from "react";
import { ToastProvider } from "./components/ui";
import { AppShell } from "./components/shell/AppShell";
import { ContextRail } from "./components/shell/ContextRail";
import { ComponentGallery } from "./dev/ComponentGallery";
import { useUi } from "./stores/ui";
import { GraphView } from "./views/GraphView";
import { NoteEditorView } from "./views/NoteEditor";
import { TutorPanel } from "./components/tutor/TutorPanel";
import { KnowledgeUniverse } from "./components/universe/KnowledgeUniverse";
import { MindMapCanvas } from "./components/mindmap/MindMapCanvas";
import { ReviewSessionView } from "./views/ReviewSessionView";
import { UniverseInteractionPreview } from "./components/universe/prototype/UniverseInteractionPreview";
import KnowledgePlanet from "./components/universe/prototype/KnowledgePlanet";

function ActiveView() {
  const activeView = useUi((s) => s.activeView);
  const activeNoteId = useUi((s) => s.activeNoteId);
  const setActiveView = useUi((s) => s.setActiveView);

  // Tutor = 右栏抽屉（Phase 3 ④）：遮罩点击返回笔记
  if (activeView === "tutor") {
    return (
      <>
        <div className="workspace">
          <NoteEditorView />
          <ContextRail activeNoteId={activeNoteId} />
        </div>
        <div
          className="tutor-drawer-overlay"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setActiveView("notes"); }}
        >
          <aside className="tutor-drawer" role="dialog" aria-label="AI Tutor">
            <TutorPanel />
          </aside>
        </div>
      </>
    );
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
  switch (activeView) {
    case "graph":
      return <GraphView />;
    case "universe":
      return <KnowledgeUniverse />;
    case "mindmap":
      return <MindMapCanvas />;
    case "review":
      return <ReviewSessionView />;
  }
}

export default function App() {
  // P8-001C-Preview 临时入口：URL hash "#preview" 渲染交互原型（不触碰 ui store）
  const [showPreview] = useState(
    () => typeof window !== "undefined" && window.location.hash === "#preview",
  );

  // P8-001C Knowledge Planet 临时入口
  const [showPlanet] = useState(
    () => typeof window !== "undefined" && window.location.hash === "#planet",
  );

  // Phase 1 组件 Gallery（dev-only 活文档）
  const [showGallery] = useState(
    () => typeof window !== "undefined" && window.location.hash === "#gallery",
  );

  if (showPreview) {
    return (
      <div className="app">
        <main className="content">
          <UniverseInteractionPreview />
        </main>
      </div>
    );
  }

  if (showPlanet) {
    return (
      <div className="app">
        <main className="content">
          <KnowledgePlanet />
        </main>
      </div>
    );
  }

  if (showGallery && import.meta.env.DEV) {
    return (
      <ToastProvider>
        <ComponentGallery />
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <AppShell>
        <ActiveView />
      </AppShell>
    </ToastProvider>
  );
}
