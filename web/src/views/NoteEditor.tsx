import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
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

// 编辑器（TipTap/ProseMirror/KaTeX 全家桶 ~800kB）按需加载（BUG-4 代码分割）：
// 首帧先渲染「选择笔记」骨架与列表，选中之/后台预取后再挂编辑器。
// 挂载即 warmup 预取 chunk：首个笔记打开前 chunk 多半已就绪，体感无延迟。
const TiptapEditor = lazy(() =>
  import("../components/editor/TiptapEditor").then((m) => ({ default: m.TiptapEditor })),
);

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

  // 编辑器 chunk 预取（配合 lazy 分包）：视图挂载即后台拉取，
  // 用户点开第一篇笔记前 chunk 基本已就绪——分割收益（首屏不含 800kB 编辑器）
  // 与打开体感两全。
  useEffect(() => {
    void import("../components/editor/TiptapEditor");
  }, []);

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
    <section className="notes-layout" aria-labelledby="notes-layout-title">
      <h1 id="notes-layout-title" className="sr-only">
        笔记工作区
      </h1>
      <aside className="note-list">
        <button className="primary" onClick={createNote}>＋ 新建</button>
        {activeId != null && (
          <button className="danger" onClick={deleteActive}>删除</button>
        )}
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

            <Suspense
                fallback={<div className="tutor-answer empty-hint">编辑器加载中…</div>}
              >
              <TiptapEditor
                key={detail.id}
                initialMarkdown={detail.content_md}
                onChange={scheduleSave}
                onReady={onEditorReady}
              />
            </Suspense>
          </div>
        ) : (
          <div className="editor-empty">
            {notes.length === 0 ? (
              <>
                <p className="editor-empty__title">开始你的第一篇笔记</p>
                <p className="editor-empty__sub">点上方「＋ 新建」开始写。</p>
                <button className="primary" onClick={createNote}>＋ 新建</button>
              </>
            ) : (
              <>
                <p className="editor-empty__title">选一篇笔记开始</p>
                <p className="editor-empty__sub">从左侧选，或点「＋ 新建」开新的。</p>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
