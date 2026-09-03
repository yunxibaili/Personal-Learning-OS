import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";

import { useUi } from "../stores/ui";
import { ApiError, apiDelete, apiGet, apiPatch, apiPost, apiUpload } from "../lib/api";
import { displayNoteTitle } from "../lib/noteTitle";
import type {
  NoteCreateBody,
  NoteDetail,
  NoteDetailResponse,
  NoteSummary,
  OkResponse,
} from "@shared/types/note";
import type { NoteTreeNode, NoteTreeResponse } from "@shared/types/note";
import { loadCollapsed, mergeSubtree, saveCollapsed } from "../components/notes/treeView";
import { Skeleton, useToast } from "../components/ui";

// 编辑器（TipTap/ProseMirror/KaTeX 全家桶 ~800kB）按需加载（BUG-4 代码分割）：
// 首帧先渲染「选择笔记」骨架与列表，选中之/后台预取后再挂编辑器。
// 挂载即 warmup 预取 chunk：首个笔记打开前 chunk 多半已就绪，体感无延迟。
const TiptapEditor = lazy(() =>
  import("../components/editor/TiptapEditor").then((m) => ({ default: m.TiptapEditor })),
);

/**
 * 编辑器 chunk 未就绪时的骨架（Suspense fallback）。
 * 形状对齐真实编辑器：标题条 + 4 行正文、末行留短——一眼看出是「一段文字」，不是空白。
 * 容器定高（CLS 铁律）：异步内容不 return null，也不让高度随 chunk 到达而跳变。
 * Skeleton 是 aria-hidden，故补 sr-only 文案给读屏用户。
 */
function EditorSkeleton() {
  return (
    <div className="editor-skeleton">
      <span className="sr-only">编辑器加载中…</span>
      <Skeleton height={26} width="46%" />
      <Skeleton height={14} width="94%" />
      <Skeleton height={14} width="88%" />
      <Skeleton height={14} width="91%" />
      <Skeleton height={14} width="62%" />
    </div>
  );
}

/**
 * ADR-026 T2：左栏层级树节点行（文件夹心智）。
 * 数据来自 /notes/tree（后端剪枝）；有 children 或 truncated 的节点显示可点箭头，
 * 折叠偏好持久化；truncated 且展开时显示「…」懒加载入口（守护：无更深层则不出现）。
 */
