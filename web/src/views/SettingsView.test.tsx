/**
 * SettingsView 渲染冒烟（零 DOM 环境：renderToStaticMarkup）。
 *
 * 只守卫「挂载不崩 + 关键结构在位」；交互/时序逻辑由 settingsPatch.test.ts 覆盖。
 * SSR 不跑 useEffect，故此处渲染的是 loading 骨架态——这也顺带覆盖了
 * CLS 纪律：容器预留定高，不 return null。
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SettingsView } from "./SettingsView";

describe("SettingsView", () => {
  it("初始渲染不崩且带容器骨架（CLS 纪律：不 return null）", () => {
    const html = renderToStaticMarkup(<SettingsView />);
    expect(html).toContain("settings-view");
    expect(html).toContain("设置");
    expect(html).toContain("aria-busy");
  });

  it("骨架态不出现表单控件（数据未到不渲染空表单）", () => {
    const html = renderToStaticMarkup(<SettingsView />);
    expect(html).not.toContain("ui-select");
    expect(html).not.toContain("保存设置");
  });
});
