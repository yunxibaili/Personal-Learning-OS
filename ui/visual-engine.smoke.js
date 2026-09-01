/**
 * ui/visual-engine.html 冒烟测试（最小 DOM shim，零依赖，不引 jsdom）
 *
 * 运行：node ui/visual-engine.smoke.js
 *
 * 目的：HTML 原型无法进 vitest（没有构建步骤），但「换了数据就悄悄坏掉」是真实风险。
 * 本测试用页面内联的真实 TraceRun 驱动页面主脚本，断言 9 组渲染结果：
 * 初始渲染 / 高亮唯一性 / 步进语义 / 模板路由 / 热力通道 / 数据完整性。
 *
 * 重新生成内联数据后必须重跑本文件（见 ui/README.md「重新生成内联轨迹数据」）。
 */
const fs = require("fs");
const path = require("path");

const HTML = fs.readFileSync(
  path.join(__dirname, "visual-engine.html"),
  "utf8"
);

// ---- 最小 DOM shim ----------------------------------------------------------
class El {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.attrs = {};
    this.dataset = {};
    this.style = {};
    this._class = "";
    this._text = "";
    this.listeners = {};
    this.disabled = false;
  }
  get className() { return this._class; }
  set className(v) { this._class = v; }
  set textContent(v) { this._text = String(v); this.children = []; }
  get textContent() {
    if (this.children.length === 0) return this._text;
    return this.children.map((c) => c.textContent).join("");
  }
  set innerHTML(v) { this.children = []; this._text = ""; }
  get innerHTML() { return this.children.map((c) => c.textContent).join(""); }
  appendChild(c) { this.children.push(c); return c; }
  setAttribute(k, v) { this.attrs[k] = String(v); if (k === "class") this._class = String(v); }
  getAttribute(k) { return this.attrs[k]; }
  addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); }
  dispatch(type, ev) { (this.listeners[type] || []).forEach((fn) => fn(ev || { preventDefault() {}, target: this })); }
  scrollIntoView() {}
  getBoundingClientRect() { return { top: 0, bottom: 100, left: 0, right: 100 }; }
  focus() {}
  // 递归查找
  find(pred, acc = []) {
    if (pred(this)) acc.push(this);
    this.children.forEach((c) => c.find && c.find(pred, acc));
    return acc;
  }
  byClass(cls) { return this.find((n) => (n.className || "").split(/\s+/).includes(cls)); }
}

const IDS = ["exBar", "ve", "veTitle", "veTpl", "veStatus", "veNotice", "veFile", "veStepMeta", "veCode", "veViz", "veOut", "veToolbar", "traceData"];
const registry = {};
IDS.forEach((id) => { registry[id] = new El("div"); });

const dataMatch = HTML.match(/<script id="traceData" type="application\/json">([\s\S]*?)<\/script>/);
registry.traceData.textContent = dataMatch[1];

global.document = {
  getElementById: (id) => registry[id] || null,
  createElement: (t) => new El(t),
  createElementNS: (_ns, t) => new El(t),
  createTextNode: (t) => { const e = new El("#text"); e.textContent = t; return e; },
};

const scriptMatch = HTML.match(/<script>\r?\n\(function \(\) \{[\s\S]*?\}\)\(\);\r?\n<\/script>/);
if (!scriptMatch) { console.error("FAIL: 主脚本未匹配"); process.exit(1); }

// ---- 执行页面脚本 ------------------------------------------------------------
new Function(scriptMatch[0].replace(/^<script>/, "").replace(/<\/script>$/, ""))();

// ---- 断言 --------------------------------------------------------------------
const DATA = JSON.parse(registry.traceData.textContent);
let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log("  ok   " + name); }
  else { fail++; console.log("  FAIL " + name + (extra ? " → " + extra : "")); }
}

console.log("\n[1] 初始渲染（默认示例 quicksort-basic）");
const lines = registry.veCode.children;
check("代码行数 = 源码行数(23)", lines.length === 23, "实际 " + lines.length);
check("示例切换条 6 个 chip", registry.exBar.children.length === 6, "实际 " + registry.exBar.children.length);
check("template 徽章 = ArrayView", registry.veTpl.textContent.includes("ArrayView"), registry.veTpl.textContent);
check("status 徽章 = 执行完成", registry.veStatus.textContent.includes("执行完成"), registry.veStatus.textContent);
check("标题含快速排序", registry.veTitle.textContent.includes("快速排序"), registry.veTitle.textContent);
check("工具条渲染", registry.veToolbar.children.length === 3, "实际 " + registry.veToolbar.children.length);
check("步号 = 第 1 / 100 步", registry.veStepMeta.textContent === "第 1 / 100 步", registry.veStepMeta.textContent);
// 第 1 步停在模块第 1 行，作用域内还没有数组 → 应显示空态而非崩溃（定高，不塌陷）
check("首步无数组 → 空态", registry.veViz.byClass("ve-viz__empty").length === 1, registry.veViz.textContent.slice(0, 40));

console.log("\n[2] 高亮唯一性（每步有且仅有一行 active）");
function activeCount() { return registry.veCode.byClass("ve-line--active").length; }
check("初始 active 行 = 1", activeCount() === 1, "实际 " + activeCount());

