import { useState } from "react";
import NotesView, { type NoteOpenRequest } from "./features/notes/NotesView";
import ConceptsView from "./features/concepts/ConceptsView";

// MVP 顶层工作区：笔记 / 概念两个 Consumer 视图（单页，无路由——ADR-029 §3.2）。
type Tab = "notes" | "concepts";

export default function App() {
  const [tab, setTab] = useState<Tab>("notes");
  const [noteRequest, setNoteRequest] = useState<NoteOpenRequest | undefined>(undefined);

  function openNoteFromConcept(noteId: number) {
    setNoteRequest({ id: noteId, seq: Date.now() });
    setTab("notes");
  }

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
      </nav>
      {tab === "notes" ? (
        <NotesView openNoteRequest={noteRequest} />
      ) : (
        <ConceptsView onOpenNote={openNoteFromConcept} />
      )}
    </main>
  );
}
