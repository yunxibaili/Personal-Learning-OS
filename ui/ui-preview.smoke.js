/* ui-preview.html 守护脚本（零依赖）
 * 用法：node ui/ui-preview.smoke.js
 * 覆盖：单页内联结构 · §hero 点阵地球（唯一落位）· §2 主笔记概览 · 点阵地球脚本契约
 *       · 双向锚 · Bento/Spotlight/空态 · ADR-013 视觉合规 · 本地链接死链扫描
 *
 * 与旧版（10 个 iframe tab 切换）的本质区别：本页所有组件真实内联，
 * 因此本脚本逐段断言「组件在页面里真的存在」，而不是断言「iframe 的 src 指向它」。
 *
 * 2026-09-02 变更：笔记区（§2 / note-workspace.html）取消「卫星 = 笔记」映射，
 * 星球系统整条链路移除，点阵地球只留在 §hero。B 段断言由「必须有」翻转为「必须没有」，
 * 原「Mini Star 脚本同源」改为「点阵地球脚本契约」。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const HTML = path.join(__dirname, 'ui-preview.html');
const html = fs.readFileSync(HTML, 'utf8');
const css = (html.match(/<style>([\s\S]*?)<\/style>/) || [, ''])[1];

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; console.log('  ✓', msg); } else { fail++; console.error('  ✕', msg); } }
function section(t) { console.log('\n▌' + t); }
function cut(from, to) {
  const i = html.indexOf(from);
  const j = to ? html.indexOf(to, i) : html.length;
  return i < 0 ? '' : html.slice(i, j < 0 ? html.length : j);
}
/* 点阵地球脚本块（内联副本，同源 dot-earth.html，改完请跑 sync-dot-earth.mjs 回灌） */
const deI = html.indexOf('Dot Earth —— 点阵地球');
const de = deI < 0 ? '' : html.slice(deI, html.indexOf('</script>', deI));

/* =========================================================================
 * A. 单页内联骨架（替代旧版 iframe tab）
 * ======================================================================= */
section('A 单页内联骨架');
ok(!/<iframe/i.test(html), 'A1 无 iframe（组件真实内联，不再外挂切换）');
ok(!/class="pv-panel"/.test(html), 'A2 旧 pv-panel tab 容器已移除');
ok(!/id="compFrame"/.test(html), 'A3 旧 compFrame 已移除');
ok(html.includes('<link rel="stylesheet" href="./tokens.css">'), 'A4 引 tokens.css');
ok(/class="pp-topbar"/.test(html) && /position:sticky/.test(css.replace(/\s+/g, '')) || /\.pp-topbar\{[^}]*position:sticky/s.test(css), 'A5 顶栏 sticky');
ok(/class="ps"/.test(html), 'A6 段落容器 .ps');
const psCount = (html.match(/<section class="ps"/g) || []).length;
ok(psCount === 15, `A7a 段落总数 = 15（14 段正文 + 归档；实测 ${psCount}）`);
ok((html.match(/class="num">§(hero|\d+|存档)</g) || []).length === 15, 'A7b 每段都有编号徽标');
['hero', 'workspace', 'overview', 'orbittree', 'bento', 'spotlight', 'empty',
 'review', 'annot', 'model', 'kb', 'engine', 'motion', 'tokens']
  .forEach((id, i) => ok(html.includes(`id="${id}"`), `A8.${i + 1} 锚点 #${id} 存在`));
ok(/<nav class="pp-topbar">[\s\S]*?<\/nav>/.test(html), 'A9 顶栏导航包住锚点');
const anchors = (html.match(/<a href="#[a-z]+">/g) || []);
ok(anchors.length === 14, `A10 顶栏 14 个锚点链接（实测 ${anchors.length}）`);

/* =========================================================================
 * B. §2 主笔记概览（截图 1 形态）—— 2026-09-02 取消星球系统后全静态
 * ======================================================================= */
