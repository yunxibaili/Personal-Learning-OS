/**
 * 接线门禁：组件层是否真的进了业务代码（vitest 内跑，无新增依赖）。
 *
 * 守两类回归：
 *  1. **接线回退**——把 <Skeleton> 换回「加载中…」裸文案、把手写 tablist 换回来、
 *     删掉 CountUp 的 key（数字会永久停在旧值）、把 .btn-primary 改回渐变。
 *  2. **越界接线**——把 SegmentedControl 装到 ContextRail（丢 tab 语义与 Badge）、
 *     把 WaveLink 装到反链（丢 button 语义与键盘行为）、把 ProgressRing 装进右栏
 *     掌握度（那里已有 Progress 条，两套编码同一维度）、把 FadeInUp 装进编辑器。
 *
 * 判定依据 = ui/empty-states.html ④「动效基元落点清单」+ ui/README.md 落点表。
 *
 * 实现说明：@types/node 未安装，也不该为测试新增依赖，故源码用 Vite 的
 * import.meta.glob(?raw) 读进来（vite/client 已提供类型，见 src/vite-env.d.ts）。
 */
import { describe, expect, it } from "vitest";

const TS_RAW = import.meta.glob("../../**/*.{ts,tsx}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as unknown as Record<string, string>;
const CSS_RAW = import.meta.glob("../../**/*.css", {
  query: "?raw",
  import: "default",
  eager: true,
}) as unknown as Record<string, string>;

/**
 * glob 键是**相对本文件**的（Vite 行为），所以不同深度的文件前缀里 `../` 个数不同：
 *   "./primitives.tsx" | "../shell/ContextRail.tsx" | "../../views/NoteEditor.tsx"
 * 因此必须逐个 `..` 弹栈解析，才能统一成相对 src/ 的路径。
 *
 * 教训：最初写的是 `k.replace(/^(?:\.\.?\/)+/, "")`（单纯剥前缀），三层被压成一层，
 * ui 库自身于是被算进「业务文件」——「SegmentedControl 零引用」这类断言立刻假阳性，
 * 20 条失败里 18 条出自这里。见下方「路径解析正确」自检。
 */
const BASE = "components/ui"; // 本文件相对 src/ 的目录（glob 触达的顶层即 src/）
function norm(k: string): string {
  const stack = BASE.split("/");
  const parts = k.split("/");
  let i = 0;
  while (parts[i] === "..") {
    stack.pop();
    i += 1;
  }
  if (parts[i] === ".") i += 1;
  return [...stack, ...parts.slice(i)].join("/");
}

const SRC: Record<string, string> = {};
for (const [k, v] of Object.entries(TS_RAW)) SRC[norm(k)] = v;

const CSS: Record<string, string> = {};
for (const [k, v] of Object.entries(CSS_RAW)) CSS[norm(k)] = v;

const GLOBAL_CSS = CSS["global.css"] ?? "";

/** 剥掉 CSS 块注释——迁移说明里会点名旧类名，那是注释不是规则，不该被门禁判为残留 */
const stripCssComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "");

/**
 * 业务文件 = src 下排除组件层自身（/ui/ · /motion/）、dev 画廊、声明文件与测试。
 * 与 ui/audit-component-wiring.mjs 的口径一致。
 */
const BUSINESS = Object.keys(SRC).filter(
  (k) =>
    !/\.d\.ts$/.test(k) &&
    !/\.test\.tsx?$/.test(k) &&
    !/(^|\/)(ui|motion|dev)\//.test(k),
);

function file(rel: string): string {
  const src = SRC[rel];
  if (src == null) {
    throw new Error(
      `import.meta.glob 没读到 ${rel}。可用键：${Object.keys(SRC).sort().join(", ")}`,
    );
  }
  return src;
}

/** 该文件是否从组件层（import 路径以 /ui 结尾）导入了这个符号 */
function importsFromUi(rel: string, name: string): boolean {
  return new RegExp(
    `import\\s+(?:type\\s+)?\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from\\s*"[^"]*/ui"`,
  ).test(file(rel));
}

/** JSX `<Name ` 或调用 `Name(` 的出现次数——import 了不用不算接线 */
function usage(rel: string, name: string): number {
  return (file(rel).match(new RegExp(`<${name}[\\s/>]|\\b${name}\\s*\\(`, "g")) ?? []).length;
}

