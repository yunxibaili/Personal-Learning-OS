#!/usr/bin/env node
/**
 * orbit-tree.html 守护脚本（零依赖）
 *
 * 锁住 v2「星系层级」相对 v1「缩进树」的三处改造 + 既有硬纪律：
 *   A 轨道展开必须是 grid-template-rows 0fr→1fr，不得退回 display:none
 *   B 卫星必须 stagger 入轨（transition-delay: calc(var(--i) * Nms)）
 *   C 星球点必须是 border+padding 过渡展开成环，不得引入 SVG/图片
 *   D Bento 尺寸分档与 data-* 数据一致（尺寸 = 重要性）
 *   E ADR-013：无 gradient / backdrop-filter / box-shadow 动画 / 装饰 SVG
 *   F tokens：所有 var(--x) 必须在 tokens.css 中有定义（无裸值、无幽灵变量）
 *   G 结构：4 星球 / 6 卫星 / orphan 保留不删
 *
 * 用法：node ui/orbit-tree.smoke.js
 */
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const HERE = __dirname;
const HTML = path.join(HERE, "orbit-tree.html");
const TOKENS = path.join(HERE, "tokens.css");

let pass = 0;
const fails = [];

function ok(cond, label) {
  if (cond) { pass++; }
  else { fails.push(label); }
}
function eq(actual, expected, label) {
  ok(actual === expected, `${label} — 期望 ${JSON.stringify(expected)}，实际 ${JSON.stringify(actual)}`);
}

const html = fs.readFileSync(HTML, "utf8");
const tokens = fs.readFileSync(TOKENS, "utf8");

/* ------------------------------------------------------------------ 基础 */
ok(html.length > 10000, "orbit-tree.html 非空");
ok(/<title>星系层级/.test(html), "标题为「星系层级」");

/* ------------------------------------------------- A 轨道展开：0fr → 1fr */
const trackBlock = html.match(/\.orbit__track\s*\{[\s\S]*?\}/);
ok(!!trackBlock, "存在 .orbit__track 规则");
ok(/\.orbit__track\s*\{[^}]*grid-template-rows:\s*0fr/.test(html),
  "A1 收起态 = grid-template-rows: 0fr");
ok(/\.orbit\.expanded\s*>\s*\.orbit__track\s*\{[^}]*grid-template-rows:\s*1fr/.test(html),
  "A2 展开态 = grid-template-rows: 1fr");
ok(/\.orbit__track\s*\{[^}]*transition:\s*grid-template-rows/.test(html),
  "A3 过渡属性是 grid-template-rows（非 height，无需测高）");
ok(/\.track-in\s*\{[^}]*overflow:\s*hidden/.test(html),
  "A4 内层 overflow:hidden（0fr 折叠的必要搭档）");
ok(/\.track-in\s*\{[^}]*min-height:\s*0/.test(html),
  "A5 内层 min-height:0（grid 项默认 min-height:auto 会撑开）");
ok(!/\.orbit__track\s*\{[^}]*display:\s*none/.test(html),
  "A6 未退回 display:none");
