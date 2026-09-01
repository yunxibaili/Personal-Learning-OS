/**
 * ui/visual-engine/sync-demo-html.mjs
 *
 * 把 ui/visual-engine.html（样式与结构定稿处）的
 *   1. #traceData —— 6 个示例的真实 TraceRun
 *   2. 主 <script> IIFE —— 组件渲染逻辑
 * 注入 ui/visual-engine-demo.html 的占位块。
 *
 * 为什么要脚本注入而不是手抄：
 *   定稿处只有一处。手抄会漂移，漂移后演示页演示的就不是组件了。
 *   本脚本幂等，改动 visual-engine.html 后重跑一次即可同步。
 *
 * 用法：node ui/visual-engine/sync-demo-html.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const UI = join(here, "..");
const SRC = join(UI, "visual-engine.html");
const DEMO = join(UI, "visual-engine-demo.html");

const src = readFileSync(SRC, "utf8");
let demo = readFileSync(DEMO, "utf8");

// ---------------------------------------------------------------- 1. 数据
const dataMatch = src.match(
  /<script id="traceData" type="application\/json">([\s\S]*?)<\/script>/
);
if (!dataMatch) throw new Error("源文件中找不到 #traceData");
const traceJson = dataMatch[1];

// 校验：可解析 + 6 个示例 + 全部 completed
const parsed = JSON.parse(traceJson);
const ids = Object.keys(parsed);
if (ids.length === 0) throw new Error("#traceData 为空");
for (const id of ids) {
  const run = parsed[id].run;
  if (!run || !Array.isArray(run.events)) throw new Error(`${id} 缺少 run.events`);
  if (typeof parsed[id].source !== "string") throw new Error(`${id} 缺少 source`);
}

// ------------------------------------------------------------ 2. 组件脚本
// 整段提取主 <script>（CRLF/LF 皆可）
const blockRe = /<script>\s*\(function \(\) \{[\s\S]*?\}\)\(\);\s*<\/script>/;
const blockMatch = src.match(blockRe);
if (!blockMatch) throw new Error("源文件中找不到主 <script> IIFE");
const block = blockMatch[0];
let veScript = block.slice("<script>".length, block.lastIndexOf("</script>"));

// 行尾跟随源文件，避免混合换行
const EOL = src.includes("\r\n") ? "\r\n" : "\n";

// 在初始化前导出内部符号，供演示页的「子组件分解」一节复用
const EXPORTS = [
  "  /* 导出给演示页的分解演示复用（由 sync-demo-html.mjs 注入，勿手改） */",
  "  window.__VE__ = {",
  "    DATA: DATA, EXAMPLES: EXAMPLES, BUTTONS: BUTTONS, KEY_BINDINGS: KEY_BINDINGS,",
  "    el: el, svgEl: svgEl,",
  "    nextStepIndex: nextStepIndex, canStep: canStep, stackDepth: stackDepth,",
  "    formatValue: formatValue, computeHitCounts: computeHitCounts,",
  "    inlineValuesForLine: inlineValuesForLine, changedKeys: changedKeys,",
  "    pickNumericArray: pickNumericArray, changedIndices: changedIndices,",
  "    normalizeHeights: normalizeHeights,",
  "    tokenizePython: tokenizePython, tokenizePythonLine: tokenizePythonLine,",
  "    arrayView: arrayView, frameStackView: frameStackView, generalView: generalView",
  "  };",
  "",
].join(EOL);

const anchor = "  renderBar();";
const anchorAt = veScript.lastIndexOf(anchor);
if (anchorAt === -1) throw new Error("主脚本中找不到初始化锚点 renderBar();");
veScript =
  veScript.slice(0, anchorAt) + EXPORTS + EOL + veScript.slice(anchorAt);

// ---------------------------------------------------------------- 3. 注入
function replaceBlock(html, id, next) {
  const re = new RegExp(
    '(<script id="' + id + '"[^>]*>)[\\s\\S]*?(</script>)'
  );
  if (!re.test(html)) throw new Error(`演示页中找不到 <script id="${id}">`);
  return html.replace(re, (_m, open, close) => open + next + close);
}

demo = replaceBlock(demo, "traceData", traceJson);
demo = replaceBlock(demo, "veScript", veScript);

writeFileSync(DEMO, demo, "utf8");

const totalSteps = ids.reduce((n, id) => n + parsed[id].run.events.length, 0);
console.log("已同步 ui/visual-engine-demo.html");
console.log("  示例:", ids.length, "个 ·", ids.join(", "));
console.log("  轨迹步数合计:", totalSteps);
console.log("  脚本行数:", veScript.split("\n").length);
