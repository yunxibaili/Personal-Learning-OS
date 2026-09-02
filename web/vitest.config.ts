import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

/**
 * 测试配置：先合入应用配置（@shared 别名、react 插件），再加测试专属项。
 *
 * `css: true` 是必需的，不是可选优化：
 * Vitest 默认 `css: false`，会把**所有** .css 导入（含 `?raw`）统一替换成空字符串
 * 以跳过 CSS 后处理。实测后果：用 import.meta.glob 以 ?raw 读 CSS，
 * 键能读到 5 个文件（含 global.css），但每个值长度都是 0 —— 于是
 * 「断言 .btn-primary 规则块内无 gradient」这类样式门禁会对着空串判定，全是假信号。
 *
 * 只在这里开，不动 vite.config.ts（那是 dev server / build 的配置，不该背测试需求）。
 */
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      css: true,
    },
  }),
);
