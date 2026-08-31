import { useState } from "react";
import { ToastProvider } from "./components/ui";
import { AppShell } from "./components/shell/AppShell";
import { ContextRail } from "./components/shell/ContextRail";
import { ComponentGallery } from "./dev/ComponentGallery";
import { useUi } from "./stores/ui";
import { GraphView } from "./views/GraphView";
import { NoteEditorView } from "./views/NoteEditor";
import { TutorPanel } from "./components/tutor/TutorPanel";
import { GalaxyView } from "./components/galaxy/GalaxyCanvas";
import { MindMapCanvas } from "./components/mindmap/MindMapCanvas";
import { ReviewSessionView } from "./views/ReviewSessionView";

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
          {underlying === "review" ? <ReviewSessionView /> : <NoteEditorView />}
          {underlying !== "review" && <ContextRail activeNoteId={activeNoteId} />}
        </div>
        <div
          className="tutor-drawer-overlay"
          onMouseDown={(e) => { if (e.target === e.currentTarget) closeTutor(); }}
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
      return <GalaxyView />;
    case "mindmap":
      return <MindMapCanvas />;
    case "review":
      return <ReviewSessionView />;
  }
}

export default function App() {
  // Phase 1 组件 Gallery（dev-only 活文档）：仅 DEV 生效，生产构建里被 tree-shake
  const [showGallery] = useState(
    () => typeof window !== "undefined" && window.location.hash === "#gallery",
  );

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