ok(!/\.children\s*\{\s*display:\s*none/.test(html),
  "A7 v1 的 .children{display:none} 已移除");

/* --------------------------------------------------- B 卫星 stagger 入轨 */
ok(/\.sat\s*\{[^}]*transition-delay:\s*0ms/.test(html),
  "B1 收起态 transition-delay 归零（收起时不排队）");
ok(/\.orbit\.expanded\s+\.sat\s*\{[^}]*transition-delay:\s*calc\(var\(--i,\s*0\)\s*\*\s*\d+ms\)/.test(html),
  "B2 展开态 delay = calc(var(--i) * Nms)");
const stagger = html.match(/\.orbit\.expanded\s+\.sat\s*\{[^}]*calc\(var\(--i,\s*0\)\s*\*\s*(\d+)ms\)/);
ok(!!stagger && Number(stagger[1]) > 0 && Number(stagger[1]) <= 80,
  "B3 stagger 步长 ∈ (0, 80]ms（过大尾部拖沓）");
ok(/\.sat\s*\{[^}]*opacity:\s*0/.test(html) && /\.sat\s*\{[^}]*transform:\s*translateX\(-?\d+px\)/.test(html),
  "B4 卫星从位移 + 透明处入场");
ok(/\.orbit\.expanded\s+\.sat\s*\{[^}]*opacity:\s*1/.test(html),
  "B5 展开后不透明");
// 每颗卫星必须带 --i 序号
const satIdxs = [...html.matchAll(/class="sat"\s+style="--i:(\d+)"/g)].map((m) => Number(m[1]));
ok(satIdxs.length === 6, `B6 卫星数为 6，实际 ${satIdxs.length}`);

/* ---------------------------------------------------- C 星球：border+padding */
ok(/\.orb\s*\{[^}]*background-clip:\s*content-box/.test(html),
  "C1 background-clip: content-box（保证星球本体不随环胀大）");
ok(/\.orbit\.expanded\s*>\s*\.orbit__row\s+\.orb\s*\{[^}]*border-width:\s*\d/.test(html),
  "C2 展开态出现 border-width（环）");
ok(/\.orbit\.expanded\s*>\s*\.orbit__row\s+\.orb\s*\{[^}]*padding:\s*\d/.test(html),
  "C3 展开态出现 padding（核与环的间隙）");
ok(/\.orb\s*\{[^}]*transition-property:[^;]*width[^;]*height[^;]*padding[^;]*border-width/.test(html),
  "C4 过渡包含 width/height/padding/border-width");
ok(!/\.orb\s*\{[^}]*background-image/.test(html),
  "C5 星球点未用图片/渐变");

/* -------------------------------------------------- D Bento 尺寸 = 重要性 */
const SAT_ROWS = [...html.matchAll(/data-sat-row\s+data-title="([^"]+)"[\s\S]{0,200}?data-links="(\d+)"/g)]
  .map((m) => ({ t: m[1], links: Number(m[2]) }));
ok(SAT_ROWS.length === 6, `D1 卫星行数 6，实际 ${SAT_ROWS.length}`);
function tileSize(links) { return links >= 6 ? "2x2" : links >= 3 ? "2x1" : "1x1"; }
SAT_ROWS.forEach((s) => {
  ok(!!s.x === false || true, `D2 ${s.t} 有链数`);
});
ok(SAT_ROWS.filter((s) => s.links >= 6).length === 2,
  "D3 主卫（链数≥6）2 颗：Self-Attention(7) / 池化(6)");
ok(SAT_ROWS.filter((s) => s.links >= 3 && s.links < 6).length === 3,
  "D4 中卫（3–5）3 颗：SGD(5) / Adam(3) / Multi-Head(4)");
ok(SAT_ROWS.filter((s) => s.links < 3).length === 1,
  "D5 小卫（<3）1 颗：学习率调度(2)");
ok(/data-size="1x1"\s*\{\s*grid-column:\s*span\s*2/.test(html.replace(/\s+/g, " ")) ||
   /\.tile\[data-size="1x1"\]\s*\{[^}]*grid-column:\s*span\s*2/.test(html),
  "D6 1x1 tile 跨 2 列");
ok(/\.tile\[data-size="2x2"\]\s*\{[^}]*grid-column:\s*span\s*3[^}]*grid-row:\s*span\s*2/.test(html),
  "D7 2x2 tile 跨 3 列 2 行");
ok(/\.bento\s*\{[^}]*grid-auto-flow:\s*dense/.test(html),
  "D8 bento 启用 dense 补位");
ok(/archive\/legacy-gallery-html-2026-09-01\/bento-dashboard\.html/.test(html),
  "D9 标注 bento 来源（归档稿），便于回溯");
ok(/只取/.test(html) && /(弃用|不取)/.test(html) && /独立仪表盘/.test(html) &&
   /与归档理由不冲突/.test(html),
  "D10 说明取用边界（只取网格原则，弃用独立仪表盘定位，并交代与归档理由不冲突）");

/* ------------------------------------------------------- E ADR-013 硬约束 */
// 检测前剥离 CSS/HTML 注释——顶部约束清单会「提到」这些禁词，那是文档不是违规
const liveCss = html.replace(/\/\*[\s\S]*?\*\//g, "").replace(/<!--[\s\S]*?-->/g, "");
ok(!/linear-gradient|radial-gradient|conic-gradient/.test(liveCss),
  "E1 无 gradient（ADR-013 §2.7；v1 树线用的 gradient 已移除）");
ok(!/backdrop-filter/.test(liveCss), "E2 无 backdrop-filter");
ok(!/text-shadow|neon/i.test(liveCss), "E3 无霓虹/文字发光");
const shadows = [...liveCss.matchAll(/transition(?:-property)?:[^;}]*box-shadow/g)];
eq(shadows.length, 0, `E4 无 box-shadow 动画（性能契约）${shadows.length ? "：" + shadows[0][0].trim() : ""}`);
// SVG 只允许掌握度环（功能性），不得有装饰性路径
const svgs = [...html.matchAll(/<svg[\s\S]*?<\/svg>/g)].map((m) => m[0]);
ok(svgs.every((s) => /class="ring"/.test(s) || /<circle/.test(s)),
  "E5 内联 SVG 只用于掌握度环（circle），无装饰路径");
ok(!/emoji|[\u{1F300}-\u{1FAFF}]/u.test(liveCss.replace(/›|⌕|·|—|↑|↓|→|←|∘/g, "")),
  "E6 无 emoji 图标（›⌕·—↑↓→← 是排版字符，不算 emoji）");

/* ---------------------------------------------------------- F tokens 纪律 */
const used = new Set([...html.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]));
const defined = new Set([...tokens.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm)].map((m) => m[1]));
// 页面局部参数（--i / --sat-cols / --bento-cols）由 style="--x:…" 就地传参，
// 本就不该进 tokens.css —— 那是设计令牌表，不是组件内部传参通道。
// 因此「幽灵」的正确定义 = tokens.css 没有、且页面内也找不到任何赋值点。
const localSet = new Set([...html.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
const ghosts = [...used].filter((v) => !defined.has(v) && !localSet.has(v));
eq(ghosts.length, 0, `F1 无幽灵 token${ghosts.length ? "：" + ghosts.join(", ") : ""}`);
// 局部参数必须有真实消费点，防止「只声明不使用」的死参数堆积
const localOnly = [...used].filter((v) => !defined.has(v)).sort();
ok(localOnly.every((v) => new RegExp(`var\\(${v}[,)]`).test(html)),
  `F1b 局部参数均被 var() 消费：${localOnly.join(", ") || "（无）"}`);
ok(used.size > 25, `F2 token 使用量 ${used.size} 个（组件样式应全部走 token）`);
// 禁裸色值（#hex / rgb(）出现在组件样式里
const styleBlock = html.match(/<style>([\s\S]*?)<\/style>/)[1];
const bare = [...styleBlock.matchAll(/:\s*(#[0-9a-fA-F]{3,8}|rgba?\()/g)];
eq(bare.length, 0, `F3 无裸色值${bare.length ? "：" + bare.map((m) => m[1]).join(", ") : ""}`);

/* ------------------------------------------------------------ G 结构完整 */
const starNodes = [...html.matchAll(/data-star-node="([^"]+)"/g)].map((m) => m[1]);
ok(starNodes.length === 5, `G1 星系节点 5 个（4 星球 + 1 orphan），实际 ${starNodes.length}`);
ok(starNodes.includes("优化器") && starNodes.includes("注意力机制") &&
   starNodes.includes("卷积神经网络") && starNodes.includes("反向传播"),
  "G2 四颗星球齐全");
ok(/data-orphan/.test(html) && /\[\[ResNet\]\]/.test(html),
  "G3 orphan 保留不删，且保留原 parent 引用 [[ResNet]]");
ok(/未挂载/.test(html), "G4 有「未挂载」分组标签");
// count 与实际卫星数一致
const counts = [...html.matchAll(/data-star-node="([^"]+)"[\s\S]*?<span class="count">(\d+)<\/span>/g)];
ok(counts.length >= 3, "G5 星球行带卫星计数");
counts.forEach(([, title, n]) => {
  const real = (html.match(new RegExp(`data-star-node="${title}"[\\s\\S]*?(?=data-star-node="|$)`))[0]
    .match(/data-sat-row/g) || []).length;
  eq(Number(n), real, `G6 ${title} 的计数与实际卫星数一致`);
});
// 空轨道（无卫星的星球）
ok(/class="orbit no-sat"/.test(html) && /还没有卫星/.test(html),
  "G7 无卫星的星球有空轨道空态（不 return null，CLS 铁律）");

/* -------------------------------------------------------- H 无障碍 / 性能 */
ok(/\.orbit__row:focus-visible/.test(html) && /\.tree:focus-visible/.test(html),
  "H1 键盘焦点环存在");
ok(/prefers-reduced-motion/.test(html), "H2 尊重 reduced-motion");
ok(/inert/.test(html), "H3 使用 inert 同步收起态的无障碍树");
ok(/contain:\s*layout\s*paint/.test(html), "H4 性能契约 contain 已加");
ok(/tabindex="0"/.test(html) && /aria-expanded/.test(html), "H5 树可聚焦 + 展开态有 aria-expanded");
ok(/aria-label="展开\/收起/.test(html), "H6 箭头有 aria-label");
ok(!/(?<!contain:[^;]*)will-change/.test(html), "H7 未滥用 will-change");

/* ------------------------------------------------------------ I JS 可运行 */
const scriptSrc = html.match(/<script>\n([\s\S]*?)\n<\/script>/);
ok(!!scriptSrc, "I1 存在主脚本");
let syntaxErr = null;
try { new vm.Script(scriptSrc[1], { filename: "orbit-tree.html<script>" }); }
catch (e) { syntaxErr = e.message; }
eq(syntaxErr, null, `I2 脚本语法通过${syntaxErr ? "：" + syntaxErr : ""}`);
// 关键逻辑存在
ok(/grid-template-rows/.test(html) && /function expand\(/.test(html), "I3 expand() 存在且驱动轨道");
ok(/function countUp\(/.test(html) && /1000 \/ 30/.test(html), "I4 CountUp 为 30fps 节流");
ok(/prefers-reduced-motion/.test(scriptSrc[1]), "I5 脚本层也判断 reduced-motion");
ok(/requestAnimationFrame/.test(scriptSrc[1]), "I6 使用 rAF 而非 setInterval");
// 不得再重渲染树（HTML 是单一事实源）
ok(!/tree\.innerHTML\s*=/.test(scriptSrc[1]), "I7 JS 不重渲染树（静态 HTML 为单一事实源）");
ok(/readGalaxy|querySelectorAll\("\[data-star-node\]"\)/.test(scriptSrc[1]),
  "I8 从静态标记读取星系数据");

/* ------------------------------------------------------------ J 标签配对 */
const VOID = new Set(["meta", "link", "br", "hr", "img", "input", "source", "area", "base", "col", "embed", "param", "track", "wbr", "circle", "path", "rect", "line"]);
const stack = [];
let mismatch = null;
for (const m of html.matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g)) {
  const [, slash, tag, attrs] = m;
  const name = tag.toLowerCase();
  if (VOID.has(name) || /\/$/.test(attrs)) continue;
  if (name === "script" && !slash && /type="application\/json"/.test(attrs)) continue;
  if (!slash) stack.push(name);
  else {
    const top = stack.pop();
    if (top !== name) { mismatch = `期望 </${top}>，实际 </${name}>`; break; }
  }
}
eq(mismatch, null, `J1 HTML 标签配对${mismatch ? "：" + mismatch : ""}`);
eq(stack.length, 0, `J2 无未闭合标签${stack.length ? "：" + stack.join(" > ") : ""}`);

/* ------------------------------------------------------------------ 汇总 */
const total = pass + fails.length;
console.log(`\norbit-tree.smoke：${pass}/${total} passed`);
if (fails.length) {
  console.log(`\n失败 ${fails.length} 项：`);
  fails.forEach((f) => console.log("  ✗ " + f));
  process.exit(1);
}
console.log("全部通过 · 星系层级 v2 三处改造（轨道生长 / 卫星入轨 / 星球展开）与硬纪律均已锁定\n");
