import { useState } from "react";
import NotesView, { type NoteOpenRequest } from "./features/notes/NotesView";
import ConceptsView from "./features/concepts/ConceptsView";
import MasteryView from "./features/mastery/MasteryView";
import ReviewView from "./features/review/ReviewView";
import TutorView from "./features/tutor/TutorView";
import DesignPlayground from "./design/DesignPlayground";
import ComponentLab from "./dev/ComponentLab";
import ReferenceGallery from "./dev/ReferenceGallery";
import AppleReference from "./dev/AppleReference";
import AppleSourceReference from "./dev/AppleSourceReference";
import Workbench from "./workbench/Workbench";

type Tab = "notes" | "concepts" | "mastery" | "review" | "tutor";

/** 旧平级 tab 视图（ADR-029 历史 UI；?legacy=1 保留至 Phase 4 迁移完成） */
function LegacyApp() {
  const [tab, setTab] = useState<Tab>("notes");
  const [noteRequest, setNoteRequest] = useState<NoteOpenRequest | undefined>(undefined);

  function openNoteFromConcept(noteId: number) {
    setNoteRequest({ id: noteId, seq: Date.now() });
    setTab("notes");
  }

  return (
    <main>
      <nav className="tabs">
        <button type="button" className={tab === "notes" ? "active" : ""} onClick={() => setTab("notes")}>笔记</button>
        <button type="button" className={tab === "concepts" ? "active" : ""} onClick={() => setTab("concepts")}>概念</button>
        <button type="button" className={tab === "mastery" ? "active" : ""} onClick={() => setTab("mastery")}>掌握度</button>
        <button type="button" className={tab === "review" ? "active" : ""} onClick={() => setTab("review")}>复习</button>
        <button type="button" className={tab === "tutor" ? "active" : ""} onClick={() => setTab("tutor")}>Tutor</button>
      </nav>
      {tab === "notes" && <NotesView openNoteRequest={noteRequest} />}
      {tab === "concepts" && <ConceptsView onOpenNote={openNoteFromConcept} />}
      {tab === "mastery" && <MasteryView />}
      {tab === "review" && <ReviewView />}
      {tab === "tutor" && <TutorView />}
    </main>
  );
}

export default function App() {
  // dev-only 设计系统入口 + legacy 入口 + 默认 Workbench（ADR-031 Phase 3A）。
  // ?design → Foundation；?design=components → Component Lab；?design=reference → Reference Gallery；
  // ?legacy=1 → 旧平级 tab 视图。
  const params = new URLSearchParams(window.location.search);
  const designParam = params.get("design");
  if (designParam === "components") return <ComponentLab />;
  if (designParam === "reference") return <ReferenceGallery />;
  if (designParam === "apple-reference") return <AppleReference />;
  if (designParam === "apple-source-reference") return <AppleSourceReference />;
  if (designParam !== null) return <DesignPlayground />;
  if (params.has("legacy")) return <LegacyApp />;
  return <Workbench />;
}
