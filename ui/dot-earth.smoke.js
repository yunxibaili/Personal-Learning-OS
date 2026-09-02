/* dot-earth.html 守护脚本（零依赖）
 * 用法：node ui/dot-earth.smoke.js
 * 覆盖：页面骨架 · ① 三档尺寸的点距实测值 · ② 落位（Hero 唯一） · ③ 规格表
 *       · ④ 彩色卫星边界 · 组件脚本契约 · 与 ui-preview.html 内联副本同源
 *       · ADR-013 合规 · 死链扫描
 *
 * 立脚本的原因：这一轮有四类回归全是「改了实现没改文档 / 改了文档没改实现」：
 *   1. EARTH_D 0.60 → 0.50，但 ① 的三档「地球直径 / 点距」与 ⑤ 的结论还停在 0.60 的数字
 *   2. 卫星从 5 颗减到 4 颗（删掉杜撰的「贝叶斯定理的直觉」），aria-label 与文案还写 5 颗
 *   3. 2026-09-02 取消「卫星 = 笔记」，但 §②/④/⑤ 仍在写「笔记里继续用 88px Mini Star」
 *   4. ui-preview.html 是内联副本，改了定稿处不回灌就会漂移
 * 所以下面既有「脚本里必须有的常量」，也有「文档里必须没有的旧数字」。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, 'dot-earth.html');
const html = fs.readFileSync(FILE, 'utf8');
const css = (html.match(/<style>([\s\S]*?)<\/style>/) || [, ''])[1];

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; console.log('  ✓', msg); } else { fail++; console.error('  ✕', msg); } }
function section(t) { console.log('\n▌' + t); }
function cut(from, to) {
  const i = html.indexOf(from);
  const j = to ? html.indexOf(to, i) : html.length;
  return i < 0 ? '' : html.slice(i, j < 0 ? html.length : j);
}
/* 组件脚本块：与 sync-dot-earth.mjs 用同一条正则，两边定义必须一致 */
const SCRIPT_RE = /<script>\s*\/\* =+\s*\n\s*\* Dot Earth[\s\S]*?<\/script>/;
const deM = html.match(SCRIPT_RE);
const de = deM ? deM[0] : '';

/* 点距公式：贴图实测 2000×1049，原始点距 15px；直径 = 容器 × EARTH_D */
const EARTH_D = 0.50;
function pitch(container) { return (container * EARTH_D) / 1049 * 15; }
function f2(n) { return n.toFixed(2); }

/* =========================================================================
 * A. 页面骨架
 * ======================================================================= */
section('A 页面骨架');
ok(html.includes('<link rel="stylesheet" href="./tokens.css">'), 'A1 引 tokens.css');
ok(/<div class="bread">ui 库 · 组件 · <code>dot-earth\.html<\/code><\/div>/.test(html), 'A2 面包屑');
ok(/<h1>Dot Earth · 点阵地球 \+ <em>多轨卫星<\/em><\/h1>/.test(html), 'A3 主标题');
['demo', 'placement', 'spec', 'vs', 'verdict'].forEach((id, i) =>
  ok(html.includes(`<section id="${id}">`), `A4.${i + 1} 段落 #${id}`));
ok(/主页 Hero 的主视觉/.test(html), 'A5 lede 写「主页 Hero 的主视觉」（原「主笔记的星球系统」）');
ok(/只在这里，不进笔记/.test(html), 'A6 lede 写明不进笔记');
ok(/<title>Dot Earth · 点阵地球 \+ 多轨卫星（主页 Hero 主视觉）<\/title>/.test(html), 'A7 title 同步改过');
ok(/2026-09-02/.test(html), 'A8 落款日期');
ok(/href="\.\/home-hero\.html"/.test(html), 'A9 指向起源 home-hero.html');
ok(/href="\.\/ui-preview\.html#hero"/.test(html), 'A10 指向落地点 ui-preview.html §hero');
ok(/href="\.\/note-workspace\.html"/.test(html), 'A11 指向 note-workspace.html');

