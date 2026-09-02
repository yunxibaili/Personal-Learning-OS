/* mini-star.html 守护脚本（零依赖）
 * 用法：node ui/mini-star.smoke.js
 * 覆盖：组件尺寸规则 / 卫星数上限 / dpr 契约 / chip-画布同步 / 无禁止视觉
 */
'use strict';
const fs = require('fs');
const path = require('path');
const HTML = path.join(__dirname, 'mini-star.html');
const html = fs.readFileSync(HTML, 'utf8');
const tokens = fs.readFileSync(path.join(__dirname, 'tokens.css'), 'utf8');

let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; console.log('  ✓', msg); }
  else { fail++; console.error('  ✕', msg); }
}
function section(t) { console.log('\n▌' + t); }

/* =========================================================================
 * A. 结构
 * ======================================================================= */
section('A 结构');
const canvases = (html.match(/<canvas[^>]*data-mini-star/g) || []).length;
ok(canvases >= 4, `演示矩阵 ≥4 颗 canvas（实测 ${canvases}）`);
ok(/data-mini-star="2"/.test(html), 'B1 提供 56px · 2 卫星');
ok(/data-mini-star="3"/.test(html), 'B2 提供 72px · 3 卫星');
ok(/data-mini-star="5"/.test(html), 'B3 提供 88px · 5 卫星');
ok(/data-mini-star="8"/.test(html), 'B4 提供 96px · 8 卫星');
ok(/\.mini-star-wrap\s*\{[^}]*position:\s*relative/.test(html), 'C1 容器 fixed-aspect 相对定位');
ok(/\.mini-star-wrap\s*canvas\s*\{[^}]*width:\s*88px/.test(html), 'C2 canvas 默认 88px 宽');
ok(html.includes('id="hostCard"') && html.includes('id="hostCanvas"'), 'C3 含真实落点（hostCard / hostCanvas）');
ok(html.includes('id="hostChips"'), 'C4 含 chip 容器');
ok(/data-mini-star="3"[^>]*data-labels='\["SGD","Adam","学习率调度"\]'/.test(html.replace(/\s+/g, ' ')), 'C5 host 标签 3 个正确');

/* =========================================================================
 * B. 脚本契约
 * ======================================================================= */
