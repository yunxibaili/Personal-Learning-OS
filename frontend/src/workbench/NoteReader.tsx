import { useMemo, useState, useEffect, useRef } from "react";
import { Icon } from "../components/icons/Icon";
import { WorkState } from "./states";
import { Button } from "../components/ui/Button";
import type { NoteDetail } from "../api/notes";

type Block =
  | { t: "h"; level: number; text: string }
  | { t: "p"; text: string }
  | { t: "ul"; items: string[] }
  | { t: "quote"; text: string }
  | { t: "code"; text: string }
  | { t: "img"; alt: string }
  | { t: "hr" };

function parseBlocks(mdRaw: string): Block[] {
  const md = mdRaw.split("\\[").join("[").split("\\]").join("]");
  const lines = md.split("\n");
  const blocks: Block[] = [];
  let i = 0;
  let para: string[] = [];
  const flush = () => {
    if (para.length) { blocks.push({ t: "p", text: para.join("\n") }); para = []; }
  };
  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line)) {
      flush();
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++; }
      i++;
      blocks.push({ t: "code", text: buf.join("\n") });
      continue;
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) { flush(); blocks.push({ t: "h", level: h[1].length, text: h[2] }); i++; continue; }
    if (/^\s*[-*]\s+/.test(line)) {
      flush();
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      blocks.push({ t: "ul", items });
      continue;
    }
    if (/^>\s?/.test(line)) {
      flush();
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, "")); i++; }
      blocks.push({ t: "quote", text: buf.join("\n") });
      continue;
    }
    const img = /^!\[([^\]]*)\]\(([^)]*)\)\s*$/.exec(line.trim());
    if (img) { flush(); blocks.push({ t: "img", alt: img[1] || "图片" }); i++; continue; }
    if (/^---+\s*$/.test(line)) { flush(); blocks.push({ t: "hr" }); i++; continue; }
    if (line.trim() === "") { flush(); i++; continue; }
    para.push(line);
    i++;
  }
  flush();
  return blocks;
}