section('B §2 主笔记概览（截图 1）');
const ov = cut('<section class="ps" id="overview">', '<section class="ps" id="orbittree">');
ok(/class="note-overview"/.test(ov), 'B1 容器 note-overview');
ok(/<h3>优化器<\/h3>/.test(ov), 'B2 主标题 优化器');
// —— 星球系统「必须没有」（原 B3–B6，2026-09-02 翻转）——
ok(!/id="ovStar"/.test(ov) && !/data-mini-star/.test(ov), 'B3 右上角无 Mini Star 画布');
ok(!/mini-star/.test(ov), 'B4 §2 全文无 mini-star 字样');
ok(!/data-labels=/.test(ov), 'B5 无卫星 labels（原「卫星 = 笔记」映射已取消）');
ok(!/卫星系统·点切换/.test(ov), 'B6 旧提示文案「卫星系统·点切换」已删');
ok(/没有星球\/卫星系统/.test(ov), 'B7 正面写明「没有星球/卫星系统」');
ok(!/\.mini-star-wrap/.test(css), 'B7b CSS 里 .mini-star-wrap 规则已删');
ok(/class="stat-line"/.test(ov), 'B8 统计行');
ok(/<b>3<\/b><span>关联笔记<\/span>/.test(ov), 'B9 stat 1 = 3 / 关联笔记（原「卫星笔记」，且不再带 .brand 橙）');
ok(!/卫星笔记/.test(ov), 'B9b 全文无「卫星笔记」字样');
ok(/<b>5<\/b><span>总链接<\/span>/.test(ov), 'B10 stat 2 = 5 / 总链接');
ok(/<b>67<\/b><span>平均掌握度<\/span>/.test(ov), 'B11 stat 3 = 67 / 平均掌握度');
['SGD', 'Adam', '学习率调度'].forEach((n, i) =>
  ok(ov.includes(`class="chip${i === 0 ? ' on' : ''}" data-name="${n}"`), `B12.${i + 1} chip ${n}`));
