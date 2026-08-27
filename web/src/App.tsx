import { useUi, type ViewKey } from "./stores/ui";
import { DashboardView } from "./views/DashboardView";
import { GraphView } from "./views/GraphView";
import { NoteEditorView } from "./views/NoteEditor";
import { TutorPanel } from "./components/tutor/TutorPanel";
import {
  MindMapView,
  ReviewQueueView,
} from "./views/placeholders";

const TABS: Array<{ key: ViewKey; label: string }> = [
  { key: "notes", label: "笔记" },
  { key: "graph", label: "图谱" },
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
    case "mindmap":
      return <MindMapView />;
    case "tutor":
      return <TutorPanel />;
    case "review":
      return <ReviewQueueView />;
    case "dashboard":
      return <DashboardView />;
  }
}

export default function App() {
  const setActiveView = useUi((s) => s.setActiveView);
  const activeView = useUi((s) => s.activeView);

  return (
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
  );
}
