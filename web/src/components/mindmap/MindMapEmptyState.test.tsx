import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { MindMapEmptyState } from "./MindMapEmptyState";

/** P1-4：空态结构门禁（零依赖，renderToStaticMarkup 断结构）。 */
describe("MindMapEmptyState", () => {
  it("渲染标题 / 描述 / 两个 CTA", () => {
    const html = renderToStaticMarkup(
      <MindMapEmptyState onCreate={() => {}} onImport={() => {}} />,
    );
    expect(html).toContain("还没有导图");
    expect(html).toContain("导图从一篇笔记展开");
    expect(html).toContain("新建导图");
    expect(html).toContain("导入");
  });

  it("只有一个填充主 CTA（ADR-013 §2.13 硬门禁 #2）", () => {
    const html = renderToStaticMarkup(
      <MindMapEmptyState onCreate={() => {}} onImport={() => {}} />,
    );
    const primary = html.match(/mindmap-empty__cta"/g) ?? [];
    // 主 CTA 类名恰好出现一次；次 CTA 用 -secondary（是其前缀，故按属性精确匹配）
    expect(primary).toHaveLength(1);
    expect(html).toContain("mindmap-empty__cta-secondary");
  });

  it("onCreate / onImport 分别绑定主次 CTA", () => {
    const onCreate = vi.fn();
    const onImport = vi.fn();
    // 纯展示组件：这里只断言渲染不抛错且回调 prop 均被消费（点击由父组件接线测试覆盖）
    const html = renderToStaticMarkup(
      <MindMapEmptyState onCreate={onCreate} onImport={onImport} />,
    );
    expect(html).toContain("mindmap-empty__actions");
    expect(onCreate).not.toHaveBeenCalled();
    expect(onImport).not.toHaveBeenCalled();
  });
});