const cards = ov.match(/class="demo-card[^"]*" data-name="([^"]+)"/g) || [];
ok(cards.length === 4, `B13 卡片网格 4 张（实测 ${cards.length}）`);
ok(/data-name="RAdam"/.test(ov), 'B14 第四张 RAdam');
ok(/stroke-dasharray="44"/.test(ov), 'B15 ProgressRing 周长 44');
ok((ov.match(/stroke-dashoffset="/g) || []).length === 4, 'B16 四张卡各有 dashoffset');
ok(/5 \u94fe/.test(ov) && /3 \u94fe/.test(ov) && /2 \u94fe/.test(ov) && /1 \u94fe/.test(ov), 'B17 卡片链路数 5/3/2/1');
ok(/href="\.\/dot-earth\.html"/.test(ov), 'B18 §2 指向 dot-earth.html（而非 mini-star.html）');
ok(/不含任何星球\/卫星组件/.test(ov), 'B19 caption 写明本节不含星球组件');
ok(/id="ovChips"/.test(ov) && /id="ovGrid"/.test(ov), 'B20 chip 行 / 卡网格挂载点保留');

/* =========================================================================
 * C. §hero 点阵地球（唯一落位）
 * ======================================================================= */
section('C §hero 点阵地球（唯一落位）');
const hero = cut('<section class="ps" id="heroDemo">', '<section class="ps" id="workspace">');
ok(/class="hero-canvas-wrap"/.test(hero), 'C1 hero 画布容器');
ok(/<canvas data-dot-earth/.test(hero), 'C2 canvas[data-dot-earth]');
ok(/data-orbits="4"/.test(hero), 'C3 data-orbits="4"（4 条轨道）');
ok(/width="460" height="460"/.test(hero), 'C4 画布 460×460（≥260px 才读得出点阵）');
ok(/\.hero-canvas-wrap \.de-wrap\{[^}]*width:460px;height:460px/s.test(css), 'C5 .de-wrap 定宽高 460（CLS 预留）');
ok(/@media \(max-width:1080px\)\{[\s\S]*?\.hero-canvas-wrap \.de-wrap\{width:360px;height:360px\}/.test(css),
  'C6 ≤1080px 收到 360（并按 1080 断点整块隐藏，装饰图层不吃窄屏空间）');
const satJson = (hero.match(/data-sats='(\[[\s\S]*?\])'/g) || []);
ok(satJson.length === 1, `C7 data-sats 恰好一份（实测 ${satJson.length}）`);
const sats = (function () {
  const m = hero.match(/data-sats='(\[[\s\S]*?\])'/);
  if (!m) return [];
  try { return JSON.parse(m[1]); } catch (e) { return null; }
})();
ok(Array.isArray(sats) && sats.length === 4, `C8 卫星 4 颗（实测 ${Array.isArray(sats) ? sats.length : '解析失败'}）`);
ok(Array.isArray(sats) && sats.every((s) => typeof s.name === 'string' && typeof s.w === 'number'),
  'C9 每颗都有 name + w（w = 字数归一化权重）');
ok(Array.isArray(sats) && sats.map((s) => s.name).join('|') ===
  '梯度下降与优化器|Attention 机制笔记|SM-2 复习算法|卷积网络读书笔记',
  'C10 卫星名取自 home-hero 真实笔记（无杜撰条目）');
ok(!/贝叶斯定理的直觉/.test(hero), 'C11 无杜撰的第五颗卫星');
ok(/4 颗不同颜色的卫星/.test(hero), 'C12 aria-label 写 4 颗不同颜色');
ok(/球后卫星半透明可见不消失/.test(hero), 'C13 caption 写明球后卫星不消失（2026-09-02 修的卡顿点）');
ok(/帧率上限 60/.test(hero), 'C14 caption 写明帧率上限 60');
ok(/笔记里一颗星球都没有/.test(hero), 'C15 caption 写明笔记区无星球');
ok(/没有中间的彩色节点连线/.test(hero), 'C16 无中心彩色节点连线（概念网络归 GraphView）');
ok(/href="\.\/dot-earth\.html#placement"/.test(hero), 'C17 指向 dot-earth.html §② 落位');
ok(de.length > 5000, `C18 点阵地球脚本已内联（实测 ${de.length} 字符，非 0）`);

/* =========================================================================
 * D. 点阵地球脚本契约（与 dot-earth.html 逐条对齐）
 * ======================================================================= */
section('D 点阵地球脚本契约');
ok(de.length > 0, 'D0 脚本块可定位');
ok(/function ringPoint\(c, orb, t\)/.test(de), 'D1 ringPoint 同款算法（与 home-hero / mini-star 同源）');
ok(/lx \* Math\.cos\(orb\.tilt\) - ly \* Math\.sin\(orb\.tilt\)/.test(de), 'D2 旋转矩阵一致');
ok(/Math\.min\(16, Math\.max\(0/.test(de), 'D3 卫星数上限 16');
ok(/Math\.min\(4, Math\.max\(1/.test(de), 'D4 轨道数 1–4');
ok(/var EARTH_D = 0\.50;/.test(de) && /earthR = css \* EARTH_D \/ 2/.test(de),
  'D5 地球直径 = 容器 × 0.50（原 0.60，「球体有点大」后收）');
// —— 掉帧根因：节流硬阈值 vs 60Hz vsync 抖动 ——
ok(/var FPS = 60;/.test(de) && /var FRAME_MS = 1000 \/ FPS;/.test(de),
  'D6 帧率上限 60（非 30：慢速平移的点阵在 30fps 下会读成「一格一格」）');
ok(/var FRAME_TOL = 6;/.test(de) && /if \(dt < FRAME_MS - FRAME_TOL\) return;/.test(de),
  'D7 节流容忍窗口 ±6ms（60Hz 间隔抖动 16.6–16.9ms，硬比阈值会整帧跳过 → 33/50ms 交替）');
ok(/requestAnimationFrame\(tick\)/.test(de), 'D8 单 rAF 循环');
ok(/prefers-reduced-motion: reduce/.test(de), 'D9 尊重 reduced-motion');
ok(/Math\.min\(dt, 100\)/.test(de), 'D10 掉帧不加速（dt 上限 100ms）');
ok(/var INK = \[32, 34, 40\];/.test(de) && /var TRAIL_RAD = 1\.1;/.test(de) && /var TRAIL_SEGS = 9;/.test(de),
  'D11 墨色拖尾 INK #202228 / 1.1rad / 9 段');
ok(/var PALETTE = \['#7c93ad', '#c9a86a', '#8aab8e', '#a08cb4', '#b48a8a', '#6fa3b8'\];/.test(de)
  && /var COLOR_LIMIT = 6;/.test(de) && /var NEUTRAL = '#525252';/.test(de),
  'D12 域调色板 6 色 + >6 回退中性灰 --text-2');
ok(/var TEX_SRC = 'assets\/dots-world\.png'/.test(de), 'D13 贴图走 assets/dots-world.png');
ok(/seamless\.width = w \* 2;/.test(de) && /s\.scale\(-1, 1\);/.test(de),
  'D14 正像 + 水平镜像 → 无缝长条（横向滚动 = 自转）');
ok(/function buildStrip\(\)/.test(de), 'D15 贴图按渲染尺寸预缩放（每帧 1:1 位块传输）');
ok(/function buildOverlay\(\)/.test(de), 'D16 明暗/晕影叠加层预烘焙（每帧不再 createRadialGradient）');
ok(/function glowSprite\(color\)/.test(de) && /glowCache\[color\]/.test(de),
  'D17 卫星光晕按颜色预渲染并缓存');
ok(/Math\.min\(window\.devicePixelRatio \|\| 1, 2\)/.test(de), 'D18 dpr 上限 2');
ok(/IntersectionObserver/.test(de) && /visibilitychange/.test(de), 'D19 离屏 / 隐藏即停');
// —— 「接缝卡一下」的修法：不做真遮挡 ——
ok(/function baseAlphaOf\(depth\)/.test(de), 'D20 深度用连续 alpha 表达');
ok(/0\.725 \+ depth \* \(depth >= 0 \? 0\.225 : 0\.20\)/.test(de),
  'D21 alpha 0.95（前）/ 0.725（侧）/ 0.525（后），无跳变');
ok(/drawEarth\(c\);[\s\S]{0,400}items\.forEach\(function \(it\) \{ drawSatellite\(c, it\); \}\);/.test(de),
  'D22 卫星一律画在地球之后（不被球遮挡 → 不再「钻到背面消失」）');
ok(!/drawSatellite[\s\S]{0,200}frontHalf/.test(de) || !/drawRing\(c, o, false\);\s*\n\s*items/.test(de),
  'D23 卫星无前后分批（真遮挡已废弃）');
ok(/function satR\(it\) \{ return earthR \* \(0\.085 \+ 0\.075 \* it\.weight\) \* dpr; \}/.test(de),
  'D24 卫星半径 = 地球半径 × 0.085–0.160（绝对观感定档，不照抄 home-hero 的 0.733 比例）');
ok(/canvas\.dispatchEvent\(new CustomEvent\('dot-earth:pick'/.test(de), 'D25 用 CustomEvent 而非回调耦合');
ok(/canvas\.__dotEarthMounted/.test(de), 'D26 逐 canvas 幂等挂载');
ok(/window\.__dotEarthBootAll = bootAll/.test(de), 'D27 暴露 bootAll 供动态渲染复用');
ok(!/canvas\.addEventListener\('pointermove'/.test(html), 'D28 画布自身不监听 pointermove（不与页面抢指针）');
ok(!/mini-star:pick/.test(html), 'D29 全页无 mini-star:pick 残留');

/* =========================================================================
 * E. 双向锚（chip ↔ 卡）—— 星球链路已移除
 * ======================================================================= */
section('E 双向锚');
ok(/let activeName = 'SGD'/.test(html), 'E1 初始选中 SGD（截图 1 橙态）');
ok(!/star\.addEventListener\('mini-star:pick'/.test(html), 'E2 无星球 → 高亮 链路（已移除）');
ok(/if \(!chips\.length\) return;/.test(html), 'E3 chip 空态直接 return 不报错');
ok(/chips\.forEach\(\(c\) => c\.addEventListener\('click'/.test(html), 'E4 chip → 高亮');
ok(/cards\.forEach\(\(c\) => c\.addEventListener\('click'/.test(html), 'E5 卡 → 高亮');
ok(/if \(name === activeName\) \{ clearAll\(\); activeName = null; return; \}/.test(html), 'E6 点同一个 = 取消（可撤销）');
ok(/\.demo-card\.on::before/.test(css), 'E7 选中卡为左缘 2px brand 条，非整圈描边');

/* =========================================================================
 * F. §4 Bento · §5 Spotlight · §6 空态
 * ======================================================================= */
section('F Bento / Spotlight / 空态');
const bt = cut('<section class="ps" id="bento">', '<section class="ps" id="spotlight">');
ok(/class="bento-mini"/.test(bt), 'F1 bento-mini 网格');
ok(/grid-auto-rows:120px/.test(css.replace(/\s+/g, '')), 'F2 网格基准行 120px');
ok(/\.bento-mini \.t\.review\{[^}]*grid-column:\s*span 2[^}]*grid-row:\s*span 2/.test(css), 'F3 review tile 2×2（尺寸 = 重要性）');
ok(/t\.review\{background:var\(--brand-deep\)/.test(css.replace(/\s+/g, '')), 'F4 review tile 用 brand-deep 实底');
ok(/t\.concept/.test(css) || /class="t concept"/.test(bt), 'F5 concept tile');
ok(/href="\.\/bento-dashboard\.html"/.test(bt), 'F6 指向启用版 bento-dashboard.html');
ok(/去 gradient \/ backdrop-filter \/ 多色 palette/.test(bt) || /gradient \/ backdrop-filter/.test(bt), 'F7 记明去掉的违规项');

const sp = cut('<section class="ps" id="spotlight">', '<section class="ps" id="empty">');
ok(/class="sl-stage"/.test(sp), 'F8 spotlight 舞台');
ok((sp.match(/<div class="sl">/g) || []).length === 3, 'F9 三张聚光卡（空态三例）');
ok(/radial-gradient\(circle at var\(--mx,50%\) var\(--my,50%\)/.test(css), 'F10 聚光跟指针（--mx/--my）');
ok(/rgba\(255,107,53,\.13\)/.test(css), 'F11 聚光强度 .13（与规范表一致）');
ok(/rgba\(255,107,53,\.04\) 38%/.test(css), 'F12 中段衰减 .04 @ 38%');
ok(/transparent 62%/.test(css), 'F13 62% 处收干');
ok(/\.sl:hover::before\{opacity:1\}/.test(css.replace(/\s+/g, '')), 'F14 hover 才显形');
ok(/pointer-events:none/.test(css), 'F15 聚光层不吃指针');
ok(/class="sl__cta"/.test(sp), 'F16 单一 CTA 出口');
ok(/hover: hover/.test(html), 'F17 触摸设备不启用指针跟随');
ok(/href="\.\/spotlight-card\.html"/.test(sp), 'F18 指向规范页');

const em = cut('<section class="ps" id="empty">', '<section class="ps" id="review">');
ok(/class="es-grid"/.test(em), 'F19 空态对照（聚光 vs Skeleton）');
ok(/class="es-skel"/.test(em) && /class="es-line"/.test(em), 'F20 Skeleton 骨架');
ok(/loading ≠ empty/.test(em), 'F21 写明 loading 不走聚光');
ok(/href="\.\/empty-states\.html"/.test(em), 'F22 指向 empty-states.html');

/* =========================================================================
 * G. ADR-013 视觉合规
 * ======================================================================= */
section('G ADR-013 视觉合规');
const flat = css.replace(/\s+/g, '');
ok(!/backdrop-filter/.test(flat), 'G1 禁 backdrop-filter / 毛玻璃');
ok(!/filter:blur/.test(flat), 'G2 禁 blur');
// §2.7 禁 gradient —— 仅有登记过的例外：§2.13 聚光、Skeleton shimmer、ProgressRing conic
const grad = (css.match(/(linear|radial|conic)-gradient\(/g) || []);
const gradLines = css.split('\n').filter((l) => /(linear|radial|conic)-gradient\(/.test(l));
ok(gradLines.every((l) => /\.sl::before|\.es-line|\.mp-skel|\.mp-ring|\.gutter-k|@keyframes shim/.test(l)),
  `G3 gradient 仅出现在登记过的例外（实测 ${grad.length} 处 / ${gradLines.length} 行）`);
ok(gradLines.filter((l) => /\.mp-ring/.test(l)).length === 1, 'G4 conic-gradient 仅 ProgressRing 一处（形状即语义）');
// 硬编码 hex：只允许 :root 令牌镜像与 §13 令牌速查的「色卡标签」
const cssBlocks = css.replace(/:root\{[\s\S]*?\}/, '');
const hex = (cssBlocks.match(/#[0-9A-Fa-f]{6}\b/g) || []);
ok(hex.length === 0, `G5 CSS 规则体内无硬编码 hex（实测 ${hex.length} 处）`);
ok(!/rgba\(0,0,0|rgba\(\s*0,\s*0,\s*0/.test(flat), 'G6 无裸 rgba 黑阴影');
ok(/@media \(prefers-reduced-motion: reduce\)/.test(css), 'G7 全局 reduced-motion 降级');
ok(!/\bemoji\b/i.test(html), 'G8 无 emoji 关键字');
ok(!/aria-hidden="true">[<>]/.test(html) || !/[🎉✨🚀🔥💡]/.test(html), 'G9 正文无 emoji 字符');
ok(/:focus-visible\{outline:2px solid var\(--brand\)/.test(css), 'G10 键盘焦点环');

/* =========================================================================
 * H. 本地链接死链扫描
 * ======================================================================= */
section('H 本地链接死链扫描');
const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1])
  .filter((h) => !/^(#|https?:|mailto:)/.test(h));
const dead = hrefs.filter((h) => {
  const rel = h.split('#')[0];
  if (!rel || rel.endsWith('/')) return false;          // 目录链接单独看
  return !fs.existsSync(path.join(__dirname, decodeURIComponent(rel)));
});
ok(hrefs.length > 0, `H1 本地链接 ${hrefs.length} 条`);
ok(dead.length === 0, dead.length ? `H2 死链：${dead.join(', ')}` : 'H2 零死链');
const dirHref = hrefs.find((h) => h.endsWith('/'));
ok(!!dirHref && fs.existsSync(path.join(__dirname, dirHref)), 'H3 归档目录链接存在');
ok(fs.existsSync(path.join(__dirname, 'dot-earth.html')), 'H4 dot-earth.html 存在（§hero 引用的规范页）');
ok(fs.existsSync(path.join(__dirname, 'assets', 'dots-world.png')), 'H5 贴图 assets/dots-world.png 存在');

/* =========================================================================
 * I. 文档一致性
 * ======================================================================= */
section('I 文档一致性');
ok(/2026-09-02/.test(html), 'I1 落款日期');
ok(/14 段正文 \+ 归档/.test(html), 'I2 页脚段落数与实测一致');
ok(/真实内联/.test(html), 'I3 写明「不再 iframe 切换」');
ok(html.includes('href="./note-workspace.html"') || html.includes('note-workspace.html'), 'I4 关联 note-workspace.html');
ok(html.includes('href="./orbit-tree.html"'), 'I5 关联 orbit-tree.html');
ok(html.includes('href="./visual-engine-demo.html"'), 'I6 关联 visual-engine-demo.html');
ok(html.includes('href="./motion-primitives.html"'), 'I7 关联 motion-primitives.html');
ok(/ADR-013/.test(html), 'I8 引用 ADR-013');

console.log(`\nui-preview.smoke：${pass}/${pass + fail} passed`);
if (fail) { console.error(`!! ${fail} 项失败`); process.exit(1); }