console.log("\n[3] 步进：↓ 单步进入");
for (let i = 0; i < 5; i++) registry.ve.dispatch("keydown", { key: "ArrowDown", target: registry.ve, preventDefault() {} });
check("步号推进到第 6 步", registry.veStepMeta.textContent === "第 6 / 100 步", registry.veStepMeta.textContent);
check("步进后 active 行仍唯一", activeCount() === 1, "实际 " + activeCount());
const bars = registry.veViz.byClass("ve-bar");
check("数组赋值后 ArrayView 出条形图(7 根)", bars.length === 7, "bars=" + bars.length);
const svgLabel = (registry.veViz.byClass("ve-array__svg")[0] || { attrs: {} }).attrs["aria-label"] || "";
check("条形图 aria-label 描述数组", svgLabel.startsWith("数组 ") && svgLabel.includes("38"), svgLabel);

console.log("\n[4] 步进：→ 单步跳过（栈深不增）");
const depthBefore = Number((registry.veToolbar.textContent.match(/栈深 (\d+)/) || [])[1]);
registry.ve.dispatch("keydown", { key: "ArrowRight", target: registry.ve, preventDefault() {} });
const depthAfter = Number((registry.veToolbar.textContent.match(/栈深 (\d+)/) || [])[1]);
check("Step Over 后栈深 ≤ 之前", depthAfter <= depthBefore, depthBefore + " → " + depthAfter);

console.log("\n[5] 步进：Space 继续 → 末步；← 上一步；R 重新开始");
registry.ve.dispatch("keydown", { key: " ", target: registry.ve, preventDefault() {} });
check("继续到末步 100", registry.veStepMeta.textContent === "第 100 / 100 步", registry.veStepMeta.textContent);
check("末步输出非空（After: 已打印）", registry.veOut.textContent.includes("After:"), registry.veOut.textContent.slice(0, 80));
registry.ve.dispatch("keydown", { key: "ArrowLeft", target: registry.ve, preventDefault() {} });
check("上一步回到 99", registry.veStepMeta.textContent === "第 99 / 100 步", registry.veStepMeta.textContent);
registry.ve.dispatch("keydown", { key: "r", target: registry.ve, preventDefault() {} });
check("重新开始回到第 1 步", registry.veStepMeta.textContent === "第 1 / 100 步", registry.veStepMeta.textContent);

console.log("\n[6] 切换示例：factorial（FrameStackView）");
const chips = registry.exBar.children;
const factorialChip = chips.find((c) => c.textContent.includes("阶乘递归"));
factorialChip.dispatch("click");
check("代码行数 = 12", registry.veCode.children.length === 12, "实际 " + registry.veCode.children.length);
check("template = FrameStackView", registry.veTpl.textContent.includes("FrameStackView"), registry.veTpl.textContent);
check("步号重置为第 1 / 25 步", registry.veStepMeta.textContent === "第 1 / 25 步", registry.veStepMeta.textContent);
// 步进到递归最深的一步（factorial 第 13 步栈深 5）
for (let i = 0; i < 12; i++) registry.ve.dispatch("keydown", { key: "ArrowDown", target: registry.ve, preventDefault() {} });
const frames = registry.veViz.byClass("ve-frame");
check("递归栈渲染 5 帧", frames.length === 5, "实际 " + frames.length);
check("栈顶帧带 ve-frame--top", registry.veViz.byClass("ve-frame--top").length === 1, "实际 " + registry.veViz.byClass("ve-frame--top").length);
const depth = Number((registry.veToolbar.textContent.match(/栈深 (\d+)/) || [])[1]);
check("栈深显示 5", depth === 5, "实际 " + depth);

console.log("\n[7] 切换示例：linear-search（GeneralView）");
registry.exBar.children.find((c) => c.textContent.includes("线性查找")).dispatch("click");
check("template = GeneralView", registry.veTpl.textContent.includes("GeneralView"), registry.veTpl.textContent);
check("渲染帧卡片", registry.veViz.byClass("ve-frame").length > 0, "frames=" + registry.veViz.byClass("ve-frame").length);

console.log("\n[8] 热力通道：gutter 竖条透明度随执行次数递增");
registry.exBar.children.find((c) => c.textContent.includes("阶乘递归")).dispatch("click");
for (let i = 0; i < 24; i++) registry.ve.dispatch("keydown", { key: "ArrowDown", target: registry.ve, preventDefault() {} });
const heats = registry.veCode.children.map((l) => {
  const h = l.byClass("ve-line__heat")[0];
  return h ? parseFloat(h.style.opacity || "0") : -1;
});
check("存在执行过的行(opacity>0)", heats.some((v) => v > 0), heats.join(","));
check("未执行行 opacity=0", heats.some((v) => v === 0), heats.join(","));
check("最大 opacity ≤ 1", Math.max(...heats) <= 1, String(Math.max(...heats)));

console.log("\n[9] 数据完整性：6 个示例全部 completed");
Object.entries(DATA).forEach(([id, v]) => {
  check(id + " status=completed", v.run.status === "completed", v.run.status);
});
check("TraceRun 顶层字段齐备", Object.values(DATA).every((v) =>
  ["version", "language", "events", "status", "metadata"].every((k) => k in v.run)), "");

console.log("\n==== " + pass + " passed / " + fail + " failed ====");
process.exit(fail === 0 ? 0 : 1);