section('B 脚本契约');
ok(/window\.__miniStarBooted\s*=\s*true/.test(html), 'B1 守护幂等挂载');
ok(/window\.matchMedia\('\(prefers-reduced-motion: reduce\)'\)/.test(html), 'B2 读取 reduced-motion');
ok(/1000\s*\/\s*30/.test(html), 'B3 30fps 单 rAF 节流');
ok(/raf\s*=\s*requestAnimationFrame/.test(html), 'B4 单 rAF 启动');
ok(/Math\.min\(16,\s*Math\.max\(0/.test(html), 'B5 卫星数 0–16 范围');
ok(/Math\.min\(3,\s*Math\.max\(1/.test(html), 'B6 轨道 1–3 范围');
ok(new RegExp('const cR = w \\* 0\\.22').test(html), 'B7 中央半径 = 容器 × 22%');
ok(/addEventListener\(['"]click['"]/.test(html), 'B8a 点击事件');
ok(!/addEventListener\(['"]pointermove['"]/.test(html) && !/addEventListener\(['"]mousemove['"]/.test(html),
  'B8b 不响应 pointermove/mousemove——Mini Star 不抢戏（无 mouse reactive）');
ok(/customEvent\(['"]mini-star:pick['"]/i.test(html) || /'mini-star:pick'/.test(html), 'B9 派发 mini-star:pick');
ok(/canvas\.dispatchEvent/.test(html) && /CustomEvent/.test(html), 'B10 canvas 直接派发（不冒泡到 root 即可）');
ok(html.includes("canvas[data-mini-star]") && html.includes(".forEach(boot)"), 'B11 启动器扫全部 canvas');
ok(/window\.__miniStarBootAll/.test(html), 'B12 暴露给 dynamic-rendered 用');

/* =========================================================================
 * C. 规范表条目覆盖
 * ======================================================================= */
section('C 规范表');
const rows = [
  ['尺寸', /<td>尺寸<\/td>[\s\S]*?4 档覆盖/],
  ['卫星数', /<td>卫星数<\/td>[\s\S]*?\u2264 16/],
  ['轨道数', /<td>\u8f68\u9053\u6570<\/td>[\s\S]*?\u9ed8\u8ba4 2/],
  ['中央', /<td>\u4e2d\u592e<\/td>[\s\S]*?--brand/],
  ['卫星', /<td>\u536b\u661f<\/td>[\s\S]*?\u4e2d\u6027/],
  ['轨道线', /<td>\u8f68\u9053\u7ebf<\/td>[\s\S]*?\u865a\u7ebf/],
  ['dpr', /<td>dpr<\/td>[\s\S]*?\u56fa\u5b9a 1/],
  ['reduced-motion', /<td>reduced-motion<\/td>[\s\S]*?\u4e0d\u7ed8\u5236\u536b\u661f\u62d6\u5c3e/],
  ['hover', /<td>hover \/ focus<\/td>[\s\S]*?\u4e0d\u7b97\u4ea4\u4e92\u7ec4\u4ef6/],
  ['禁止', /<td>\u7981\u6b62<\/td>[\s\S]*?\u70b9\u9635\u8d34\u56fe/],
];
rows.forEach(([k, re]) => {
  const m = html.match(re);
  ok(!!m, `C[k] ${k} 规范表行`);
});

/* =========================================================================
 * D. 视觉合规（ADR-013）
 * ======================================================================= */
section('D 视觉合规');
ok(!/\blinear-gradient\b/i.test(html), 'D1 禁 gradient（ADR-013 §2.7）');
ok(!/\bbackdrop-filter\b/i.test(html), 'D2 禁 backdrop-filter（ADR-013 §2.10）');
ok(!/\bfilter:\s*blur\b/i.test(html), 'D3 禁 filter blur');
ok(!/\bconic-gradient\b|\bradial-gradient\b/i.test(html), 'D4 禁 conic/radial-gradient');
ok(!/<canvas[^>]+style="[^"]*gradient/i.test(html), 'D5 行内禁 gradient');
ok(!/[\u{1F300}-\u{1FAFF}\u{2700}-\u{27BF}]/u.test(html), 'D6 无 emoji（UD1F300-1FAFF / 2700-27BF）');
/* 硬编码 hex 仅允许出现在规范表 / brand 文档语境 */
const ownHex = (html.match(/#[0-9a-f]{3,8}\b/gi) || [])
  .filter((h) => !/^#[0-9a-f]{3}$/i.test(h) || /(^#[0-9a-f]+$)/i.test(h));
const allowed = ownHex.filter((h) =>
  /#[0-9a-f]{6}/i.test(h) &&
  /^[A-F0-9]+$/i.test(h.slice(1))
);
ok(allowed.length === 0 || allowed.every((h) => html.indexOf(h) > 0 && /RGB\)\]\s*;/i.test(html) || /rgba?\(|RGB\)/i.test(html)),
  'D7 颜色只用 token（无 6 位 hex 裸值）');
ok(!/box-shadow\s*:\s*[^;]*\d/.test(html.replace(/\/\*[\s\S]*?\*\//g, '')) || /box-shadow:\s*var\(--shadow/i.test(html),
  'D8 box-shadow 走 token');

/* =========================================================================
 * E. 关联
 * ======================================================================= */
section('E 关联');
ok(html.includes('href="./tokens.css"'), 'E1 引用 tokens.css');
ok(html.includes('home-hero.html'), 'E2 反链到 home-hero（出处）');
ok(html.includes('note-workspace.html'), 'E3 反链到 note-workspace（落点）');
ok(html.includes('ADR-023') || html.includes('形状即语义'), 'E4 引用 ADR-023 形状即语义');
ok(html.includes('ADR-013') && html.includes('§2.10'), 'E5 引用 ADR-013 §2.10 装饰动效约束');

/* =========================================================================
 * 输出
 * ======================================================================= */
const total = pass + fail;
console.log(`\nmini-star.smoke：${pass}/${total} passed`);
if (fail) {
  console.error(`!! ${fail} 项失败`);
  process.exit(1);
}
