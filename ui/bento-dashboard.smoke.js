/* bento-dashboard.html 守护脚本（零依赖）
 * 用法：node ui/bento-dashboard.smoke.js
 * 覆盖：bento 网格结构 · 主笔记 tile 含 Mini Star · 无 ADR-013 违规视觉
 */
'use strict';
const fs = require('fs');
const path = require('path');
const HTML = path.join(__dirname, 'bento-dashboard.html');
const html = fs.readFileSync(HTML, 'utf8');
const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; console.log('  ✓', msg); } else { fail++; console.error('  ✕', msg); } }
function section(t) { console.log('\n▌' + t); }

/* =========================================================================
 * A. bento 网格
 * ======================================================================= */
section('A bento 网格');
ok(/class="bento"/.test(html), 'A1 .bento 容器');
ok(/grid-template-columns:\s*repeat\(6,\s*1fr\)/.test(css), 'A2 6 列网格');
ok(/grid-auto-rows:\s*120px/.test(css), 'A3 行高 120px（保留等高基线）');
ok(/\.col-2\{grid-column:span 2\}/.test(css) || /\.col-2\s*\{\s*grid-column:\s*span\s*2/.test(css), 'A4 col-2 span 2');
ok(/\.col-3\{grid-column:span 3\}/.test(css) || /\.col-3\s*\{\s*grid-column:\s*span\s*3/.test(css), 'A5 col-3 span 3');
ok(/\.col-4\{grid-column:span 4\}/.test(css), 'A6 col-4 span 4');
ok(/\.row-2\{grid-row:span 2\}/.test(css) || /\.row-2\s*\{\s*grid-row:\s*span\s*2/.test(css), 'A7 row-2 span 2');
ok(/\.row-3\{grid-row:span 3\}/.test(css), 'A8 row-3 span 3');

/* =========================================================================
 * B. tile 内容（与归档目录里的 8 tile 一致）
 * ======================================================================= */
section('B tile 内容');
ok(/class="tile col-4 row-2 review-tile"/.test(html), 'B1 review-tile 4×2');
ok(/class="tile col-2 row-2 concept-tile"/.test(html), 'B2 concept-tile 2×2');
ok(/class="tile col-4 row-3 note-tile"/.test(html), 'B3 note-tile 4×3（截图 1 形态）');
ok(/class="tile col-2 row-2 flow-tile"/.test(html), 'B4 flow-tile 2×2');
ok(/class="tile col-3 row-2 mistake-tile"/.test(html), 'B5 mistake-tile 3×2');
ok(/class="tile col-3 row-2 notes-tile"/.test(html), 'B6 notes-tile 3×2');
ok(/class="tile col-2 mastery-tile"/.test(html), 'B7 mastery-tile 2×1');
ok(/class="tile col-2 new-tile"/.test(html), 'B8 new-tile 2×1');
ok(/12<span class="unit">张<\/span>/.test(html), 'B9 review tile 含 12 张');
ok(/147<\/div>/.test(html), 'B10 flow tile 含 147');
ok(/18 \u5206\u949f/.test(html) || /\u9884\u8ba1\u8017\u65f6 18 \u5206\u949f/.test(html), 'B11 review tile 含「预计耗时 18 分钟」');
ok(/38<span class="accent">\/200<\/span>/.test(html), 'B12 concept tile 含 38/200');

/* =========================================================================
 * C. 主笔记 tile 含 Mini Star（截图 1 形态）
 * ======================================================================= */
section('C 主笔记 tile + Mini Star');
ok(/<h3>优化器<\/h3>/.test(html), 'C1 note-tile 标题「优化器」');
ok(/data-mini-star="3"/.test(html), 'C2 含 Mini Star (3 卫星)');
ok(/<div class="statline">/.test(html), 'C3 statline 容器');
ok(/<b class="brand">3<\/b><span>卫星<\/span>/.test(html), 'C4 stat 卫星 = 3');
ok(/<b>5<\/b><span>链接<\/span>/.test(html), 'C5 stat 链接 = 5');
ok(/<b>67<\/b><span>掌握度<\/span>/.test(html), 'C6 stat 掌握度 = 67');
ok(/pill/.test(html), 'C7 pill CTA');

/* =========================================================================
 * D. 视觉合规（ADR-013）
 * ======================================================================= */
section('D ADR-013 视觉合规');
ok(!/\blinear-gradient\b/i.test(css), 'D1 禁 linear-gradient（ADR-013 §2.7）');
ok(!/\bconic-gradient\b|\bradial-gradient\b/i.test(css), 'D2 禁 conic/radial-gradient');
ok(!/\bbackdrop-filter\b/i.test(css), 'D3 禁 backdrop-filter（ADR-013 §2.10）');
ok(!/\bfilter:\s*blur\b/i.test(css), 'D4 禁 filter blur');
ok(!/\bemoji\b/i.test(html), 'D5 无 emoji 关键字');
ok(!/[\u{1F300}-\u{1FAFF}\u{2700}-\u{27BF}]/u.test(html), 'D6 无 emoji 字符');
const hexInCss = (css.match(/#[0-9a-f]{6}\b/gi) || []);
/* 6-digit hex 在 brand 文本 / 注释可允许，但 CSS 值中应全部用 token */
ok(hexInCss.length === 0, `D7 CSS 中无硬编码 hex（实测 ${hexInCss.length}）`);
/* box-shadow 仅在装饰动画时禁用；focus 环允许 */
ok(!/box-shadow\s*:[^;]*rgba/i.test(css), 'D8 装饰 box-shadow 必带 rgba？禁');
/* 多 dot 颜色（归档里 6 种）现在只剩 var(--text-3) 一种 */
ok((html.match(/<span class="dot"><\/span>/g) || []).length >= 4, 'D9 最近笔记 4+ 行（点统一中性色）');
ok(!/background:\s*(#|rgb|hsl)/i.test(css.match(/\.dot\s*\{[^}]+\}/) ? css.match(/\.dot\s*\{[^}]+\}/)[0] : ''), 'D10 dot 单一色');

/* =========================================================================
 * E. Mini Star 脚本同源（简化版）
 * ======================================================================= */
section('E Mini Star 脚本');
ok(/window\.__miniStarBooted\s*=\s*true/.test(html), 'E1 幂等挂载');
ok(/window\.__miniStarBootAll\s*=\s*bootAll/.test(html), 'E2 暴露 dynamic boot');
ok(/Math\.min\(16,\s*Math\.max\(0/.test(html), 'E3 卫星数 0–16');
ok(/Math\.min\(3,\s*Math\.max\(1/.test(html), 'E4 轨道 1–3');
ok(/1000\s*\/\s*30/.test(html), 'E5 30fps 节流');

/* =========================================================================
 * F. 响应 + 语义
 * ======================================================================= */
section('F 响应 + 语义');
ok(/@media \(max-width:\s*1080px\)/.test(css), 'F1 1080 响应');
ok(/@media \(max-width:\s*780px\)/.test(css), 'F2 780 响应');
ok(/href=\"\.\/tokens\.css\"/.test(html), 'F3 引用 tokens.css');
ok(/class="start"/.test(html), 'F4 review tile 含开始按钮');
ok(/<span class="lbl">今日复习<\/span>/.test(html), 'F5 tile label 标准「今日复习」');

console.log(`\nbento-dashboard.smoke：${pass}/${pass + fail} passed`);
if (fail) { console.error(`!! ${fail} 项失败`); process.exit(1); }