/** 行内渲染：**bold** · `code` · [[链接]] */
function Inline({ text: raw, onLink }: { text: string; onLink: (title: string, el: HTMLElement) => void }) {
  const parts = useMemo(() => {
    const text = raw.split("\\[").join("[").split("\\]").join("]");
    const out: Array<{ k: "text" | "link" | "bold" | "code"; v: string }> = [];
    const re = /\[\[([^\]]+)\]\]|\*\*([^*]+)\*\*|`([^`]+)`/g;
    let last = 0;
    for (const m of text.matchAll(re)) {
      if (m.index > last) out.push({ k: "text", v: text.slice(last, m.index) });
      if (m[1] !== undefined) out.push({ k: "link", v: m[1] });
      else if (m[2] !== undefined) out.push({ k: "bold", v: m[2] });
      else out.push({ k: "code", v: m[3] });
      last = m.index + m[0].length;
    }
    if (last < text.length) out.push({ k: "text", v: text.slice(last) });
    return out;
  }, [raw]);
  return (
    <>
      {parts.map((p, i) => {
        if (p.k === "link") return <button key={i} type="button" className="wb-link" onClick={(e) => onLink(p.v, e.currentTarget)}>{p.v}</button>;
        if (p.k === "bold") return <strong key={i}>{p.v}</strong>;
        if (p.k === "code") return <code key={i} style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-code)", background: "var(--color-surface-sunken)", borderRadius: "var(--radius-xs)", padding: "0 4px" }}>{p.v}</code>;
        return <span key={i}>{p.v}</span>;
      })}
    </>
  );
}

/* ── NoteReader：阅读环境 ─────────────────────────────────── */
export function NoteReader({ note, onLink, onAnnotate }: {
  note: NoteDetail;
  onLink: (title: string, el: HTMLElement) => void;
  onAnnotate: (quote: string) => void;
}) {
  const blocks = useMemo(() => parseBlocks(note.content_md), [note.content_md]);
  const [bubble, setBubble] = useState<{ x: number; y: number; quote: string } | null>(null);
  const [findOpen, setFindOpen] = useState(false);
  const [findQ, setFindQ] = useState("");
  const findInputRef = useRef<HTMLInputElement>(null);
  const matchCount = useMemo(
    () => (findQ ? note.content_md.split(findQ).length - 1 : 0),
    [findQ, note.content_md],
  );

  // ⌘F 行内查找（L3 Document Find）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setFindOpen(true);
        window.setTimeout(() => findInputRef.current?.focus(), 30);
      }
      if (e.key === "Escape" && findOpen) { setFindOpen(false); setFindQ(""); }
    };
    const openFind = () => { setFindOpen(true); window.setTimeout(() => findInputRef.current?.focus(), 30); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("wb-find", openFind);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("wb-find", openFind); };
  }, [findOpen]);

  const onMouseUp = () => {
    const sel = window.getSelection();
    const text = sel?.toString().trim() ?? "";
    if (sel && text.length > 1 && !sel.isCollapsed) {
      const range = sel.getRangeAt(0).getBoundingClientRect();
      setBubble({ x: range.left + range.width / 2, y: range.bottom + 6, quote: text.slice(0, 200) });
    } else {
      setBubble(null);
    }
  };

  const renderInline = (text: string) => <Inline text={text} onLink={onLink} />;

  return (
    <div className="wb-reader" onMouseUp={onMouseUp}>
      {findOpen && (
        <div className="wb-find">
          <Icon name="search" size={14} />
          <input
            ref={findInputRef}
            placeholder="在本文档中查找…"
            value={findQ}
            onChange={(e) => setFindQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && findQ) {
                try { (window as unknown as { find: (s: string) => boolean }).find(findQ); } catch { /* 非 Chromium 忽略 */ }
              }
            }}
          />
          <span className="t-caption">{findQ ? `${matchCount} 个匹配` : "⌘F"}</span>
          <button type="button" className="icon-btn" style={{ width: 22, height: 22 }} aria-label="关闭查找" onClick={() => { setFindOpen(false); setFindQ(""); }}>
            <Icon name="close" size={12} />
          </button>
        </div>
      )}
      <h1>{note.title}</h1>
      <div className="wb-meta">
        <span>{new Date(note.updated_at).toLocaleDateString("zh-CN")}</span>
        {note.tags.slice(0, 3).map((t) => <span key={t}>#{t}</span>)}
      </div>
      {blocks.map((b, i) => {
        switch (b.t) {
          case "h":
            return b.level === 1
              ? <h2 key={i}>{renderInline(b.text)}</h2>
              : <h3 key={i}>{renderInline(b.text)}</h3>;
          case "p":
            return <p key={i}>{renderInline(b.text)}</p>;
          case "ul":
            return (
              <ul key={i}>
                {b.items.map((it, j) => <li key={j}>{renderInline(it)}</li>)}
              </ul>
            );
          case "quote":
            return <blockquote key={i}><p style={{ margin: 0, fontSize: "var(--text-reading)", lineHeight: "var(--lh-reading)" }}>{renderInline(b.text)}</p></blockquote>;
          case "code":
            return <pre key={i}><code>{b.text}</code></pre>;
          case "img":
            return <span key={i} className="wb-img"><Icon name="notes" size={12} />{b.alt || "图片"}（尚未支持内嵌）</span>;
          case "hr":
            return <hr key={i} className="wb-hr" />;
          default:
            return null;
        }
      })}
      {blocks.length === 0 && <WorkState kind="empty" title="空笔记" hint="写下第一段。" />}
      {bubble && (
        <div className="wb-bubble" style={{ left: bubble.x, top: bubble.y }}>
          <Button size="sm" prominence="plain" onClick={() => { onAnnotate(bubble.quote); setBubble(null); }}>标注</Button>
          <Button size="sm" prominence="plain" onClick={() => { navigator.clipboard?.writeText(bubble.quote); setBubble(null); }}>复制</Button>
        </div>
      )}
    </div>
  );
}

