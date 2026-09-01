/**
 * ui/empty-states.html 冒烟测试（最小 DOM shim，零依赖，不引 jsdom）
 *
 * 运行：node ui/empty-states.smoke.js
 *
 * 目的：HTML 原型进不了 vitest（没有构建步骤），但空态规范页有两个「改着改着就坏了」
 * 的真实风险：
 *   1. 门禁 2 被破 —— 有人往允许落点的卡里加了第二个按钮（聚光引导失去唯一出口）
 *   2. 聚光实现跑偏 —— 节流被删、坐标直写 style、开关失效
 *
 * 本测试分两段：
 *   A. 静态断言（结构 / 判定统计 / 约束数值 / 令牌是否都定义过）
 *   B. 执行页面内联脚本，断言聚光节流与「可撤销」开关
 */
const fs = require("fs");
const path = require("path");

const HTML = fs.readFileSync(path.join(__dirname, "empty-states.html"), "utf8");
const TOKENS = fs.readFileSync(path.join(__dirname, "tokens.css"), "utf8");
// 断言一律基于去注释后的文本 —— 否则「无 backdrop-filter」会被注释里那句
// 「约束 ADR-013：无 backdrop-filter」自己命中。
const SRC = HTML.replace(/<!--[\s\S]*?-->/g, "").replace(/\/\*[\s\S]*?\*\//g, "");

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log("  ok   " + name); }
  else { fail++; console.log("  FAIL " + name + (extra ? " → " + extra : "")); }
}
function group(t) { console.log("\n" + t); }

// ============================================================================
// A. 静态断言
// ============================================================================

