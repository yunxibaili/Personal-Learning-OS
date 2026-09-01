/**
 * ui 库健康审计（临时诊断，跑完即删）。
 *
 * 报告三件事，为「启用留在根目录 / 不用归档进 archive/」提供证据：
 *   1. 死链：每个 html 里 href="./xxx" 指向不存在的文件
 *   2. 孤儿：ui 根目录的 html 没有被 index.html 登记成卡片
 *   3. 未登记：文件存在但 README.md / UI_DESIGN.md 一次都没提
 *
 * 用法：node ui/audit-ui-health.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const UI = path.dirname(fileURLToPath(import.meta.url));

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "archive" || e.name === "assets" || e.name === "node_modules") continue;
      walk(p, out);
    } else if (e.name.endsWith(".html")) {
      out.push(p);
    }
  }
  return out;
}

const pages = walk(UI);
const indexSrc = fs.readFileSync(path.join(UI, "index.html"), "utf8");
const readmeSrc = fs.readFileSync(path.join(UI, "README.md"), "utf8");
const designSrc = fs.readFileSync(path.join(UI, "UI_DESIGN.md"), "utf8");

// ---------- 1. 死链 ----------
console.log("===== 1. 死链检查（href=\"./...\" 指向不存在的文件） =====");
let deadTotal = 0;
for (const f of pages) {
  const src = fs.readFileSync(f, "utf8");
  const rel = path.relative(UI, f).replace(/\\/g, "/");
  const bad = new Set();
  for (const m of src.matchAll(/href="\.\/([^"#?]+)/g)) {
    const target = path.resolve(path.dirname(f), m[1]);
    if (!fs.existsSync(target)) bad.add(m[1]);
  }
  if (bad.size) {
    deadTotal += bad.size;
    console.log(`  ✗ ${rel}`);
    for (const b of bad) console.log(`      → ${b}`);
  }
}
console.log(deadTotal === 0 ? "  无死链" : `  合计 ${deadTotal} 处死链`);

// ---------- 2. 孤儿（根目录 html 未被 index.html 登记）----------
console.log("\n===== 2. 根目录 html 是否登记进 index.html =====");
const rootHtml = pages
  .filter((p) => path.dirname(p) === UI && path.basename(p) !== "index.html")
  .map((p) => path.basename(p));
for (const name of rootHtml) {
  const registered = indexSrc.includes(`href="./${name}"`);
  console.log(`  ${registered ? "✓" : "✗ 未登记"}  ${name}`);
}

// ---------- 3. 文档未提及 ----------
console.log("\n===== 3. 文档登记情况（README / UI_DESIGN 提及次数）=====");
for (const name of rootHtml) {
  const r = (readmeSrc.match(new RegExp(name.replace(/\./g, "\\."), "g")) || []).length;
  const d = (designSrc.match(new RegExp(name.replace(/\./g, "\\."), "g")) || []).length;
  const flag = d === 0 ? "   ← UI_DESIGN 零登记" : "";
  console.log(`  ${name.padEnd(28)} README:${String(r).padEnd(3)} UI_DESIGN:${String(d).padEnd(3)}${flag}`);
}

// ---------- 4. 体积 ----------
console.log("\n===== 4. 根目录 html 体积（>100KB 标粗）=====");
for (const name of [...rootHtml, "index.html"].sort((a, b) => {
  const sa = fs.statSync(path.join(UI, a)).size;
  const sb = fs.statSync(path.join(UI, b)).size;
  return sb - sa;
})) {
  const kb = (fs.statSync(path.join(UI, name)).size / 1024).toFixed(1);
  console.log(`  ${(kb + " KB").padStart(10)}  ${name}${Number(kb) > 100 ? "   ← 偏大" : ""}`);
}
