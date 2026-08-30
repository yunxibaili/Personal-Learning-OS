import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";

import { useUi } from "../stores/ui";
import { ApiError, apiDelete, apiGet, apiPatch, apiPost, apiUpload } from "../lib/api";
import type {
  NoteDetail,
  NoteDetailResponse,
  NoteListResponse,
  NoteSummary,
  OkResponse,
} from "@shared/types/note";
import { TiptapEditor } from "../components/editor/TiptapEditor";

/** M1 知识库核心：列表 + TipTap 编辑（Markdown 进出）+ 防抖自动保存 + 附件上传。 */
export function NoteEditorView() {
  const [notes, setNotes] = useState<NoteSummary[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [detail, setDetail] = useState<NoteDetail | null>(null);
  const [error, setError] = useState<string>("");
  const [saveState, setSaveState] = useState<"idle" | "dirty" | "saved">("idle");
  const editorRef = useRef<Editor | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusNoteId = useUi((s) => s.focusNoteId);
  const setActiveNoteId = useUi((s) => s.setActiveNoteId);

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
    setActiveNoteId(id);
    setSaveState("idle");
    setError("");
    try {
      const data = await apiGet<NoteDetailResponse>(`/notes/${id}`);
      setDetail(data.note);
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

  const createNote = useCallback(async () => {
    try {
      const data = await apiPost<NoteDetailResponse>("/notes", {
        title: `未命名笔记 ${new Date().toLocaleTimeString("zh-CN")}`,
        content_md: "",
      });
      await refreshList();
      await openNote(data.note.id);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    }
  }, [refreshList, openNote]);

  const deleteActive = useCallback(async () => {
    if (activeId == null) return;
    try {
      await apiDelete<OkResponse>(`/notes/${activeId}`);
      setActiveId(null);
      setActiveNoteId(null);
      setDetail(null);
      void refreshList();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    }
  }, [activeId, refreshList]);

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
          <div className="editor-reading">
            {/* 元信息行：保存态极小字下沉（编辑器硬约束 3）——写作时不该看见它 */}
            <div className="editor-meta">
              <span className={`editor-meta__save editor-meta__save--${saveState}`}>
                {saveState === "saved" ? "● 已保存" : saveState === "dirty" ? "● 保存中…" : ""}
              </span>
              <span>{detail.title}</span>
              <span>{detail.content_md.length.toLocaleString("zh-CN")} 字</span>
              <span>更新于 {detail.updated_at.slice(11, 16)}</span>
            </div>

            {/* 工具栏只放格式控件（硬约束 2）——搜索在 TopBar，雷达在右栏 */}
            <div className="editor-toolbar">
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

            <TiptapEditor
              key={detail.id}
              initialMarkdown={detail.content_md}
              onChange={scheduleSave}
              onReady={onEditorReady}
            />
          </div>
        ) : (
          <p className="empty-hint">← 选择或新建一篇笔记</p>
        )}
      </div>
    </section>
  );
}
