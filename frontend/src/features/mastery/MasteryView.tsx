import { useEffect, useState } from "react";
import { ApiError } from "../../api/client";
import {
  listMastery,
  listWeakConcepts,
  type MasteryEntry,
} from "../../api/mastery";

// MVP-04：最小 Mastery Consumer（ADR-029 §8 第 4 项）。
// 薄弱概念区（weak list，后端升序=最薄弱在前）+ 全量列表（后端 effective DESC）。
// effective / effective_now / dimensions 全部原样展示，前端零计算（L1）。
// 无事件提交、无答题、无轮询；next_review 等 review 字段不展示（MVP-05）。

type SectionState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "done"; entries: MasteryEntry[] }
  | { kind: "error"; message: string };

function errText(e: unknown): string {
  return e instanceof ApiError ? `${e.status} ${e.code}: ${e.message}` : String(e);
}

function fmt(n: number): string {
  return String(n);
}

function EntryRows({ entries }: { entries: MasteryEntry[] }) {
  return (
    <table className="mastery-table">
      <thead>
        <tr>
          <th>概念</th>
          <th>当前掌握度</th>
          <th>基线</th>
          <th>知识</th>
          <th>应用</th>
          <th>回忆</th>
          <th>迁移</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((m) => (
          <tr key={m.concept_id}>
            <td>{m.title}</td>
            <td>{fmt(m.effective_now)}</td>
            <td>{fmt(m.effective)}</td>
            <td>{fmt(m.dimensions.knowledge)}</td>
            <td>{fmt(m.dimensions.practice)}</td>
            <td>{fmt(m.dimensions.recall)}</td>
            <td>{fmt(m.dimensions.transfer)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function MasteryView() {
  const [weak, setWeak] = useState<SectionState>({ kind: "loading" });
  const [all, setAll] = useState<SectionState>({ kind: "loading" });

  useEffect(() => {
    listWeakConcepts()
      .then((entries) => setWeak({ kind: "done", entries }))
      .catch((e: unknown) => setWeak({ kind: "error", message: errText(e) }));
    listMastery()
      .then((entries) => setAll({ kind: "done", entries }))
      .catch((e: unknown) => setAll({ kind: "error", message: errText(e) }));
  }, []);

  return (
    <div className="mastery-layout">
      <section>
        <h2>薄弱概念</h2>
        {weak.kind === "loading" && <p className="state-loading">加载中…</p>}
        {weak.kind === "error" && <p className="state-error">薄弱列表加载失败：{weak.message}</p>}
        {weak.kind === "done" &&
          (weak.entries.length === 0 ? (
            <p className="state-empty">暂无薄弱概念（effective &gt; 0 的概念才会进入）。</p>
          ) : (
            <EntryRows entries={weak.entries} />
          ))}
      </section>
      <section>
        <h2>全部掌握度</h2>
        {all.kind === "loading" && <p className="state-loading">加载中…</p>}
        {all.kind === "error" && <p className="state-error">掌握度列表加载失败：{all.message}</p>}
        {all.kind === "done" &&
          (all.entries.length === 0 ? (
            <p className="state-empty">还没有掌握度数据——学习事件发生后这里会出现概念。</p>
          ) : (
            <EntryRows entries={all.entries} />
          ))}
      </section>
    </div>
  );
}
