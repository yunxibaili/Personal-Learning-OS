import type { ReactNode } from "react";

import { TopBar } from "./TopBar";

/**
 * AppShell（Phase 2 · ui/app-shell.html + note-workspace.html）：
 * 细顶栏（64px 半透白 blur）+ 内容区。
 * 笔记优先：默认视图 = 笔记工作区（列表 240 + 编辑器 + 右栏 320），
 * 图谱/星系/导图/Tutor/复习 = 顶栏带返回的浮层态（取消平级 tab，裁决 A）。
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="shell">
      <TopBar />
      <main className="shell__content">{children}</main>
    </div>
  );
}
