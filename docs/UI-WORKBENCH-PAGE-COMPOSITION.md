# UI-WORKBENCH-PAGE-COMPOSITION — 页面构成与布局原型（Phase 3.5）

日期：2026-09-07 · 状态：**FROZEN 草案**
依据：`UI-WORKBENCH-COMPETITIVE-RESEARCH.md`（模式）· `UI-WORKBENCH-WORKFLOW-MODEL.md`（任务）· `UI-WORKBENCH-DESIGN-DECISIONS.md`（裁定）
本文回答：六种 layout archetype 里，每个 pane / 每条 chrome **为什么在这里**。

---

## 0. 六个 Layout Archetype 总表

| Archetype | 布局态 | Primary Surface | 可选 Panes | Toolbar | Context | Search |
|---|---|---|---|---|---|---|
| Reading | S0→S2 | Note 正文（680px 阅读列） | Explorer / Context | 浮动最小（面包屑+Context 开关） | Standard | L1 ⌘K / L3 ⌘F |
| Explore | S1 | Explorer+结果列表 | —（Explorer 即主体） | Explorer 内 scope 搜索 | 关 | L2 |
| Understand | S0/S2 | Note 或 Concept | Context=概念态 | — | Standard→聚焦 | L1 |
| Research | S1→S2 | Paper 正文 | Explorer / Context=Annotation 层 | 批注工具（选中时浮动） | Research 密度 | L3 |
| Compare | S3 | Object A │ Object B（等宽同几何） | 中缝关系操作 | 共享一条（两组操作） | 双对象各自的（折叠） | — |
| Focus | S4 | Review / 深读 | —（Rail 收纳） | 最小顶控（退出/进度） | Minimal（隐藏） | 禁（不打断） |

## 1. Reading Page（阅读）

```text
┌ Rail ─┬──────────────────────────────────────────┐
│       │ Floating TopBar：面包屑 · Context 开关    │
│       │ ┌──────── 680px ────────┐                │
│       │ │ H1 标题（largeTitle）  │                │
│       │ │ meta 行（概念 chips）  │                │
│       │ │ 正文（17/1.75）        │←右缘批注标记   │
│       │ │ [[链接]]（荧光笔黄底） │                │
│       │ └───────────────────────┘                │
└───────┴──────────────────────────────────────────┘
```
- **正文宽度**：保留 680px 固定阅读列 [C]（产品语义继承）；Explore/Research 态下 Explorer/Context 占用两侧，阅读列**不动**（pane 加宽不加列宽）。
- **Toolbar**：只留面包屑 + Context 开关 + （编辑时）浮动编辑条——正文工具不常驻。
- **批注标记**：右缘 8px 点位，Quiet 密度默认。
- **层级来源**：spacing + 字阶 + 面包屑；**无卡片、无内嵌边框**。

## 2. Research Page（论文/深研）

```text
[Rail][ Explorer(章节点) ][ Paper 正文 ][ Context=Annotation 层 ]
```
- **Outline 出现时机**：文档有结构且用户滚动/跳转时（S1 起）。
- **Context 出现时机**：产生第一条批注或点开任一批注时（S2）。
- **Chrome 量**：批注工具只在有选区时浮动出现（[A] Zotero 选中弹出色板模式）；常驻 chrome=0。
- 双向锚定：正文标记 ⇄ Context 条目（滚至锚点/聚焦条目）。

## 3. Writing Page（写作）

```text
[Rail][ Explorer(收缩) ][ Editor ][ Context(可选) ]
```
- **Editor + Context**，不是 Editor+所有功能：编辑工具收进浮动条（选区/焦点时出现）。
- 并置参考（Write+Reference 工作流）时 Context 收起，写作列保持 680px。
- 底部 Status Bar 唯一职责：Saved/Syncing（不打扰）。

## 4. Compare Page（并置工作区）

```text
[Rail][   Object A（主）   ][   Object B（Side Object）   ]
                            [中缝关系操作：Link/Reference/Create Concept]
```
- **两侧共享同一 reading geometry**：同一字阶、同一行宽规则、同一 padding——禁止两套排版、禁止巨型 Card（指令书 §34）。
- 分隔=thin divider + 中缝 hover 关系操作（上下文成立才显示，无常驻按钮）。
- 宽度可拖（ResizableSplitPane），默认对半；窄屏退化为 Tab 切换（同一状态机）。

## 5. Focus Page（专注）

```text
[Rail(图标收纳)][ 最小顶控：退出 · 进度 ][ Review / 深读正文 ]
```
- **保留**：Rail（收缩态）、退出按钮、任务进度。
- **消失**：Explorer、Context、Toolbar、Status 细节。
- **持续**：Review 计时/进度（学习语义）；**返回**：退出恢复进入前快照（tab/滚动/pane 宽度）。
- 范围 Scope（Bear 式）= Phase 4 提案（后端 scope 参数）。

## 6. Search 组成（非独立页）

- L1：Palette 浮层（左结果列表 + 右预览面板，↑↓ 联动）；预览面板可「在右侧打开」升迁为 Compare。
- L2：Explorer 内嵌（scope 占位符显式："在当前工作集中搜索"）。
- L3：Work Surface 顶部行内查找条（非浮层）。

## 7. Responsive Model（4 断点 + 收放规则）

| 断点 | Explorer | Context | Work Surface | Rail |
|---|---|---|---|---|
| ≥1440 | 可开（可拖宽） | 可开（可拖宽） | 主 | 全宽 |
| 1024–1440 | 与 Context **互斥**（开一个收另一个） | 同左 | 主 | 全宽 |
| 768–1024 | 收起（toggle 抽屉） | 收起→Sheet | 主 | 收纳图标 |
| <768 | Sheet | Sheet | 独占 | 底部导航变体 |
| 并置（Compare） | 强制收起 | 强制收起 | A│B 等分 | 收纳 |
| Focus | 收 | 收 | 独占 | 收纳 |

规则：任何宽度下 Work Surface 阅读列 ≥680px 优先保证；Compare 在 <1024 退化为 tab 切换；Peek 全断点可用（<768 全宽底部浮层=Sheet 变体）。

## 8. 空间关系速查（Material 服从 IA 的落点）

| 区域 | 材质 | 理由 |
|---|---|---|
| Rail / Floating TopBar | glass-regular | functional layer [A] |
| CommandPalette / Peek / Popover / Sheet / Drawer | glass-regular（clear 仅媒体上） | 浮层交互面 [A] |
| Explorer / Context / 正文 / Editor | base / raised | 内容层 [A] "Don't use Liquid Glass in the content layer" |
| Compare 双列 | raised ×2 + thin divider | 内容层并置，非卡片 |
| Toolbar（浮动态） | glass-regular | functional layer |
| Galaxy/Graph/Algorithm/Code | immersive 暗子树 | 可视化例外 |

## 9. 与实施阶段的对应

- 3A Shell：布局状态机 + Rail + ResizableSplitPane + Context 骨架（Standard 密度接真实 API）。
- 3B：Peek→Pin + Compare + 中缝关系操作。
- 3C：Search 三层 + Tutor sidecar + 批注密度开关（渲染侧）。
- 每步验收：真实浏览器 4 断点截图 + 交互 PASS + 主应用回归（既有门禁）。
