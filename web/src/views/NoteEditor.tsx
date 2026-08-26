import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";

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
    const data = await apiGet<NoteDetailResponse>(`/notes/${id}`);
    setDetail(data.note);
  }, []);

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
        // 图片节点需 @tiptap/extension-image（ECR 待批）；PDF 以链接形式插入
        if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
          setError("仅支持图片与 PDF");
          return;
        }
        const res = await apiUpload<{ url: string; name: string }>(
          "/attachments",
          file,
        );
        const ed = editorRef.current;
        if (!ed) return;
        if (file.type === "application/pdf") {
          ed.chain().focus().insertContent(`[${res.name}](${res.url})`).run();
        } else {
          setError("图片内嵌渲染将在 @tiptap/extension-image 审批后启用；附件已上传: " + res.url);
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
          </>
        ) : (
          <p className="empty-hint">← 选择或新建一篇笔记</p>
        )}
      </div>
    </section>
  );
}
