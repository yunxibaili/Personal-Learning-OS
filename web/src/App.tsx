import { useState } from "react";
import { ToastProvider } from "./components/ui";
import { ComponentGallery } from "./dev/ComponentGallery";
import { useUi, type ViewKey } from "./stores/ui";
import { DashboardView } from "./views/DashboardView";
import { GraphView } from "./views/GraphView";
import { NoteEditorView } from "./views/NoteEditor";
import { TutorPanel } from "./components/tutor/TutorPanel";
import { KnowledgeUniverse } from "./components/universe/KnowledgeUniverse";
import { MindMapCanvas } from "./components/mindmap/MindMapCanvas";
import { ReviewSessionView } from "./views/ReviewSessionView";
import { UniverseInteractionPreview } from "./components/universe/prototype/UniverseInteractionPreview";
import KnowledgePlanet from "./components/universe/prototype/KnowledgePlanet";

const TABS: Array<{ key: ViewKey; label: string }> = [
  { key: "notes", label: "笔记" },
  { key: "graph", label: "图谱" },
  { key: "universe", label: "Universe" },
  { key: "mindmap", label: "导图" },
  { key: "tutor", label: "AI Tutor" },
  { key: "review", label: "复习" },
  { key: "dashboard", label: "仪表盘" },
];

function ActiveView() {
  const activeView = useUi((s) => s.activeView);
  switch (activeView) {
    case "notes":
      return <NoteEditorView />;
    case "graph":
      return <GraphView />;
    case "universe":
      return <KnowledgeUniverse />;
    case "mindmap":
      return <MindMapCanvas />;
    case "tutor":
      return <TutorPanel />;
    case "review":
      return <ReviewSessionView />;
    case "dashboard":
      return <DashboardView />;
  }
}

export default function App() {
  const setActiveView = useUi((s) => s.setActiveView);
  const activeView = useUi((s) => s.activeView);

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
    <div className="app">
      <nav className="tabbar">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={activeView === t.key ? "active" : ""}
            onClick={() => setActiveView(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>
      <main className="content">
        <ActiveView />
      </main>
    </div>
    </ToastProvider>
  );
}
