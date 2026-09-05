import { useCallback, useEffect, useRef, useState } from "react";
import { basicSetup, EditorView } from "codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { ApiError } from "../../api/client";
import {
  createNote,
  getNote,
  listNotes,
  saveNoteContent,
  type NoteDetail,
  type NoteSummary,
} from "../../api/notes";
import { searchNotes, type SearchResult } from "../../api/search";

// MVP-01：最小 Markdown Note Consumer（ADR-029 §8 第 1 项）。
// 链路：列表 → 打开 → 编辑 → 保存（PATCH）→ 重读确认。
// MVP-02：搜索框 → GET /search?q → 结果列表 → 点击走既有打开链路（第 2 项）。
// L1：内容只来自 backend，本地 draft 是编辑缓冲，不是 canonical 副本；
// 无 localStorage / 无持久化。无 autosave、无 tree/links（MVP 外）。

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; at: string }
  | { kind: "error"; message: string };

type SearchState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "done"; results: SearchResult[]; query: string }
  | { kind: "error"; message: string };

function errText(e: unknown): string {
  return e instanceof ApiError ? `${e.status} ${e.code}: ${e.message}` : String(e);
}

export interface NoteOpenRequest {
  id: number;
  seq: number;
}

export default function NotesView({ openNoteRequest }: { openNoteRequest?: NoteOpenRequest }) {
  const [notes, setNotes] = useState<NoteSummary[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [selected, setSelected] = useState<NoteDetail | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [noteLoading, setNoteLoading] = useState(false);
  const [draft, setDraft] = useState<string>("");
  const [saveState, setSaveState] = useState<SaveState>({ kind: "idle" });
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState("");
  const [search, setSearchState] = useState<SearchState>({ kind: "idle" });

  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  // updateListener 回调经 ref 转发 setState，EditorView 只挂载一次
  const draftSetterRef = useRef<(text: string) => void>(() => {});

  const openNote = useCallback(async (noteId: number) => {
    setNoteLoading(true);
    setNoteError(null);
    setSaveState({ kind: "idle" });
    try {
      const note = await getNote(noteId);
      setSelected(note);
      setDraft(note.content_md);
    } catch (e) {
      setNoteError(errText(e));
      setSelected(null);
    } finally {
      setNoteLoading(false);
    }
  }, []);

  const reloadList = useCallback(async () => {
    setListError(null);
    try {
      setNotes(await listNotes());
    } catch (e) {
      setListError(errText(e));
    }
  }, []);

  // 首帧加载列表
  useEffect(() => {
    reloadList();
  }, [reloadList]);

  // 跨视图打开请求（MVP-03：概念详情的关联笔记 → 切回 Notes 打开）
  const openSeq = openNoteRequest?.seq;
  const openId = openNoteRequest?.id;
  useEffect(() => {
    if (openSeq !== undefined && openId !== undefined) openNote(openId);
    // eslint 由 oxlint 承担；依赖仅 seq（同一笔记可重复请求时 id 不变）
  }, [openSeq, openId, openNote]);

  // CodeMirror 生命周期：编辑器宿主渲染后才创建视图（空 vault 时宿主不在 DOM，
  // 不能在挂载期用 parent=null 创建脱离文档的视图）；宿主卸载即销毁，重建时
  // 由「选中笔记同步」effect 重新灌入 backend 内容。
  const editorMounted = selected !== null && !noteLoading;
  useEffect(() => {
    if (!editorMounted || viewRef.current !== null || editorRef.current === null) return;
    const view = new EditorView({
      doc: "",
      extensions: [
        basicSetup,
        markdown(),
        EditorView.lineWrapping,
        EditorView.updateListener.of((u) => {
          if (u.docChanged) draftSetterRef.current(u.state.doc.toString());
        }),
      ],
      parent: editorRef.current,
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [editorMounted]);

  useEffect(() => {
    draftSetterRef.current = setDraft;
  }, []);

  // 切换笔记 → 以 backend 内容为准同步编辑器文档
  useEffect(() => {
    const view = viewRef.current;
    if (!view || !selected) return;
    const current = view.state.doc.toString();
    if (current !== selected.content_md) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: selected.content_md },
      });
    }
  }, [selected]);

  const dirty = selected !== null && draft !== selected.content_md;

  async function handleSave() {
    if (!selected || saveState.kind === "saving") return;
    setSaveState({ kind: "saving" });
    try {
      // 保存 → 后端落盘 → 重新 GET 确认持久化（L1：确认值以 backend 回读为准）
      const saved = await saveNoteContent(selected.id, draft);
      const reread = await getNote(selected.id);
      setSelected(reread);
      setDraft(reread.content_md);
      setSaveState({ kind: "saved", at: saved.updated_at });
      await reloadList();
    } catch (e) {
      setSaveState({ kind: "error", message: errText(e) });
    }
  }

  async function handleCreate() {
    const title = newTitle.trim();
    if (!title || creating) return;
    setCreating(true);
    setNoteError(null);
    try {
      const note = await createNote(title, "");
      setNewTitle("");
      await reloadList();
      await openNote(note.id);
    } catch (e) {
      setNoteError(errText(e));
    } finally {
      setCreating(false);
    }
  }

  // MVP-02：空输入不发请求（契约：空 q → 400 missing_q，UI 侧直接禁用）
  async function handleSearch() {
    const q = query.trim();
    if (!q || search.kind === "loading") return;
    setSearchState({ kind: "loading" });
    try {
      const results = await searchNotes(q);
      setSearchState({ kind: "done", results, query: q });
    } catch (e) {
      setSearchState({ kind: "error", message: errText(e) });
    }
  }

  return (
    <div className="notes-layout">
      <aside className="notes-sidebar">
        <div className="notes-new">
          <input
            value={newTitle}
            placeholder="新笔记标题"
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
            }}
          />
          <button type="button" onClick={handleCreate} disabled={!newTitle.trim() || creating}>
            新建
          </button>
        </div>
        {listError !== null && <p className="state-error">列表加载失败：{listError}</p>}
        {notes === null && !listError && <p className="state-loading">加载中…</p>}
        {notes !== null && notes.length === 0 && (
          <p className="state-empty">vault 为空——用上方「新建」创建第一篇 Markdown 笔记。</p>
        )}
        <div className="notes-search">
          <input
            value={query}
            placeholder="搜索笔记"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearch();
            }}
          />
          <button type="button" onClick={handleSearch} disabled={!query.trim() || search.kind === "loading"}>
            {search.kind === "loading" ? "…" : "搜索"}
          </button>
        </div>
        {search.kind === "loading" && <p className="state-loading">搜索中…</p>}
        {search.kind === "error" && (
          <p className="state-error">搜索失败：{search.message}</p>
        )}
        {search.kind === "done" && (
          <div className="search-results">
            <p className="search-summary">
              「{search.query}」{search.results.length} 条结果
              <button type="button" className="linkish" onClick={() => setSearchState({ kind: "idle" })}>
                清除
              </button>
            </p>
            {search.results.length === 0 && <p className="state-empty">无结果</p>}
            <ul className="notes-list">
              {search.results.map((r) => (
                <li key={r.note_id}>
                  <button type="button" onClick={() => openNote(r.note_id)}>
                    {r.title}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <ul className="notes-list">
          {(notes ?? []).map((n) => (
            <li key={n.id}>
              <button
                type="button"
                className={selected?.id === n.id ? "active" : ""}
                onClick={() => openNote(n.id)}
              >
                {n.title}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="notes-editor">
        {noteLoading && <p className="state-loading">打开笔记…</p>}
        {noteError !== null && <p className="state-error">打开失败：{noteError}</p>}
        {selected !== null && !noteLoading && (
          <>
            <header>
              <h2>{selected.title}</h2>
              <button type="button" onClick={handleSave} disabled={!dirty || saveState.kind === "saving"}>
                {saveState.kind === "saving" ? "保存中…" : "保存"}
              </button>
              <span className="save-state">
                {saveState.kind === "saved" && `已保存（backend 回读确认 · ${saveState.at}）`}
                {saveState.kind === "idle" && (dirty ? "未保存" : "")}
                {saveState.kind === "error" && `保存失败（未保存）：${saveState.message}`}
              </span>
            </header>
            <div ref={editorRef} className="editor-host" />
          </>
        )}
        {selected === null && !noteLoading && noteError === null && (
          <p className="state-empty">← 从左侧选择一篇笔记</p>
        )}
      </section>
    </div>
  );
}
