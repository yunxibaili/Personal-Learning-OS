import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ToastProvider } from "../components/ui";

import { NoteEditorView } from "./NoteEditor";

/**
 * P1-5：共享首屏空态（未选中笔记）结构门禁。
 *
 * 手法：零依赖 `renderToStaticMarkup`（与 MindMapEmptyState.test.tsx 一致）。
 * `tree` 初值为 null → 静态渲染（不跑 useEffect）落在第二分支（未选中笔记空态）。
 * NoteEditor 用 useToast()，需 ToastProvider 包裹。
 */
describe("NoteEditor 空态（未选中笔记）", () => {
  it("渲染空态 + 唯一主 CTA「＋ 新建」", () => {
    const html = renderToStaticMarkup(
      <ToastProvider>
        <NoteEditorView />
      </ToastProvider>,
    );
    expect(html).toContain("editor-empty");
    expect(html).toContain("选一篇笔记开始");
    expect(html).toContain("＋ 新建");
    // 唯一主 CTA（ADR-013 §2.13 硬门禁 #2 是「**卡内** button 数 = 1」）：
    // 左树工具栏「＋ 新建」同为 .primary（页面级、不在空态卡内），故断言限定在
    // .editor-empty 块内部——该块内无嵌套 div，取到第一个 </div> 即为卡片结尾。
    const card = html.match(/<div class="editor-empty">([\s\S]*?)<\/div>/);
    expect(card).not.toBeNull();
    const primaryInCard = (card?.[1] ?? "").match(/class="primary"/g) ?? [];
    expect(primaryInCard).toHaveLength(1);
  });

  it("不走 onboarding 分支（vault 为空时的文案不出现）", () => {
    const html = renderToStaticMarkup(
      <ToastProvider>
        <NoteEditorView />
      </ToastProvider>,
    );
    expect(html).not.toContain("开始你的第一篇笔记");
  });
});
