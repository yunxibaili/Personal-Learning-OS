/**
 * 组件层接线审计（临时诊断脚本，跑完即删）。
 *
 * 统计 web/src/components/ui + web/src/components/motion 的导出符号，
 * 在「业务代码」里的真实接线情况：
 *   - import 命中：文件里确实从组件层 import 了该符号
 *   - 实际调用：JSX <Name 或 函数式 Name( 的出现次数
 *
 * 业务代码 = web/src 下排除 components/ui、components/motion、
 * dev/、__tests__/、__mocks__/、ComponentGallery 的文件。
 *
 * 用法：node ui/audit-component-wiring.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..", "web", "src");

const EXCLUDED_DIR = /\/(dev|__tests__|__mocks__|ui|motion)$/;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (EXCLUDED_DIR.test(p.replace(/\\/g, "/"))) continue;
      if (/ComponentGallery/i.test(e.name)) continue;
      walk(p, out);
    } else if (/\.(tsx?|jsx?)$/.test(e.name)) {
      out.push(p);
    }
  }
  return out;
}

const files = walk(ROOT);

/** 基础组件层（primitives/basics/controls/Select/Toast） */
const BASIC = [
  "Button", "Input", "Tag", "Badge", "Skeleton", "Progress",
  "Select", "Textarea", "Checkbox", "Avatar",
  "Modal", "Tooltip", "SegmentedControl", "Tabs", "Switch",
  "ToastProvider", "useToast",
];
/** 动效基元层（components/motion） */
const MOTION = ["ProgressRing", "FadeInUp", "CountUp", "WaveLink"];

function importedNames(src) {
  const names = new Set();
  const re = /import\s+(?:type\s+)?\{([\s\S]*?)\}\s*from/g;
  let m;
  while ((m = re.exec(src))) {
    for (const raw of m[1].split(",")) {
      const n = raw.trim().split(/\s+as\s+/)[0].trim();
      if (n) names.add(n);
    }
  }
  return names;
}

function audit(names) {
  const res = {};
  for (const n of names) {
    res[n] = { importedIn: [], callIn: [] };
    for (const f of files) {
      const src = fs.readFileSync(f, "utf8");
      if (!importedNames(src).has(n)) continue;
      const rel = path.relative(ROOT, f).replace(/\\/g, "/");
      res[n].importedIn.push(rel);
      const uses = (src.match(new RegExp(`<${n}[\\s/>]|\\b${n}\\s*\\(`, "g")) || []).length;
      if (uses) res[n].callIn.push(`${rel}:${uses}`);
    }
  }
  return res;
}

function report(title, names, res) {
  console.log(`\n===== ${title} =====`);
  const wired = [], cold = [];
  for (const n of names) {
    const r = res[n];
    if (r.importedIn.length) {
      wired.push(
        `  ${n.padEnd(17)} import@ ${r.importedIn.join(", ").padEnd(46)} 调用 ${(r.callIn.join(", ") || "0（仅挂载未调用）")}`
      );
    } else {
      cold.push(n);
    }
  }
  if (wired.length) { console.log("-- 已接线 --"); wired.forEach((l) => console.log(l)); }
  console.log("-- 零接线 --");
  console.log("  " + (cold.join(", ") || "（无）"));
  console.log(`  小计：${names.length} 个中 ${wired.length} 个接线 / ${cold.length} 个零接线`);
}

console.log(`业务文件数（排除组件层·motion·dev·gallery·测试）：${files.length}`);
report("基础组件层（17 符号）", BASIC, audit(BASIC));
report("动效基元层（4 符号）", MOTION, audit(MOTION));