/* =========================================================================
 * B. ① 三档尺寸：点距数字必须跟随 EARTH_D（改了常量就要改这里）
 * ======================================================================= */
section('B ① 三档尺寸 · 点距实测');
const demo = cut('<section id="demo">', '<section id="placement">');
ok((demo.match(/<canvas data-dot-earth/g) || []).length === 3, 'B1 三个真实实例');
[[200, 2], [260, 3], [320, 3]].forEach(([size, orbits], i) => {
  ok(demo.includes(`style="width:${size}px;height:${size}px"`), `B2.${i + 1} ${size}px 容器`);
  ok(demo.includes(`data-orbits="${orbits}" width="${size}" height="${size}"`), `B3.${i + 1} ${size}px → ${orbits} 轨`);
});
// 文档里的直径/点距 = 容器 × EARTH_D / 1049 × 15，逐档核对
[[200, '100', '1.43'], [260, '130', '1.86'], [320, '160', '2.29']].forEach(([size, dia, pit], i) => {
  ok(f2(pitch(size)) === pit, `B4.${i + 1} 公式自检：${size}px → 点距 ${f2(pitch(size))}（文档写 ${pit}）`);
  ok(demo.includes(`地球直径 ${dia}px，点距 ${pit}px`), `B5.${i + 1} 文档写明 ${size}px → 直径 ${dia} / 点距 ${pit}`);
});
ok(/直径 ÷ 1049 × 15/.test(demo), 'B6 注里给出公式');
ok(/贴图实测 2000×1049/.test(demo), 'B7 注里给出贴图实测尺寸（别再凭印象写）');
ok(/88px 装不下点阵/.test(demo), 'B8 写明 88px 装不下点阵');
// 0.60 时代的旧数字必须清干净
ok(!/地球直径 120px|地球直径 156px|地球直径 192px/.test(demo), 'B9 无 EARTH_D=0.60 时代的旧直径（120/156/192）');
ok(!/点距 2\.2px（勉强）|2\.7px（清晰）|直径 120px → 1\.7px/.test(demo), 'B10 无旧点距（1.7 / 2.2 / 2.7 三档旧写法）');

/* =========================================================================
 * C. ② 落位：Hero 唯一，笔记区无星球
 * ======================================================================= */
section('C ② 落位');
const pl = cut('<section id="placement">', '<section id="spec">');
ok((pl.match(/class="place place-[abc] (reject|recommend)"/g) || []).length === 3, 'C1 三格对照');
ok(/<h3>笔记主卡 · 300px<\/h3>/.test(pl), 'C2 被否 1：笔记主卡 300px（标题与容器尺寸一致）');
ok(/<h3>笔记主卡 · 硬塞 150px<\/h3>/.test(pl), 'C3 被否 2：硬塞 150px');
ok(/<h3>主页 Hero · 主视觉（460px）<\/h3>/.test(pl), 'C4 采用：Hero 460px');
ok(/地球直径只剩 <b>75px<\/b>（150 × 0\.50），点距 ≈ <b>1\.07px<\/b>/.test(pl),
  `C5 150px → 直径 75 / 点距 1.07（公式自检 ${f2(pitch(150))}）`);
ok(f2(pitch(150)) === '1.07', 'C5b 公式自检：150px → 1.07px');
ok(/地球直径 230px、点距 3\.29px/.test(pl), 'C6 Hero → 直径 230 / 点距 3.29');
ok(f2(pitch(460)) === '3.29', 'C6b 公式自检：460px → 3.29px');
ok(/4 条轨道 \+ 4 颗卫星/.test(pl), 'C7 Hero 4 轨 4 星（不是 5 星）');
ok(/aria-label="知识星球：点阵地球与 4 颗不同颜色的卫星"/.test(pl), 'C8 Hero aria-label 写 4 颗');
// 2026-09-02 裁定后的因果链
ok(/点阵地球就是主页的固定动画/.test(pl), 'C9 引用裁定原话');
ok(/笔记区现在<b>一颗星球都没有<\/b>/.test(pl), 'C10 写明笔记区一颗星球都没有');
ok(/当前无页面消费/.test(pl), 'C11 写明 Mini Star 当前无页面消费');
// 旧结论必须清干净
ok(!/笔记里继续用 88px 的/.test(pl), 'C12 无「笔记里继续用 88px 小星」旧结论');
ok(!/卫星笔记/.test(pl), 'C13 无「卫星笔记」字样（stats 已改「关联笔记」）');
ok(!/但这件事 88px 的 Mini Star 也能拿到/.test(pl), 'C14 无「Mini Star 也能拿到这份语义」旧论证');
ok(/零 canvas、零 rAF/.test(pl), 'C15 写明笔记区零 canvas / 零 rAF');

