# ui/visual-engine/

**M9 Visual Engine 组件集**（契约来源：`docs/adr/ADR-025-visual-engine-v1.md` v3）。

### 目录原则（所有者裁定 2026-09-01）

| 项 | 规则 |
|---|---|
| 位置 | 组件、纯逻辑、契约类型**全部在这里** |
| 合并 | **不直接合入 `web/`**——`web/src/components/ui/index.ts` 不导出 M9 组件，避免「ui 库一套样式、项目里另一套」的双份来源 |
| 回灌 | 归 **M9-007**。解冻前不得提前在 `web/` 里复制一份 |
| 样式定稿 | `../visual-engine.html`（HTML 原型，内联 6 示例真实 TraceRun）；本目录 CSS 是它的**等值转写** |
| 旧稿 | `../archive/visual-engine-tsx-2026-09-01/`（样式定稿前的 TSX 稿，**冻结不再维护**） |

## 文件

```text
ui/visual-engine/
├── index.ts               # 唯一对外暴露面（组件 + 纯逻辑 + 类型 + CSS_PATH）
├── types.ts               # TraceRun v1 契约镜像（与 shared/types/trace.ts 同源）
│
├── stepping.ts            # 纯函数：nextStepIndex / canStep / stackDepth
├── stepping.test.ts       # 19 项
├── derive.ts              # 纯函数：formatValue / computeHitCounts / inlineValuesForLine /
│                          #          changedKeys / pickNumericArray / changedIndices /
│                          #          normalizeHeights / isArrayView / isFrameView
├── derive.test.ts         # 37 项
├── highlight.ts           # Python 词法着色（跨行字符串状态机）
├── highlight.test.ts      # 12 项
│
├── visual-engine.css      # .ve-* 样式，取值全部来自 ../../tokens.css（无裸值）
├── CodePane.tsx           # 代码窗：gutter 行号 + 热力条 + 当前行 + 调用者行 + 行内变量
├── DebugToolbar.tsx       # 步进控制条 + KEY_BINDINGS 导出
├── ArrayView.tsx          # 数值数组柱状图（模板 array）
├── FrameStackView.tsx     # 调用栈（栈顶在上，y 偏移表递归深度）
├── GeneralView.tsx        # 兜底：数组 chips + 帧列表
├── VisualEngine.tsx       # 组合壳：模板路由 + 键盘绑定 + onVisualize
│
└── tsconfig.check.json    # 仅类型自检。ui/ 无 node_modules，
                           # react 类型经 paths 指向 ../../web/node_modules/@types
```

## 心智模型：调试器，不是播放器

用户在这里是**逐步追问**，不是**观看动画**。

| 有 | 无 |
|---|---|
| Step Into / Over / Out / Continue / Back / Restart | ❌ 播放三角 |
| 步号 `n / total`、栈深、当前行 | ❌ 进度条、时间轴、自动播放 |

**键位刻意偏离 VS Code（F5/F10/F11/Shift+F11）**：F 键会被浏览器抢走（F5 刷新、F11 全屏），
笔记本上还需配合 Fn。改用 **↓ 进入 / → 跳过 / ↑ 跳出 / 空格 继续 / ← 后退 / R 重开**。

## 编码通道预算（ADR-025 §3.6 · 一个维度只占一个通道）

| 维度 | 通道 |
|---|---|
| 当前执行行 | 品牌橙底（唯一暖色行） |
| 调用者行 | 中性墨蓝底 |
| 命中次数 | gutter 竖条**透明度** |
| 变量变化 | 橙色**描边** |
| 递归深度 | 卡片 **y 偏移** |
| 数组值大小 | 柱**高度** |
| 栈顶帧 | 橙色**边框** |

## 同步路径

- 样式：`../../tokens.css` → `visual-engine.css` → （回灌后）`web/src/global.css` → build
- 类型：`types.ts` ↔ `shared/types/trace.ts` ↔ `server/app/core/tracer/snapshot.py`
- 行为：`../visual-engine.html`（原型冒烟驱动）↔ `*.tsx`

## 为什么**不**复用 `web/src/components/ui/primitives.tsx` 的 Button

ui 库**不得反向依赖** `web/`（依赖方向单向：`web/` 消费 `ui/`）。
且调试器按钮的视觉语言是 IDE 调试器，与通用 Button 不同。故独立写在 `visual-engine.css`。

## 验证（三条须全绿）

```bash
# 1) 纯逻辑单测 68 项
cd web && ./node_modules/.bin/vitest run --dir ../ui/visual-engine

# 2) 组件类型自检
cd ui/visual-engine && ../../web/node_modules/.bin/tsc --noEmit -p tsconfig.check.json

# 3) HTML 原型冒烟 36 项断言（驱动内联的真实 TraceRun）
node ui/visual-engine.smoke.js
```

> **已知验证边界**：React 层**没有渲染测试**——`web/` 未装 `@testing-library` / `jsdom`，
> 按项目「无理由不加依赖」红线不引入。React 层的保障目前是 `tsc` 0 error +
> 与 HTML 原型同构（原型冒烟驱动的是同一份逻辑与 DOM 结构）。

## 回灌检查清单（M9-007 · 所有者裁定前禁止提前动）

- [ ] ADR-025 v3 已批准
- [ ] 三条验证命令全绿
- [ ] 无头浏览器对 6 个示例 + 4 类 status 渲染自检通过
- [ ] 解冻 `web/src/components/ui/index.ts` 的注释，重新导出
- [ ] 在 `web/` 引入 `CSS_PATH`，走 `tokens.css` 四步改色铁律
