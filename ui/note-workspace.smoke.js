/* note-workspace.html 守护脚本（零依赖）
 * 用法：node ui/note-workspace.smoke.js
 * 覆盖：三栏 IA · 主笔记卡 + Mini Star · 卡片网格 · chip 双向锚 · 视觉合规
 */
'use strict';
const fs = require('fs');
const path = require('path');
const HTML = path.join(__dirname, 'note-workspace.html');
const html = fs.readFileSync(HTML, 'utf8');
const tokens = fs.readFileSync(path.join(__dirname, 'tokens.css'), 'utf8');

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; console.log('  ✓', msg); } else { fail++; console.error('  ✕', msg); } }
function section(t) { console.log('\n▌' + t); }

/* =========================================================================
 * A. 三栏 IA
 * ======================================================================= */
section('A 三栏 IA');
ok(/<aside class="rail rail-left">/.test(html), 'A1 左栏 rail-left');
ok(/<aside class="rail rail-right">/.test(html), 'A2 右栏 rail-right');
ok(/<main class="editor">/.test(html), 'A3 中栏 editor');
ok(/class="workspace"/.test(html), 'A4 容器 workspace');
ok(/rail-left\s*{[^}]*width:\s*240px/.test(html), 'A5 左栏 240px（与决策书一致）');
ok(/rail-right\s*{[^}]*width:\s*320px/.test(html), 'A6 右栏 320px');
ok(/editor-inner\s*{[^}]*max-width:\s*880px/.test(html), 'A7 中栏 max-width 880px（图片 1 形态）');
ok(/@media \(max-width:\s*1080px\)\s*{\s*\.rail-right\s*\{\s*display:\s*none/.test(html), 'A8 1080 收起右栏');
ok(/@media \(max-width:\s*780px\)\s*{\s*\.rail-left\s*\{\s*display:\s*none/.test(html), 'A9 780 收起左栏');

/* =========================================================================
 * B. 主笔记卡 + 截图 1 视觉合规
 * ======================================================================= */
section('B 主笔记卡');
ok(/<h1>优化器<\/h1>/.test(html), 'B1 主标题 优化器');
// 2026-09-02 裁定：笔记区不再显示卫星系统（卫星=笔记的映射取消），星球相关的断言反转成「必须不存在」
ok(!/data-mini-star/.test(html), 'B2 无 Mini Star 画布');
ok(!/id="mainCanvas"/.test(html) && !/mainStarWrap/.test(html), 'B2b 无主星球挂载点');
ok(!/卫星系统·点任意星球切换/.test(html), 'B3 无「卫星系统」提示文案');
ok(/class="note-head"/.test(html), 'B3b 标题块改 .note-head（不再是与星球并排的网格）');
ok(/class="stat-row"/.test(html), 'B4 stats 行存在');
ok(/<b>3<\/b><span>关联笔记<\/span>/.test(html), 'B5 stat 1 = 3 / 关联笔记（原「卫星笔记」）');
ok(/<b>5<\/b><span>总链接<\/span>/.test(html), 'B6 stat 2 = 5 / 总链接');
ok(/<b>67<\/b><span>平均掌握度<\/span>/.test(html), 'B7 stat 3 = 67 / 平均掌握度');
ok(/class="chip" data-name="SGD"/.test(html), 'B8 chip SGD');
ok(/class="chip" data-name="Adam"/.test(html), 'B9 chip Adam');
ok(/class="chip" data-name="学习率调度"/.test(html), 'B10 chip 学习率调度');
ok(/<div class="cards-grid"/.test(html), 'B11 卡片网格存在');
ok(/class="card" data-name="SGD"/.test(html), 'B12 卡片 SGD');
ok(/class="card" data-name="Adam"/.test(html), 'B13 卡片 Adam');
ok(/class="card" data-name="学习率调度"/.test(html), 'B14 卡片 学习率调度');
ok(/5 \u94fe/.test(html), 'B15 SGD 卡 含 "5 链"');
ok(/3 \u94fe/.test(html), 'B16 Adam 卡 含 "3 链"');
ok(/2 \u94fe/.test(html), 'B17 学习率调度 卡 含 "2 链"');
ok(/88%/.test(html), 'B18 卡含 ProgressRing 88%');
ok(/72%/.test(html), 'B19 卡含 ProgressRing 72%');
ok(/40%/.test(html), 'B20 卡含 ProgressRing 40%');
ok(/<svg class="prog"[^>]*>/.test(html) && /<circle class="track"/.test(html) && /<circle class="fill"/.test(html), 'B21 ProgressRing 纯 SVG 结构');
ok(/stroke-dasharray="44"/.test(html) && /stroke-dashoffset=/.test(html), 'B22 ProgressRing 用 stroke-dashoffset 控制');

/* =========================================================================
 * C. Mini Star 脚本同源
 * ======================================================================= */
section('C 笔记区无星球系统（2026-09-02 裁定）');
ok(!/window\.__miniStarBooted/.test(html), 'C1 无 Mini Star 引导器');
ok(!/canvas\[data-mini-star\]/.test(html), 'C2 无 data-mini-star 选择器');
ok(!/__miniStarBootAll/.test(html), 'C3 无 __miniStarBootAll 全局');
ok(!/mini-star:pick/.test(html), 'C4 无 mini-star:pick 事件');
ok(!/<canvas/i.test(html), 'C5 页面零 canvas——概览视图全静态');
ok(!/requestAnimationFrame/.test(html), 'C6 无 rAF——笔记区不放任何持续动画（ADR-013 §2.10）');

/* =========================================================================
 * D. 选中态同步链路
 * ======================================================================= */
section('D 双向锚');
ok(!/star\.addEventListener/.test(html), 'D1 已无星球 → setActive 这条链路');
ok(/c\.dataset\.name === activeName \? null : c\.dataset\.name/.test(html), 'D1b 再点同名 = 取消');
ok(/chips\.forEach.*c\.dataset\.name/.test(html), 'D2 chip click → setActive');
ok(/cards\.forEach.*c\.dataset\.name/.test(html), 'D3 card click → setActive');
ok(/function setActive.*name.*clearAll/s.test(html), 'D4 setActive 清掉旧再点亮新');
ok(/leftItems.*leftItems.*x.*classList.*remove.*active/s.test(html), 'D5 左栏 note-item 点击切换 active');

/* =========================================================================
 * E. 视觉合规
 * ======================================================================= */
section('E 视觉合规（ADR-013）');
ok(!/\blinear-gradient\b/i.test(html), 'E1 禁 gradient');
ok(!/\bbackdrop-filter\b/i.test(html), 'E2 禁 backdrop-filter（topbar 改为不透明）');
ok(!/\bfilter:\s*blur\b/i.test(html), 'E3 禁 filter blur');
ok(!/\bconic-gradient\b|\bradial-gradient\b/i.test(html), 'E4 禁 conic/radial-gradient');
ok(!/<canvas[^>]+style="[^"]*gradient/i.test(html), 'E5 行内禁 gradient');
ok(!/[\u{1F300}-\u{1FAFF}\u{2700}-\u{27BF}]/u.test(html), 'E6 无 emoji');
/* 6-digit hex only allowed inside text / aria-label context (NOT in CSS values) */
const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];
const hexInCss = (css.match(/#[0-9a-f]{6}\b/gi) || []);
ok(hexInCss.length === 0, `E7 CSS 中无硬编码 hex（实测 ${hexInCss.length} 处）`);
ok(!/\bemoji\b/i.test(html), 'E8 无 emoji 关键字');
ok(/box-shadow:\s*none/i.test(css) || !/box-shadow\s*:[^;]*rgba/i.test(css), 'E9 装饰 box-shadow 必带 rgba？禁；纯数字 + token 允许（focus 环）');

/* =========================================================================
 * F. 文档块
 * ======================================================================= */
section('F 文档块');
ok(/<section class="doc">/.test(html), 'F1 设计说明 doc 块');
ok(/笔记优先：概览视图与编辑视图分离/.test(html), 'F2 标题一致');
ok(/本次重做的部分/.test(html), 'F3 重做对照表标题');
ok(/Mini Star/.test(html) && /dot-earth\.html/.test(html), 'F4 说明「星球系统已取消」并指向 dot-earth.html');
ok(/ProgressRing/.test(html), 'F5 提及 ProgressRing');
ok(/%E2%97%A6/i.test(encodeURIComponent(html)) || /三栏塌缩链/.test(html), 'F6 提及塌缩链');
ok(/ADR-013/.test(html) && /§2.10/.test(html), 'F7 引用 ADR-013 §2.10');

/* =========================================================================
 * G. 关联
 * ======================================================================= */
section('G 关联');
ok(html.includes('href="./tokens.css"'), 'G1 引用 tokens.css');
ok(html.includes('href="./dot-earth.html"'), 'G2 引用 dot-earth.html（星球系统取消后的去向）');

console.log(`\nnote-workspace.smoke：${pass}/${pass + fail} passed`);
if (fail) { console.error(`!! ${fail} 项失败`); process.exit(1); }