/* =========================================================================
 * D. ③ 规格表
 * ======================================================================= */
section('D ③ 规格表');
const spec = cut('<section id="spec">', '<section id="vs">');
ok((spec.match(/<tr><td>/g) || []).length >= 18, `D1 规格表 ≥18 行（实测 ${(spec.match(/<tr><td>/g) || []).length}）`);
ok(/<tr><td>地球直径<\/td><td>容器 × 0\.50<\/td>/.test(spec), 'D2 地球直径 = 容器 × 0.50');
ok(/早期按 0\.60 做过，实测球把轨道压住了，收到「球体有点大」后下调/.test(spec), 'D3 记明 0.60 → 0.50 的原因');
ok(/<tr><td>尺寸<\/td><td>由 CSS 容器决定<\/td>[\s\S]*?建议 ≥ 320px/.test(spec), 'D4 建议 ≥ 320px');
ok(/<tr><td>卫星大小<\/td><td>地球半径 × 0\.085 – 0\.160<\/td>/.test(spec), 'D5 卫星半径 = 地球半径 × 0.085–0.160');
ok(/曾照抄 home-hero 比例（0\.024–0\.059）→ 只剩 3\.4–6\.8px，被指「太小」/.test(spec), 'D6 记明两轮调参史（别再改）');
ok(/<tr><td>球后卫星<\/td><td><b>可见<\/b>，不遮挡<\/td>/.test(spec), 'D7 球后卫星可见不遮挡');
ok(/0\.725 \+ depth×\(depth≥0 \? 0\.225 : 0\.20\)/.test(spec), 'D8 alpha 公式与实现一致');
ok(/不要改回「球后先画、被地球盖住」的真遮挡/.test(spec), 'D9 明令禁止改回真遮挡');
ok(/<tr><td>帧率<\/td><td>上限 60fps · 单 rAF<\/td>/.test(spec), 'D10 帧率上限 60');
ok(/节流判断留 6ms 容忍窗口/.test(spec), 'D11 记明 6ms 容忍窗口（掉帧根因）');
ok(/不沿用性能契约的 30fps/.test(spec), 'D12 写明为何不沿用 30fps');
ok(/<tr><td>贴图<\/td><td>预缩放 \+ 预烘焙<\/td>/.test(spec), 'D13 贴图预缩放 + 预烘焙');
ok(/不要改回每帧 <code>drawImage\(seamless,…\)<\/code> 带缩放/.test(spec), 'D14 明令禁止改回每帧带缩放 drawImage');
ok(/min\(devicePixelRatio, 2\)/.test(spec), 'D15 dpr ≤ 2');
ok(/IntersectionObserver[\s\S]{0,80}visibilitychange/.test(spec), 'D16 离屏 + 隐藏暂停');
ok(/<tr><td>reduced-motion<\/td><td>静态一帧<\/td>/.test(spec), 'D17 reduced-motion 静态一帧');
ok(/dot-earth:pick/.test(spec), 'D18 点击派发 dot-earth:pick');
ok(/<tr><td>指针跟随<\/td><td><b>无<\/b><\/td>/.test(spec), 'D19 无指针跟随');
ok(/彩色节点连线 \/ gradient \/ backdrop-filter/.test(spec), 'D20 禁止项：彩色节点连线 / gradient / backdrop-filter');
ok(/轨道数<\/td><td>1–4（默认 3）/.test(spec), 'D21 轨道 1–4');
ok(/卫星数<\/td><td>0–16（默认 4）/.test(spec), 'D22 卫星 0–16');

