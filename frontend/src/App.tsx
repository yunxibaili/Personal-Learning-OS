import { useState } from "react";
import NotesView, { type NoteOpenRequest } from "./features/notes/NotesView";
import ConceptsView from "./features/concepts/ConceptsView";
import MasteryView from "./features/mastery/MasteryView";
import ReviewView from "./features/review/ReviewView";
import TutorView from "./features/tutor/TutorView";
import DesignPlayground from "./design/DesignPlayground";
import ComponentLab from "./dev/ComponentLab";
import ReferenceGallery from "./dev/ReferenceGallery";

// MVP 顶层工作区：笔记 / 概念 / 掌握度 / 复习 四个 Consumer 视图
// （单页，无路由——ADR-029 §3.2；Workbench 化路线见 docs/UI-REBUILD-DESIGN-AUDIT.md）。
type Tab = "notes" | "concepts" | "mastery" | "review" | "tutor";

export default function App() {
  const [tab, setTab] = useState<Tab>("notes");
  const [noteRequest, setNoteRequest] = useState<NoteOpenRequest | undefined>(undefined);

  function openNoteFromConcept(noteId: number) {
    setNoteRequest({ id: noteId, seq: Date.now() });
    setTab("notes");
  }

  // dev-only 设计系统入口（UI-REBUILD-DESIGN-AUDIT §40 / 指令书 §20/§29）：
  // ?design → Foundation；?design=components → Component Laboratory；
  // ?design=reference → 视觉校准 Reference Gallery。不进导航。
  const designParam = new URLSearchParams(window.location.search).get("design");
  if (designParam === "components") return <ComponentLab />;
  if (designParam === "reference") return <ReferenceGallery />;
  if (designParam !== null) return <DesignPlayground />;

  return (
    <main>
      <nav className="tabs">
        <button
          type="button"
          className={tab === "notes" ? "active" : ""}
          onClick={() => setTab("notes")}
        >
          笔记
        </button>
        <button
          type="button"
          className={tab === "concepts" ? "active" : ""}
          onClick={() => setTab("concepts")}
        >
          概念
        </button>
        <button
          type="button"
          className={tab === "mastery" ? "active" : ""}
          onClick={() => setTab("mastery")}
        >
          掌握度
        </button>
        <button
          type="button"
          className={tab === "review" ? "active" : ""}
          onClick={() => setTab("review")}
        >
          复习
        </button>
        <button
          type="button"
          className={tab === "tutor" ? "active" : ""}
          onClick={() => setTab("tutor")}
        >
          Tutor
        </button>
      </nav>
      {tab === "notes" && <NotesView openNoteRequest={noteRequest} />}
      {tab === "concepts" && <ConceptsView onOpenNote={openNoteFromConcept} />}
      {tab === "mastery" && <MasteryView />}
      {tab === "review" && <ReviewView />}
      {tab === "tutor" && <TutorView />}
    </main>
  );
}
