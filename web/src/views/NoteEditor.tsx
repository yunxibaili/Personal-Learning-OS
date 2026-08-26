import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";

import { useUi } from "../stores/ui";
import {
  ApiError,
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
  apiUpload,
} from "../lib/api";
import type {
  NoteDetail,
  NoteDetailResponse,
  NoteListResponse,
  NoteSummary,
  OkResponse,
  SearchResponse,
} from "@shared/types/note";
import type { BacklinkItem } from "@shared/types/graph";
import { TiptapEditor } from "../components/editor/TiptapEditor";

/** M1 知识库核心：列表 + TipTap 编辑（Markdown 进出）+ 防抖自动保存 + 附件上传。 */
export function NoteEditorView() {
  const [notes, setNotes] = useState<NoteSummary[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [detail, setDetail] = useState<NoteDetail | null>(null);
  const [error, setError] = useState<string>("");
  const [saveState, setSaveState] = useState<"idle" | "dirty" | "saved">("idle");
  const [backlinks, setBacklinks] = useState<BacklinkItem[]>([]);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ note_id: number; title: string }[] | null>(null);
  const editorRef = useRef<Editor | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusNoteId = useUi((s) => s.focusNoteId);

  const refreshList = useCallback(async () => {
    const data = await apiGet<NoteListResponse>("/notes");
    setNotes(data.notes);
    return data.notes;
  }, []);

  useEffect(() => {
    refreshList().catch((e) => setError((e as ApiError).message));
  }, [refreshList]);

  const openNote = useCallback(async (id: number) => {
    setActiveId(id);
    setSaveState("idle");
    setError("");
    try {
      const data = await apiGet<NoteDetailResponse>(`/notes/${id}`);
      setDetail(data.note);
      const bl = await apiGet<{ backlinks: BacklinkItem[] }>(
        `/notes/${id}/backlinks`,
      );
      setBacklinks(bl.backlinks);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    }
  }, []);

  // 图谱视图点击笔记节点 → 跨视图打开
  useEffect(() => {
    if (focusNoteId != null) {
      void openNote(focusNoteId);
      useUi.getState().clearFocus();
    }
  }, [focusNoteId, openNote]);

  const runSearch = useCallback(async () => {
    const query = q.trim();
    if (!query) {
      setResults(null);
      return;
    }
    try {
      const d = await apiGet<SearchResponse>(
        `/search?q=${encodeURIComponent(query)}`,
      );
      setResults(d.results);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    }
  }, [q]);

  const createNote = useCallback(async () => {
    const title = window.prompt("新笔记标题：");
    if (!title?.trim()) return;
    try {
      const data = await apiPost<NoteDetailResponse>("/notes", {
        title: title.trim(),
        content_md: `# ${title.trim()}\n\n`,
      });
      await refreshList();
      await openNote(data.note.id);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    }
  }, [openNote, refreshList]);

  const deleteActive = useCallback(async () => {
    if (activeId == null || !window.confirm("删除当前笔记？文件将一并删除。")) return;
    await apiDelete<OkResponse>(`/notes/${activeId}`);
    setActiveId(null);
    setDetail(null);
    await refreshList();
  }, [activeId, refreshList]);

  // 防抖自动保存：Markdown 序列化后 PATCH，绝不落 TipTap JSON
  const scheduleSave = useCallback(
    (markdown: string) => {
      if (activeId == null) return;
      setSaveState("dirty");
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        try {
          await apiPatch<NoteDetailResponse>(`/notes/${activeId}`, {
            content_md: markdown,
          });
          setSaveState("saved");
          void refreshList();
        } catch (e) {
          setError(e instanceof ApiError ? e.message : String(e));
        }
      }, 800);
    },
    [activeId, refreshList],
  );

  const uploadAttachment = useCallback(
    async (file: File) => {
      try {
        const res = await apiUpload<{ url: string; name: string }>(
          "/attachments",
          file,
        );
        const ed = editorRef.current;
        if (!ed) return;
        if (file.type.startsWith("image/")) {
          // 官方 extension-image 节点：markdown 往返为 ![alt](src)
          ed.chain()
            .focus()
            .setImage({ src: res.url, alt: file.name })
            .run();
        } else if (file.type === "application/pdf") {
          ed.chain().focus().insertContent(`[${res.name}](${res.url})`).run();
        } else {
          setError("仅支持图片与 PDF");
        }
      } catch (e) {
        setError(e instanceof ApiError ? `${e.code}: ${e.message}` : String(e));
      }
    },
    [],
  );

  const onEditorReady = useCallback((editor: Editor) => {
    editorRef.current = editor;
  }, []);

  // 图片按钮 → 触发隐藏 input；setImage 需要 @tiptap/extension-image（待 ECR 批准后启用）
  const imageInput = useRef<HTMLInputElement>(null);

  return (
    <section className="notes-layout">
      <aside className="note-list">
        <button className="primary" onClick={createNote}>＋ 新建</button>
        <button onClick={deleteActive} disabled={activeId == null}>删除</button>
        <ul>
          {notes.map((n) => (
            <li
              key={n.id}
              className={n.id === activeId ? "active" : ""}
              onClick={() => void openNote(n.id)}
            >
              {n.title}
            </li>
          ))}
        </ul>
      </aside>

      <div className="editor-pane">
        {error && <div className="error-banner">{error}</div>}
        {detail ? (
          <>
            <div className="editor-toolbar">
              <span className="save-state">
                {saveState === "saved" ? "已保存" : saveState === "dirty" ? "保存中…" : ""}
              </span>
              <input
                className="searchbox"
                value={q}
                placeholder="全文搜索（回车）"
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void runSearch()}
              />
              <button onClick={() => void runSearch()}>搜索</button>
              <input
                ref={imageInput}
                type="file"
                accept="image/*,application/pdf"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadAttachment(f);
                  e.target.value = "";
                }}
              />
              <button onClick={() => imageInput.current?.click()}>插图/PDF</button>
            </div>
            {results !== null && (
              <ul className="search-results">
                {results.length === 0 && <li className="muted">无结果</li>}
                {results.map((s) => (
                  <li key={s.note_id}>
                    <button onClick={() => { void openNote(s.note_id); setResults(null); }}>
                      {s.title}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <TiptapEditor
              key={detail.id}
              initialMarkdown={detail.content_md}
              onChange={scheduleSave}
              onReady={onEditorReady}
            />
            {backlinks.length > 0 && (
              <div className="backlinks">
                反链（{backlinks.length}）：
                {backlinks.map((b) => (
                  <button key={b.note_id} onClick={() => void openNote(b.note_id)}>
                    {b.title}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="empty-hint">← 选择或新建一篇笔记</p>
        )}
      </div>
    </section>
  );
}
