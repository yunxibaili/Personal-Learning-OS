import { useEffect, useState } from "react";

import { apiGet } from "../../lib/api";
import { useUi } from "../../stores/ui";
import { Badge, Progress } from "../ui";
import { KnowledgeRadar } from "../KnowledgeRadar";
import { GalaxyMini } from "../galaxy/GalaxyCanvas";
import type { BacklinkItem } from "@shared/types/graph";
import type { NoteDetailResponse } from "@shared/types/note";
import type { HomeResponse } from "@shared/types/home";

type RailTab = "outline" | "backlinks" | "related" | "mastery" | "radar";

const TABS: Array<{ key: RailTab; label: string }> = [
  { key: "outline", label: "大纲" },
  { key: "backlinks", label: "反链" },
  { key: "related", label: "关联" },
  { key: "mastery", label: "掌握度" },
  { key: "radar", label: "雷达" },
];

interface Heading {
  level: number;
  text: string;
}

/** 从 Markdown 正文抽取标题层级（大纲数据源，编辑器硬约束：大纲在右栏不在工具栏）。 */
function parseOutline(md: string): Heading[] {
  const out: Heading[] = [];
  for (const line of (md ?? "").split("\n")) {
    const m = /^(#{1,4})\s+(.+)$/.exec(line);
    if (m) out.push({ level: m[1].length, text: m[2].trim() });
  }
  return out;
}

/**
 * 右栏上下文（Phase 2 · 320px）：大纲 / 反链 / 关联 / 掌握度。
 * 数据自取（笔记 id 变化时刷新），不经编辑器状态——两栏解耦。
 */
export function ContextRail({ activeNoteId }: { activeNoteId: number | null }) {
  const [tab, setTab] = useState<RailTab>("outline");
  const [outline, setOutline] = useState<Heading[]>([]);
  const [noteTitle, setNoteTitle] = useState<string>("");
  const [backlinks, setBacklinks] = useState<BacklinkItem[]>([]);
  const [home, setHome] = useState<HomeResponse | null>(null);
  const openNote = useUi((s) => s.openNote);
  const setActiveView = useUi((s) => s.setActiveView);
  const openTutor = useUi((s) => s.openTutor);

  useEffect(() => {
    if (activeNoteId == null) {
      setOutline([]);
      setNoteTitle("");
      setBacklinks([]);
      return;
    }
    let alive = true;
    apiGet<NoteDetailResponse>(`/notes/${activeNoteId}`)
      .then((d) => {
        if (!alive) return;
        setOutline(parseOutline(d.note.content_md));
        setNoteTitle(d.note.title);
      })
      .catch(() => { if (alive) { setOutline([]); setNoteTitle(""); } });
    apiGet<{ backlinks: BacklinkItem[] }>(`/notes/${activeNoteId}/backlinks`)
      .then((d) => { if (alive) setBacklinks(d.backlinks); })
      .catch(() => { if (alive) setBacklinks([]); });
    return () => { alive = false; };
  }, [activeNoteId]);

  useEffect(() => {
    if (tab !== "mastery" || home) return;
    apiGet<HomeResponse>("/home").then(setHome).catch(() => setHome(null));
  }, [tab, home]);

  return (
    <aside className="ctx-rail">
      <GalaxyMini activeNoteId={activeNoteId} />
      <div className="ctx-rail__tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            className={`ctx-rail__tab ${tab === t.key ? "ctx-rail__tab--active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {t.key === "backlinks" && backlinks.length > 0 && (
              <Badge tone="brand">{backlinks.length}</Badge>
            )}
          </button>
        ))}
      </div>

      <div className="ctx-rail__body">
        {tab === "outline" && (
          activeNoteId == null ? (
            <p className="ctx-rail__muted">打开一篇笔记后显示大纲</p>
          ) : outline.length === 0 ? (
            <p className="ctx-rail__muted">本文没有标题层级</p>
          ) : (
            outline.map((h, i) => (
              <div key={i} className="ctx-outline-item" style={{ paddingLeft: (h.level - 1) * 14 }}>
                <span className={`ctx-outline-dot ctx-outline-dot--h${h.level}`} />
                {h.text}
              </div>
            ))
          )
        )}

        {tab === "backlinks" && (
          activeNoteId == null ? (
            <p className="ctx-rail__muted">打开一篇笔记后显示反链</p>
          ) : backlinks.length === 0 ? (
            <p className="ctx-rail__muted">暂无反链——用 [[双链]] 建立连接</p>
          ) : (
            backlinks.map((b) => (
              <button key={`${b.note_id}`} className="ctx-link-item" onClick={() => openNote(b.note_id)}>
                {b.title ?? `笔记 ${b.note_id}`}
              </button>
            ))
          )
        )}

        {tab === "radar" && (
          activeNoteId == null ? (
            <p className="ctx-rail__muted">打开一篇笔记后显示雷达推荐</p>
          ) : (
            <KnowledgeRadar
              /* 查询词 = 笔记标题（确定性可复算；标题即笔记主题），
                 大纲首项兜底（正文无标题层级时仍可用首节名） */
              query={noteTitle || outline[0]?.text || ""}
              noteId={activeNoteId}
              onOpenNote={(id) => openNote(id)}
            />
          )
        )}

        {tab === "related" && (
          <div className="ctx-related">
            <p className="ctx-rail__muted">当前笔记的派生视图：</p>
            <button className="ctx-link-item" onClick={() => setActiveView("graph")}>知识图谱</button>
            <button className="ctx-link-item" onClick={() => setActiveView("universe")}>知识星系</button>
            <button className="ctx-link-item" onClick={() => setActiveView("mindmap")}>思维导图</button>
            {/* P8-006 入口①：Note → Explain——携带当前笔记上下文（无打开笔记则不带） */}
            <button
              className="ctx-link-item"
              onClick={() =>
                openTutor(
                  activeNoteId != null && noteTitle
                    ? { noteIds: [{ note_id: activeNoteId, title: noteTitle }], mode: "explain" }
                    : null,
                )
              }
            >
              AI Tutor{activeNoteId != null && noteTitle ? `（引用「${noteTitle}」）` : ""}
            </button>
          </div>
        )}

        {tab === "mastery" && (
          home == null ? (
            <p className="ctx-rail__muted">暂无掌握度数据</p>
          ) : (
            <>
              {home.review_due > 0 && (
                <p className="ctx-rail__muted">今日待复习 {home.review_due} 个概念</p>
              )}
              {home.weak_concepts.length === 0 && <p className="ctx-rail__muted">暂无薄弱概念</p>}
              {home.weak_concepts.map((w) => (
                <div key={w.concept_id} className="ctx-mastery-row">
                  <span className="ctx-mastery-title">{w.title}</span>
                  <Progress value={w.effective} label={`${w.title} 掌握度`} />
                  <span className="ctx-mastery-pct">{Math.round(w.effective * 100)}%</span>
                  {/* P8-006 入口③：Weak Concept → Tutor */}
                  <button
                    className="ctx-mastery-tutor"
                    title={`就「${w.title}」问 Tutor`}
                    onClick={() => openTutor({ conceptId: w.concept_id })}
                  >
                    问 Tutor
                  </button>
                </div>
              ))}
            </>
          )
        )}
      </div>
    </aside>
  );
}
