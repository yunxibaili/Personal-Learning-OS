/**
 * sync-dot-earth.mjs —— 把 dot-earth.html 里的组件脚本原样同步进使用方页面
 *
 * 用法：node sync-dot-earth.mjs [目标页...]
 *   默认目标：ui-preview.html
 *
 * 为什么需要它：ui-preview.html 是单页整合原型，组件脚本是**内联副本**（不走 iframe）。
 * 一旦 dot-earth.html 的定稿脚本改了，副本就会漂移。吸管脚本约定：
 * 定稿处只有一处 = dot-earth.html，其余页面一律由本脚本幂等覆盖。
 */
import { readFileSync, writeFileSync } from 'node:fs';

const SRC = 'dot-earth.html';
const targets = process.argv.slice(2).length ? process.argv.slice(2) : ['ui-preview.html'];

const BEGIN = '<!-- ================= Dot Earth（点阵地球）· 脚本同源 dot-earth.html ============= -->';

const src = readFileSync(SRC, 'utf8');
const m = src.match(/<script>\s*\/\* =+\s*\n\s*\* Dot Earth[\s\S]*?<\/script>/);
if (!m) {
  console.error(`✗ 在 ${SRC} 里没找到 Dot Earth 脚本块`);
  process.exit(1);
}
const block = m[0];

let exit = 0;
for (const t of targets) {
  const dst = readFileSync(t, 'utf8');
  const i = dst.indexOf(BEGIN);
  if (i < 0) {
    console.error(`✗ ${t}：未找到注入标记，请先插入\n  ${BEGIN}`);
    exit = 1;
    continue;
  }
  const end = dst.indexOf('</script>', i);
  if (end < 0) {
    console.error(`✗ ${t}：标记后没有 </script>`);
    exit = 1;
    continue;
  }
  const out = dst.slice(0, i) + BEGIN + '\n' + block + dst.slice(end + '</script>'.length);
  if (out === dst) {
    console.log(`= ${t}：已是最新，无需写入`);
  } else {
    writeFileSync(t, out);
    console.log(`✓ ${t}：已同步（脚本 ${block.length} 字节 / ${block.split('\n').length} 行）`);
  }
}
process.exit(exit);