function NoteTreeList(props: {
  nodes: NoteTreeNode[];
  activeId: number | null;
  onOpen: (id: number) => void;
  onCreateChild: (parent: NoteSummary) => void;
  collapsedIds: Set<number>;
  onToggle: (id: number) => void;
  onLoadMore: (node: NoteTreeNode) => void;
  loadingMore: number | null;
  depth?: number;
}) {
  const {
    nodes, activeId, onOpen, onCreateChild,
    collapsedIds, onToggle, onLoadMore, loadingMore, depth = 0,
  } = props;
  return (
    <ul className={depth === 0 ? undefined : "note-tree__children"}>
      {nodes.map((node) => {
        const expandable = node.children.length > 0 || node.truncated;
        const isCollapsed = collapsedIds.has(node.note.id);
        // P1-2：占位/空/纯 ID 标题降级展示（纯展示层，title 真值不变）
        const title = displayNoteTitle(node.note.title, node.note.id);
        return (
          <li key={node.note.id}>
            <div
              className={`note-tree__row${node.note.id === activeId ? " active" : ""}`}
              onClick={() => onOpen(node.note.id)}
            >
              {expandable ? (
                <button
                  type="button"
                  className="note-tree__toggle"
                  aria-expanded={!isCollapsed}
                  aria-label={`${isCollapsed ? "展开" : "折叠"}「${title}」`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggle(node.note.id);
                  }}
                >
                  {isCollapsed ? "▸" : "▾"}
                </button>
              ) : (
                <span className="note-tree__leaf" aria-hidden="true" />
              )}
              <span className="note-tree__title" title={title}>
                {title}
              </span>
              <button
                type="button"
                className="note-tree__add-child"
                title={`在「${title}」下新建副笔记`}
                aria-label={`在「${title}」下新建副笔记`}
                onClick={(e) => {
                  e.stopPropagation();
                  onCreateChild(node.note);
                }}
              >
                ＋
              </button>
            </div>
            {node.children.length > 0 && !isCollapsed && (
              <NoteTreeList
                nodes={node.children}
                activeId={activeId}
                onOpen={onOpen}
                onCreateChild={onCreateChild}
                collapsedIds={collapsedIds}
                onToggle={onToggle}
                onLoadMore={onLoadMore}
                loadingMore={loadingMore}
                depth={depth + 1}
              />
            )}
            {node.truncated && !isCollapsed && (
              <button
                type="button"
                className="note-tree__more"
                disabled={loadingMore === node.note.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onLoadMore(node);
                }}
              >
                {loadingMore === node.note.id ? "加载中…" : "…更多子层级"}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** M1 知识库核心：列表 + TipTap 编辑（Markdown 进出）+ 防抖自动保存 + 附件上传。 */
export function NoteEditorView() {
  // ADR-026 T2：左栏树数据源 = /notes/tree?depth=3（后端剪枝 + 懒加载）。
  // null = 加载中（骨架占位，CLS 铁律：不定高会顶跳布局）
  const [tree, setTree] = useState<NoteTreeNode[] | null>(null);
  // 折叠偏好：存「被用户显式折叠」的 id（默认全展开；新笔记/懒加载节点天然展开）
  const [collapsedIds, setCollapsedIds] = useState<Set<number>>(() => loadCollapsed());
  const [loadingMore, setLoadingMore] = useState<number | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [detail, setDetail] = useState<NoteDetail | null>(null);
  const [error, setError] = useState<string>("");
  const [saveState, setSaveState] = useState<"idle" | "dirty" | "saved">("idle");
  const editorRef = useRef<Editor | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusNoteId = useUi((s) => s.focusNoteId);
  const setActiveNoteId = useUi((s) => s.setActiveNoteId);
  const toast = useToast();

  const refreshTree = useCallback(async () => {
    const data = await apiGet<NoteTreeResponse>("/notes/tree?depth=3");
    setTree(data.trees);
  }, []);

  useEffect(() => {
    refreshTree().catch((e) => setError((e as ApiError).message));
  }, [refreshTree]);

  // 折叠/展开（偏好持久化，刷新不丢——ADR-026 §3.3）
  const toggleCollapse = useCallback((id: number) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveCollapsed(next);
      return next;
    });
  }, []);

  // 懒加载：展开被剪枝的子树（ADR-026 §3.1：root_id + depth，无产品硬上限）
  const loadSubtree = useCallback(
    async (node: NoteTreeNode) => {
      if (loadingMore != null) return;
      setLoadingMore(node.note.id);
      try {
        const data = await apiGet<NoteTreeResponse>(
          `/notes/tree?root_id=${node.note.id}&depth=3`,
        );
        setTree((cur) => (cur ? mergeSubtree(cur, node.note.id, data.trees[0]) : cur));
      } catch (e) {
        setError(e instanceof ApiError ? e.message : String(e));
      } finally {
        setLoadingMore(null);
      }
    },
    [loadingMore],
  );

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

  const createNote = useCallback(
    async (parent?: NoteSummary) => {
      try {
        const payload: NoteCreateBody = {
          title: `未命名笔记 ${new Date().toLocaleTimeString("zh-CN")}`,
          content_md: "",
        };
        // ADR-024：新建副笔记一步写 parent（后端写入 frontmatter 并镜像派生边）
        if (parent) payload.parent = parent.title;
        const data = await apiPost<NoteDetailResponse>("/notes", payload);
        await refreshTree();
        await openNote(data.note.id);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : String(e));
      }
    },
    [refreshTree, openNote],
  );

  const deleteActive = useCallback(async () => {
    if (activeId == null) return;
    try {
      await apiDelete<OkResponse>(`/notes/${activeId}`);
      setActiveId(null);
      setActiveNoteId(null);
      setDetail(null);
      void refreshTree();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    }
  }, [activeId, refreshTree]);

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
          void refreshTree();
        } catch (e) {
          const msg = e instanceof ApiError ? e.message : String(e);
          setError(msg);
          // 自动保存没有用户动作做因果锚点：用户正在打字，顶部 banner 未必被看见，
          // 而这件事的代价是丢文字——所以额外推一条 toast（瞬时）+ banner（持久）。
          // 其余失败（新建/删除/上传）都是用户主动触发，banner 就在手边，不再重复弹。
          toast.push("自动保存失败", "err", msg);
        }
      }, 800);
    },
    [activeId, refreshTree, toast],
  );

  const uploadAttachment = useCallback(    async (file: File) => {
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

  // 平铺 → 森林（ADR-024 P1-1）。parent_id 由后端 resolver 权威提供，前端不做推断。

  // 图片按钮 → 触发隐藏 input；setImage 需要 @tiptap/extension-image（待 ECR 批准后启用）
  const imageInput = useRef<HTMLInputElement>(null);

  return (
    <section className="notes-layout" aria-labelledby="notes-layout-title">
      <h1 id="notes-layout-title" className="sr-only">
        笔记工作区
      </h1>
      <aside className="note-list">
        <button className="primary" onClick={() => void createNote()}>＋ 新建</button>
        {activeId != null && (
          <button className="danger" onClick={deleteActive}>删除</button>
        )}
        {/* ADR-026 T2：层级树（数据来自 /notes/tree，经唯一 resolver；默认展开 3 层 +
            「…」懒加载 + 折叠偏好本地记忆） */}
        <div className="note-tree">
          {tree === null ? (
            <div className="note-tree__loading" role="status">
              <span className="sr-only">加载笔记树…</span>
              <Skeleton height={18} width={"82%"} />
              <Skeleton height={18} width={"70%"} />
              <Skeleton height={18} width={"76%"} />
            </div>
          ) : (
            <NoteTreeList
              nodes={tree}
              activeId={activeId}
              onOpen={(id) => void openNote(id)}
              onCreateChild={(parent) => void createNote(parent)}
              collapsedIds={collapsedIds}
              onToggle={toggleCollapse}
              onLoadMore={(node) => void loadSubtree(node)}
              loadingMore={loadingMore}
            />
          )}
        </div>
      </aside>

      <div className="editor-pane">
        {error && <div className="error-banner">{error}</div>}
        {detail ? (
          <div className="editor-reading">
            {/* D2：标题从 meta 行分离为编辑器一级视觉层级（ui/note-workspace.html 定稿） */}
            <h1 className="editor-title">{detail.title}</h1>
            {/* 元信息行：保存态极小字下沉（编辑器硬约束 3）——写作时不该看见它 */}
            <div className="editor-meta">
              <span className={`editor-meta__save editor-meta__save--${saveState}`}>
                {saveState === "saved" ? "● 已保存" : saveState === "dirty" ? "● 保存中…" : ""}
              </span>
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

            <Suspense fallback={<EditorSkeleton />}>
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
            {tree !== null && tree.length === 0 ? (
              <>
                <p className="editor-empty__title">开始你的第一篇笔记</p>
                <p className="editor-empty__sub">点上方「＋ 新建」开始写。</p>
                <button className="primary" onClick={() => void createNote()}>＋ 新建</button>
              </>
            ) : (
              /* P1-5：共享首屏空态（activeId=null 即默认首屏，也覆盖删除后 / Tutor 打开时）。
                 补唯一主 CTA「＋ 新建」——868×836 的主工作区此前没有任何动作出口，
                 唯一新建入口在左树工具栏。与第一分支完全同构的 `button.primary`
                 （样式已在 global.css:303，零新 CSS），点击仍走 createNote()。 */
              <>
                <p className="editor-empty__title">选一篇笔记开始</p>
                <p className="editor-empty__sub">从左侧选一篇笔记，或新建一篇开始写。</p>
                <button className="primary" onClick={() => void createNote()}>
                  ＋ 新建
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