/* =========================================================================
 * E. ④ 彩色卫星边界
 * ======================================================================= */
section('E ④ 彩色卫星边界');
const vs = cut('<section id="vs">', '<section id="verdict">');
ok(/<b>≤ 6 颗<\/b>：可用域调色板区分/.test(vs), 'E1 ≤6 颗可用域调色板');
ok(/Hero 情形：[\s\S]{0,120}= 4 颗/.test(vs), 'E2 举例用 Hero 的 4 颗真实笔记（不再用 SGD/Adam/RAdam 占位）');
ok(/<b>&gt; 6 颗<\/b>：色相开始难辨，<b>回退中性灰/.test(vs), 'E3 >6 回退中性灰');
ok(/颜色<b>只作身份标识<\/b>/.test(vs), 'E4 颜色只作身份标识，不承载第二重语义');
ok(/选中态仍<b>只用橙<\/b>/.test(vs), 'E5 选中态仍只用橙');
ok(/Dot Earth（本页）· 主页 Hero 主视觉/.test(vs), 'E6 左栏标题改为主页 Hero 主视觉');
ok(/Mini Star · 小尺度版（<b>当前无页面消费<\/b>）/.test(vs), 'E7 右栏标注无页面消费');
ok(/留着不删/.test(vs), 'E8 写明留着不删的理由');

/* =========================================================================
 * F. ⑤ 结论
 * ======================================================================= */
section('F ⑤ 结论');
const vd = cut('<section id="verdict">', '<footer>');
ok(/点阵地球不进笔记；它属于主页 Hero/.test(vd), 'F1 结论标题');
ok(/点距 1\.07px/.test(vd) && /直径 230px、点距 3\.29px/.test(vd), 'F2 结论里的数字跟 EARTH_D=0.50 一致');
ok(/4 轨 4 星/.test(vd), 'F3 4 轨 4 星');
ok(/笔记区一颗星球都不放/.test(vd), 'F4 结论写明笔记区无星球');
ok(/88px Mini Star 也一起撤掉/.test(vd), 'F5 写明小尺度 Mini Star 一起撤');
ok(/sync-dot-earth\.mjs/.test(vd), 'F6 写明脚本由 sync-dot-earth.mjs 同步');
ok(/<code>\.star-card<\/code> → <code>\.note-head<\/code>/.test(vd), 'F7 写明 .star-card → .note-head');
ok(!/的「优化器」不动，仍是 Mini Star/.test(vd), 'F8 无「note-workspace 不动，仍是 Mini Star」旧结论');

/* =========================================================================
 * G. 组件脚本契约
 * ======================================================================= */
