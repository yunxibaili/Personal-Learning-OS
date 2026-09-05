import { useEffect, useRef, useState } from "react";
import { basicSetup, EditorView } from "codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { api, ApiError } from "./api/client";

// F0-IMPLEMENTATION-01 scaffold smoke：仅验证基础设施
// （CodeMirror 6 源码模式可加载 + wrapper 可真实调用 backend），
// 不是 MVP 功能。MVP 六项另行授权实现（ADR-029 §8/§14.2）。
export default function App() {
  const editorRef = useRef<HTMLDivElement>(null);
  const [health, setHealth] = useState("checking…");

  useEffect(() => {
    const view = new EditorView({
      doc: "# Open Learning OS\n\nCodeMirror 6 · Markdown source mode（scaffold smoke）",
      extensions: [basicSetup, markdown(), EditorView.lineWrapping],
      parent: editorRef.current!,
    });
    return () => view.destroy();
  }, []);

  useEffect(() => {
    api
      .get("/api/v1/health")
      .then((r) => setHealth(`OK · ${JSON.stringify(r)}`))
      .catch((e: unknown) =>
        setHealth(
          e instanceof ApiError
            ? `ApiError ${e.status} ${e.code}: ${e.message}`
            : String(e),
        ),
      );
  }, []);

  return (
    <main>
      <h1>Open Learning OS — Frontend Scaffold</h1>
      <p>
        Backend consumer smoke: <code>GET /api/v1/health</code> → {health}
      </p>
      <div ref={editorRef} />
    </main>
  );
}
