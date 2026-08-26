import "katex/dist/katex.min.css";

import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect } from "react";
import { MathExtension } from "@aarkue/tiptap-math-extension";
import { Markdown } from "tiptap-markdown";

/**
 * TipTap 编辑器适配层：Markdown 进 / Markdown 出。
 * 数据真相永远是 vault 的 .md 文件；本组件不持久化任何 TipTap JSON（REGISTRY 边界）。
 */
interface Props {
  initialMarkdown: string;
  onChange: (markdown: string) => void;
  onReady?: (editor: Editor) => void;
}

export function TiptapEditor({ initialMarkdown, onChange, onReady }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Markdown.configure({ html: false, linkify: true }),
      MathExtension,
    ],
    content: initialMarkdown,
    onUpdate: ({ editor }) => {
      const storage = editor.storage as Record<string, any>;
      onChange(storage.markdown.getMarkdown());
    },
    onCreate: ({ editor }) => onReady?.(editor),
  });

  // 外部切换笔记时整体替换内容（父组件以 key={note.id} 重挂载为主通道）
  useEffect(() => {
    if (editor) {
      editor.commands.setContent(initialMarkdown);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMarkdown]);

  return <EditorContent editor={editor} className="tiptap" />;
}