section('G 组件脚本契约');
ok(de.length > 5000, `G0 脚本块可定位（${de.length} 字节）`);
ok(/function ringPoint\(c, orb, t\)/.test(de), 'G1 ringPoint 与 home-hero 同款');
ok(/lx \* Math\.cos\(orb\.tilt\) - ly \* Math\.sin\(orb\.tilt\)/.test(de), 'G2 旋转矩阵一致');
ok(/var EARTH_D = 0\.50;/.test(de) && /earthR = css \* EARTH_D \/ 2/.test(de), 'G3 EARTH_D = 0.50 且用于求半径');
ok(/var FPS = 60;/.test(de) && /var FRAME_MS = 1000 \/ FPS;/.test(de), 'G4 FPS = 60');
ok(/var FRAME_TOL = 6;/.test(de) && /if \(dt < FRAME_MS - FRAME_TOL\) return;/.test(de), 'G5 容忍窗口 6ms');
ok(/var ORBITS = \[[\s\S]*?1\.70, ry: 0\.34, tilt:\s*0\.86/.test(de), 'G6 四条轨道 rx 1.24→1.70');
ok(/var PALETTE = \['#7c93ad', '#c9a86a', '#8aab8e', '#a08cb4', '#b48a8a', '#6fa3b8'\];/.test(de), 'G7 域调色板 6 色');
ok(/var COLOR_LIMIT = 6;/.test(de) && /var NEUTRAL = '#525252';/.test(de), 'G8 >6 回退中性灰 #525252');
ok(/var INK = \[32, 34, 40\];/.test(de) && /var TRAIL_RAD = 1\.1;/.test(de) && /var TRAIL_SEGS = 9;/.test(de),
  'G9 墨色拖尾 INK / 1.1rad / 9 段');
ok(/var SAT_PERIOD = 18;/.test(de), 'G10 公转基准 18 秒');
ok(/var SPIN = \{ slow: 0\.012, normal: 0\.030, fast: 0\.055 \};/.test(de), 'G11 自转三档 0.012 / 0.030 / 0.055');
ok(/var TEX_SRC = 'assets\/dots-world\.png'/.test(de), 'G12 贴图路径');
ok(/seamless\.width = w \* 2;/.test(de) && /s\.scale\(-1, 1\);/.test(de), 'G13 正像 + 镜像 → 无缝长条');
ok(/function buildStrip\(\)/.test(de), 'G14 buildStrip：贴图按渲染尺寸预缩放');
ok(/function buildOverlay\(\)/.test(de), 'G15 buildOverlay：明暗叠加预烘焙');
ok(/function glowSprite\(color\)/.test(de) && /glowCache\[color\]/.test(de), 'G16 glowSprite：光晕按色缓存');
ok(/function baseAlphaOf\(depth\)/.test(de) && /0\.725 \+ depth \* \(depth >= 0 \? 0\.225 : 0\.20\)/.test(de),
  'G17 baseAlphaOf：连续 alpha，无跳变');
ok(/function satR\(it\) \{ return earthR \* \(0\.085 \+ 0\.075 \* it\.weight\) \* dpr; \}/.test(de),
  'G18 satR = 地球半径 × 0.085–0.160');
// 绘制顺序：地球 → 卫星，且卫星不分前后批
ok(/drawEarth\(c\);[\s\S]{0,400}items\.forEach\(function \(it\) \{ drawSatellite\(c, it\); \}\);/.test(de),
  'G19 卫星画在地球之后（不被遮挡）');
ok((de.match(/drawSatellite\(c, it\);/g) || []).length === 1, 'G20 卫星只画一批（真遮挡的前后批已废弃）');
ok(/drawRing\(c, o, false\)/.test(de) && /drawRing\(c, o, true\)/.test(de), 'G21 轨道环仍分前后半段');
ok(/Math\.min\(16, Math\.max\(0/.test(de), 'G22 卫星上限 16');
ok(/Math\.min\(4, Math\.max\(1/.test(de), 'G23 轨道 1–4');
ok(/Math\.min\(window\.devicePixelRatio \|\| 1, 2\)/.test(de), 'G24 dpr ≤ 2');
ok(/IntersectionObserver/.test(de) && /visibilitychange/.test(de), 'G25 离屏 / 隐藏暂停');
ok(/prefers-reduced-motion: reduce/.test(de), 'G26 reduced-motion');
ok(/Math\.min\(dt, 100\)/.test(de), 'G27 掉帧不加速');
ok(/canvas\.__dotEarthMounted/.test(de), 'G28 逐 canvas 幂等挂载');
ok(/window\.__dotEarthBootAll = bootAll/.test(de), 'G29 暴露 bootAll');
ok(/canvas\.dispatchEvent\(new CustomEvent\('dot-earth:pick'/.test(de), 'G30 派发 dot-earth:pick');
ok(!/canvas\.addEventListener\('pointermove'/.test(de), 'G31 画布不监听 pointermove');
ok(!/linear-gradient|radial-gradient\(circle at/.test(de), 'G32 脚本内不造 gradient 装饰');
ok(/requestAnimationFrame\(tick\)/.test(de), 'G33 单 rAF');

/* =========================================================================
 * H. 与 ui-preview.html 的内联副本同源（防漂移）
 * ======================================================================= */
section('H 内联副本同源');
ok(fs.existsSync(path.join(__dirname, 'sync-dot-earth.mjs')), 'H1 sync-dot-earth.mjs 存在');
const pvPath = path.join(__dirname, 'ui-preview.html');
if (!fs.existsSync(pvPath)) {
  ok(false, 'H2 ui-preview.html 不存在');
} else {
  const pv = fs.readFileSync(pvPath, 'utf8');
  const BEGIN = '<!-- ================= Dot Earth（点阵地球）· 脚本同源 dot-earth.html ============= -->';
  const i = pv.indexOf(BEGIN);
  ok(i >= 0, 'H2 ui-preview.html 有注入标记');
  if (i >= 0) {
    const end = pv.indexOf('</script>', i);
    const copy = pv.slice(i + BEGIN.length, end + '</script>'.length).replace(/^\n/, '');
    ok(copy === de, `H3 内联副本与定稿处逐字节相同（副本 ${copy.length} / 定稿 ${de.length}）`);
    if (copy !== de) {
      // 给出第一处差异，省得下次再逐行对
      let k = 0;
      while (k < Math.min(copy.length, de.length) && copy[k] === de[k]) k++;
      console.error('     首处差异 @', k, JSON.stringify(copy.slice(k, k + 80)), '≠',
        JSON.stringify(de.slice(k, k + 80)), '\n     → 跑 node sync-dot-earth.mjs');
    }
  }
}

/* =========================================================================
 * I. ADR-013 合规
 * ======================================================================= */
section('I ADR-013 合规');
const flat = css.replace(/\s+/g, '');
ok(!/backdrop-filter/.test(flat), 'I1 禁 backdrop-filter');
ok(!/filter:blur/.test(flat), 'I2 禁 blur');
ok(!/linear-gradient/.test(css), 'I3 CSS 内无 linear-gradient');
ok(!/box-shadow:\s*0\s+\d+px\s+\d+px\s+rgba/.test(flat), 'I4 无重阴影');
ok(!/[🎉✨🚀🔥💡]/.test(html), 'I5 无 emoji 字符');
ok(!/\bemoji\b/i.test(html), 'I6 无 emoji 关键字');
// 本页没有 CSS 动画（@keyframes / animation 计数为 0），所有运动都在 canvas 里，
// 因此降级走脚本内的 matchMedia（见 G26），不需要 @media (prefers-reduced-motion) 兜底。
ok(!/@keyframes|animation:/.test(css), 'I7 无 CSS 动画（运动全在 canvas，降级由脚本 matchMedia 负责）');

/* =========================================================================
 * J. 死链扫描
 * ======================================================================= */
section('J 死链扫描');
const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1])
  .filter((h) => !/^(#|https?:|mailto:)/.test(h));
const dead = hrefs.filter((h) => {
  const rel = h.split('#')[0];
  return rel && !rel.endsWith('/') && !fs.existsSync(path.join(__dirname, decodeURIComponent(rel)));
});
ok(hrefs.length > 0, `J1 本地链接 ${hrefs.length} 条`);
ok(dead.length === 0, dead.length ? `J2 死链：${dead.join(', ')}` : 'J2 零死链');
ok(fs.existsSync(path.join(__dirname, 'assets', 'dots-world.png')), 'J3 贴图 assets/dots-world.png 存在');
ok(fs.existsSync(path.join(__dirname, 'mini-star.html')), 'J4 mini-star.html 存在（仍被 §④ 引用）');
ok(fs.existsSync(path.join(__dirname, 'home-hero.html')), 'J5 home-hero.html 存在');

console.log(`\ndot-earth.smoke：${pass}/${pass + fail} passed`);
if (fail) { console.error(`!! ${fail} 项失败`); process.exit(1); }