const CONTEXT_RAIL = "components/shell/ContextRail.tsx";
const REVIEW = "views/ReviewSessionView.tsx";
const GALAXY = "components/galaxy/GalaxyCanvas.tsx";
const NOTE_EDITOR = "views/NoteEditor.tsx";
const MEMORY_LIST = "components/memories/MemoryList.tsx";
const SKELETON_TARGETS = [NOTE_EDITOR, REVIEW, GALAXY];

describe("审计器自检（glob 读不到文件时必须炸，不能静默通过）", () => {
  it("业务文件集合非空且规模合理", () => {
    expect(BUSINESS.length).toBeGreaterThan(20);
  });

  it("路径解析正确：ui 库自身不算业务文件（否则下面每条门禁都是假阳性）", () => {
    expect(Object.keys(SRC)).toContain("components/ui/primitives.tsx");
    expect(Object.keys(SRC)).toContain("components/motion/index.tsx");
    expect(BUSINESS).toContain("views/NoteEditor.tsx");
    expect(BUSINESS).toContain("components/shell/ContextRail.tsx");
    for (const k of BUSINESS) {
      expect(k, k).not.toMatch(/(^|\/)(ui|motion|dev)\//);
    }
  });

  it("global.css 已读到且含 .btn-primary", () => {
    expect(GLOBAL_CSS.length, `读到的 CSS 键：${Object.keys(CSS).join(", ")}`).toBeGreaterThan(
      10_000,
    );
    expect(GLOBAL_CSS).toContain(".btn-primary");
  });

  it("五个目标文件全部可读", () => {
    for (const f of [CONTEXT_RAIL, REVIEW, GALAXY, NOTE_EDITOR, MEMORY_LIST]) {
      expect(() => file(f), f).not.toThrow();
    }
  });
});

describe("Skeleton：三处加载态", () => {
  for (const t of SKELETON_TARGETS) {
    it(`${t} 已接入 Skeleton（import 且真的用了）`, () => {
      expect(importsFromUi(t, "Skeleton")).toBe(true);
      expect(usage(t, "Skeleton")).toBeGreaterThan(0);
    });
  }

  it("NoteEditor 的 Suspense fallback 换成 EditorSkeleton，不再是裸文案", () => {
    const src = file(NOTE_EDITOR);
    expect(src).toContain("fallback={<EditorSkeleton />}");
    expect(src).not.toContain('className="tutor-answer empty-hint"');
  });

  it("ReviewSessionView 的 loading 不再是「加载中...」", () => {
    expect(file(REVIEW)).not.toContain(">加载中...<");
  });

  it("GalaxyCanvas 的 loading 不再用可见标题占位（改用骨架 + sr-only）", () => {
    expect(file(GALAXY)).not.toContain('className="galaxy-caption__title">载入星系…');
  });

  it("骨架是 aria-hidden，故三处都补了 sr-only 文案给读屏用户", () => {
    for (const t of SKELETON_TARGETS) {
      expect(file(t)).toContain('className="sr-only"');
    }
  });
});

describe("Toast：Provider 挂载不算接线，要的是真调用", () => {
  for (const t of [NOTE_EDITOR, REVIEW]) {
    it(`${t} 调 useToast 并真的 push 了`, () => {
      const src = file(t);
      expect(importsFromUi(t, "useToast")).toBe(true);
      expect(/toast\s*=\s*useToast\(\)/.test(src)).toBe(true);
      expect(/toast\.push\(/.test(src)).toBe(true);
    });
  }

  it("toast 只作瞬时提醒，error banner 保留为持久记录（两条通道各管一件事）", () => {
    expect(file(NOTE_EDITOR)).toContain("error-banner");
    expect(file(REVIEW)).toContain("error-banner");
  });
});

describe("Tabs：右栏手写 tablist 已换成组件", () => {
  it("ContextRail 接了 Tabs", () => {
    expect(importsFromUi(CONTEXT_RAIL, "Tabs")).toBe(true);
    expect(usage(CONTEXT_RAIL, "Tabs")).toBeGreaterThan(0);
  });

  it("不再有手写 role=tablist / ctx-rail__tab（两套 tab 语义必然漂移）", () => {
    const src = file(CONTEXT_RAIL);
    expect(src).not.toContain('role="tablist"');
    // 只查 className 值，且要 \b：迁移说明的注释里点名旧类名不算残留；
    // 而 Tabs 的容器类名是 ctx-rail__tabs，它是 ctx-rail__tab 的前缀子串，无边界会误判
    expect(src).not.toMatch(/className=[{"][^"}]*ctx-rail__tab\b/);
  });

  it("CSS 里 .ctx-rail__tab 规则已迁走，不留样式孤儿", () => {
    const css = stripCssComments(GLOBAL_CSS);
    expect(css).not.toMatch(/\.ctx-rail__tab\b/);
    expect(css).toContain(".ctx-rail__tabs .ui-tabs__item");
  });

  it("反链计数经 badge 槽位传入，没有丢", () => {
    expect(file(CONTEXT_RAIL)).toContain("badge:");
    expect(file(CONTEXT_RAIL)).toContain("backlinks.length");
  });
});

describe("CountUp：右栏待复习数，key 是这个函数的关键", () => {
  it("ContextRail 接了 CountUp", () => {
    expect(importsFromUi(CONTEXT_RAIL, "CountUp")).toBe(true);
    expect(usage(CONTEXT_RAIL, "CountUp")).toBeGreaterThan(0);
  });

  it("带 key={home.review_due}——CountUp 只在首次进视口跑一次，值变了不重挂载就永远停在旧数字", () => {
    expect(file(CONTEXT_RAIL)).toMatch(/<CountUp\s+key=\{home\.review_due\}/);
  });
});

describe("ProgressRing：只落复习完成页", () => {
  it("接在 ReviewSessionView", () => {
    expect(importsFromUi(REVIEW, "ProgressRing")).toBe(true);
    expect(usage(REVIEW, "ProgressRing")).toBeGreaterThan(0);
  });

  it("不进右栏掌握度——那里已有 Progress 条，再加圆环即两套编码同一维度", () => {
    expect(importsFromUi(CONTEXT_RAIL, "ProgressRing")).toBe(false);
  });
});

describe("FadeInUp：只落列表入场，不进编辑器", () => {
  for (const t of [CONTEXT_RAIL, MEMORY_LIST]) {
    it(`${t} 接了 FadeInUp`, () => {
      expect(importsFromUi(t, "FadeInUp")).toBe(true);
      expect(usage(t, "FadeInUp")).toBeGreaterThan(0);
    });
  }

  it("编辑器目录零 FadeInUp（写作时任何入场动画都是干扰）", () => {
    const editorFiles = BUSINESS.filter((p) => /components[\\/]editor[\\/]/.test(p));
    expect(editorFiles.length, "编辑器目录应该有文件，否则本条空转").toBeGreaterThan(0);
    for (const p of editorFiles) {
      expect(SRC[p], p).not.toContain("FadeInUp");
    }
  });
});

describe("Button：空态 CTA 落点 + ADR-013 §2.7 / §2.13 守卫", () => {
  it("接在星系空态——此前 0 接线，卡点正是 .btn-primary 的渐变", () => {
    expect(importsFromUi(GALAXY, "Button")).toBe(true);
    expect(usage(GALAXY, "Button")).toBeGreaterThan(0);
  });

  it(".btn-primary 规则块内无 gradient / box-shadow，且是 --brand-deep 实底", () => {
    const block = /\.btn-primary\s*\{([^}]*)\}/.exec(GLOBAL_CSS);
    expect(block, "global.css 里找不到 .btn-primary 规则块").not.toBeNull();
    const body = block![1];
    expect(body).not.toContain("gradient");
    expect(body).not.toContain("box-shadow");
    expect(body).toContain("var(--brand-deep)");
    expect(body).toContain("var(--text-inv)");
  });

  it("空态只有一个 button（ui/empty-states.html ⑤ 门禁 2：卡内 button 数 = 1）", () => {
    const src = file(GALAXY);
    const emptyBlock = /if\s*\(!planet\)\s*return\s*\(([\s\S]*?)\n\s*\);/.exec(src);
    expect(emptyBlock, "找不到 !planet 空态分支").not.toBeNull();
    expect((emptyBlock![1].match(/<Button[\s/>]/g) ?? []).length).toBe(1);
  });
});

describe("落点清单判「不适用」的两个组件，不许被手滑接入", () => {
  it("SegmentedControl 业务零引用（它渲染 radiogroup，换掉 ContextRail 的真 tab 会丢语义与 Badge）", () => {
    for (const p of BUSINESS) {
      expect(SRC[p], p).not.toMatch(/\bSegmentedControl\b/);
    }
  });

  it("WaveLink 业务零引用（反链是「打开笔记」动作，button 语义正确；换成 <a> 会丢键盘行为）", () => {
    for (const p of BUSINESS) {
      expect(SRC[p], p).not.toMatch(/\bWaveLink\b/);
    }
  });
});