group("[A1] 页面骨架");
check("引用 tokens.css（不写裸色值）", /<link rel="stylesheet" href="\.\/tokens\.css">/.test(SRC));
check("无 backdrop-filter（ADR-013 §2.7）", !/backdrop-filter/.test(SRC));
check("无外部依赖（无 http(s) 资源引用）", !/(src|href)="https?:\/\//.test(SRC));
check("<style> 全部在 head（body 内无 style）", !/<body>[\s\S]*?<style>/.test(SRC));

group("[A2] 空态审计表完整性");
// 只统计审计表本体（legend 与动效基元表里也有 tag，不能混进来）
const auditBody = (SRC.match(/<tbody id="audit-body">([\s\S]*?)<\/tbody>/) || [])[1] || "";
const auditRows = (auditBody.match(/<tr>\s*<td>\d+<\/td>/g) || []).length;
check("审计表 12 行", auditRows === 12, "实际 " + auditRows);

const tagOk = (auditBody.match(/tag tag--ok"/g) || []).length;
const tagWarn = (auditBody.match(/tag tag--warn"/g) || []).length;
const tagNo = (auditBody.match(/tag tag--no"/g) || []).length;
check("允许 = 1（首篇笔记 onboarding）", tagOk === 1, "实际 " + tagOk);
check("补条件后允许 = 4（星系空 / 星系错误 / 导图空 / 复习临界）", tagWarn === 4, "实际 " + tagWarn);
check("禁止 = 7（含 3 处加载态）", tagNo === 7, "实际 " + tagNo);
check("判定徽标总数 = 12", tagOk + tagWarn + tagNo === 12, "实际 " + (tagOk + tagWarn + tagNo));

group("[A3] 门禁 2 —— 允许落点卡内 button 数 = 1");
// 从 HTML 里抓出每张 stage 卡，统计其内部 button 数
const allArticles = SRC.match(/<article class="sl[^"]*" data-slot="[^"]+">[\s\S]*?<\/article>/g) || [];
const articles = allArticles.filter((a) => !/class="sl sl--bad"/.test(a));
const badArticles = allArticles.filter((a) => /class="sl sl--bad"/.test(a));
const slots = {};
articles.forEach((a) => {
  const slot = (a.match(/data-slot="([^"]+)"/) || [])[1];
  slots[slot] = (a.match(/<button/g) || []).length;
});
const allowed = ["onboarding", "galaxy-empty", "galaxy-error", "mindmap-empty"];
check("允许落点卡共 4 张", articles.length === 4, "实际 " + articles.length);
allowed.forEach((s) => {
  check("允许落点 " + s + " 卡内 button = 1", slots[s] === 1, "实际 " + slots[s]);
});
check("反例卡共 2 张", badArticles.length === 2, "实际 " + badArticles.length);
badArticles.forEach((a) => {
  const slot = (a.match(/data-slot="([^"]+)"/) || [])[1];
  check("反例卡 " + slot + " 卡内 button = 0", (a.match(/<button/g) || []).length === 0);
});
check("反例卡带 sl--bad（聚光强制关闭）", /\.sl--bad::before\s*\{\s*content:\s*none/.test(SRC));

group("[A4] 聚光实现约束（ADR-013 §2.13）");
// ⚠️ 用 \s+ 而非 \s*：规范表里也写了 `rgba(255,107,53,.13)`（无空格）作说明，
//    若用 \s* 则「CSS 改坏了、但表格里还写着旧值」时断言照样通过 —— 守护失效。
//    要求至少一个空格 + CSS 里那个尾随逗号，才能确保命中的是真实规则而非文档正文。
check("聚光强度 中心 .13", /rgba\(255,\s+107,\s+53,\s+\.13\),/.test(SRC));
check("聚光强度 38% 处 .04 / 62% 全透明",
  /rgba\(255,\s+107,\s+53,\s+\.04\)\s+38%/.test(SRC) && /transparent\s+62%/.test(SRC));
check("半径 320px（普通卡）", /320px circle at/.test(SRC));
check("半径 460px（大号卡）", /460px circle at/.test(SRC));
check("过渡只用 opacity 且 ≤ --dur(250ms)", /transition:\s*opacity var\(--dur\)/.test(SRC));
check("media query 包裹 (hover:hover) and (prefers-reduced-motion:no-preference)",
  /@media \(hover: hover\) and \(prefers-reduced-motion: no-preference\)/.test(SRC));
check("聚光层 pointer-events:none", /z-index: 0; pointer-events: none;/.test(SRC));
check("CTA 用 --brand-deep（非 --brand，白字 4.13:1）",
  /\.sl__cta\s*\{[\s\S]*?background:\s*var\(--brand-deep\);\s*color:\s*var\(--text-inv\)/.test(SRC));
check("容器 contain: layout paint（P8-001C）", /contain:\s*layout paint/.test(SRC));

group("[A5] Skeleton 落点");
const skelCards = (HTML.match(/class="skel-card"/g) || []).length;
check("Skeleton 演示 4 张（3 处真实加载态 + 1 处建议）", skelCards === 4, "实际 " + skelCards);
check("shimmer 动画包在 prefers-reduced-motion: no-preference 内",
  /@media \(prefers-reduced-motion: no-preference\)\s*\{\s*\.skel::after/.test(SRC));

group("[A6] 令牌合规 —— 所有 var(--x) 都在 tokens.css 定义过");
// --mx/--my 是聚光跟随的运行时坐标，不是设计令牌，且都带 var(--x, 50%) 兜底
const RUNTIME_PROPS = new Set(["--mx", "--my"]);
const used = new Set();
const re = /var\((--[a-z0-9-]+)/g;
let m;
while ((m = re.exec(SRC)) !== null) if (!RUNTIME_PROPS.has(m[1])) used.add(m[1]);
const undef = [...used].filter((t) => !new RegExp("^\\s*" + t + "\\s*:", "m").test(TOKENS));
check("全部 " + used.size + " 个设计令牌均已定义", undef.length === 0, "未定义：" + undef.join(", "));
check("--mx/--my 带兜底值（不依赖 JS 才可见）", /var\(--mx,\s*50%\)/.test(SRC) && /var\(--my,\s*50%\)/.test(SRC));

// ============================================================================
// B. 执行页面脚本 —— 聚光节流与可撤销开关
// ============================================================================

group("[B1] 最小 DOM shim 就绪");

class Style {
  constructor() { this.props = {}; }
  setProperty(k, v) { this.props[k] = String(v); }
  removeProperty(k) { delete this.props[k]; }
  getPropertyValue(k) { return this.props[k] || ""; }
}

class El {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.attrs = {};
    this.style = new Style();
    this._class = "";
    this.listeners = {};
  }
  get className() { return this._class; }
  set className(v) { this._class = String(v); }
  get classList() {
    const self = this;
    const has = (c) => self._class.split(/\s+/).includes(c);
    const add = (c) => { if (!has(c)) self._class = (self._class + " " + c).trim(); };
    const remove = (c) => { self._class = self._class.split(/\s+/).filter((x) => x !== c && x).join(" "); };
    return {
      contains: has,
      add,
      remove,
      toggle: (c, on) => { if (on) add(c); else remove(c); },
    };
  }
  appendChild(c) { this.children.push(c); return c; }
  setAttribute(k, v) { this.attrs[k] = String(v); if (k === "class") this._class = String(v); }
  getAttribute(k) { return this.attrs[k]; }
  addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); }
  removeEventListener(t, fn) {
    this.listeners[t] = (this.listeners[t] || []).filter((f) => f !== fn);
  }
  dispatch(t, ev) { (this.listeners[t] || []).slice().forEach((fn) => fn(ev)); }
  getBoundingClientRect() { return { top: 0, left: 0, width: 600, height: 200 }; }
  closest(sel) { return this.classList.contains(sel.replace(".", "")) ? this : null; }
  querySelectorAll(sel) {
    if (sel === ".sl") return this.children.filter((c) => c.classList.contains("sl"));
    if (sel === "button") return this.children.filter((c) => c.tagName === "BUTTON");
    return [];
  }
}

// 按 HTML 里抓到的真实 button 数重建卡片（allowed 进 stage，反例单独存）
function buildCard(a) {
  const card = new El("article");
  card.setAttribute("class", (a.match(/class="([^"]+)"/) || [])[1]);
  card.setAttribute("data-slot", (a.match(/data-slot="([^"]+)"/) || [])[1]);
  const n = (a.match(/<button/g) || []).length;
  for (let i = 0; i < n; i++) card.appendChild(new El("button"));
  return card;
}

const stage = new El("div");
stage.setAttribute("class", "stage");
articles.forEach((a) => stage.appendChild(buildCard(a)));
const badCards = badArticles.map(buildCard);
const allCards = stage.children.concat(badCards);

const kill = new El("input");
const body = new El("body");

// 可控时钟的 rAF（让 30fps 节流可确定性验证）
let now = 0;
let rafQueue = [];
global.requestAnimationFrame = (fn) => { rafQueue.push(fn); return rafQueue.length; };
function tick(dt) {
  now += dt;
  const q = rafQueue; rafQueue = [];
  q.forEach((fn) => fn(now));
}

global.window = {
  matchMedia: (q) => ({ matches: true, media: q, addEventListener() {}, removeEventListener() {} }),
};
global.document = {
  getElementById: (id) => (id === "stage" ? stage : id === "killSpot" ? kill : null),
  querySelectorAll: (sel) => {
    if (sel === "#stage .sl") return stage.children.slice();
    if (sel === ".sl--bad") return badCards.slice();
    return allCards.filter((c) => c.classList.contains(sel.replace(/^\./, "")));
  },
  body,
};
global.requestAnimationFrame = global.requestAnimationFrame;

const scriptMatch = HTML.match(/<script>\r?\n\(function \(\) \{[\s\S]*?\}\)\(\);\r?\n<\/script>/);
if (!scriptMatch) { console.error("FAIL: 页面主脚本未匹配到"); process.exit(1); }
new Function(scriptMatch[0].replace(/^<script>/, "").replace(/<\/script>$/, ""))();

const probe = global.window.__emptyStates;

group("[B2] 脚本输出与静态断言一致");
check("cardCount = 4", probe && probe.cardCount === 4, "实际 " + (probe && probe.cardCount));
check("badCards = 2", probe && probe.badCards === 2, "实际 " + (probe && probe.badCards));
check("canHover = true（shim 下 hover + no-preference）", probe && probe.canHover === true);
allowed.forEach((s) => {
  check("脚本读到 " + s + " 的 button 数 = 1", probe.ctaCounts[s] === 1, "实际 " + probe.ctaCounts[s]);
});

group("[B3] 聚光跟随：单 rAF + 30fps 节流");
const card0 = stage.children[0];
function move(el, x, y) {
  stage.dispatch("pointermove", { target: el, clientX: x, clientY: y });
}
move(card0, 100, 50);
tick(0);   // 首帧写入
check("首次移动即写入 --mx/--my",
  card0.style.getPropertyValue("--mx") === "100px" && card0.style.getPropertyValue("--my") === "50px",
  "--mx=" + card0.style.getPropertyValue("--mx") + " --my=" + card0.style.getPropertyValue("--my"));

// 同一帧内连发 5 次移动 —— 节流下只应有 1 次写入
move(card0, 110, 55); move(card0, 120, 60); move(card0, 130, 65); move(card0, 140, 70);
tick(5);   // 距上次写入仅 5ms < 33ms
check("5ms 内的移动被节流（坐标未变）", card0.style.getPropertyValue("--mx") === "100px",
  "实际 " + card0.style.getPropertyValue("--mx"));
tick(30);  // 累计 35ms > 33ms
check("超过 30fps 间隔后补写最新坐标", card0.style.getPropertyValue("--mx") === "140px",
  "实际 " + card0.style.getPropertyValue("--mx"));

group("[B4] 反例卡不跟随");
const bad = badCards[0];
move(bad, 300, 100);
tick(40);
check("sl--bad 不写坐标", bad.style.getPropertyValue("--mx") === "",
  "实际 " + bad.style.getPropertyValue("--mx"));

group("[B5] 门禁 3 可撤销 —— 开关关闭聚光");
check("初始未挂 no-spotlight", !body.classList.contains("no-spotlight"));
kill.checked = true;
kill.dispatch("change", {});
check("勾选后 body 挂上 no-spotlight", body.classList.contains("no-spotlight"));
check("卸载时清掉已写入的 --mx/--my", card0.style.getPropertyValue("--mx") === "",
  "实际 " + card0.style.getPropertyValue("--mx"));
move(card0, 200, 90);
tick(40);
check("卸载后 pointermove 不再写坐标", card0.style.getPropertyValue("--mx") === "",
  "实际 " + card0.style.getPropertyValue("--mx"));
kill.checked = false;
kill.dispatch("change", {});
check("取消勾选后恢复绑定", !body.classList.contains("no-spotlight"));
move(card0, 210, 95);
tick(40);
check("恢复后坐标重新写入", card0.style.getPropertyValue("--mx") === "210px",
  "实际 " + card0.style.getPropertyValue("--mx"));

// ============================================================================
console.log("\n" + "=".repeat(58));
console.log(fail === 0
  ? `全部通过：${pass} passed`
  : `${pass} passed, ${fail} FAILED`);
console.log("=".repeat(58));
process.exit(fail === 0 ? 0 : 1);
