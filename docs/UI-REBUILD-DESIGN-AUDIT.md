# UI-REBUILD-DESIGN-AUDIT — UI System Rebuild 设计审计（Phase 0 交付物）

> **2026-09-07 状态更新（项目所有者裁定）**：本文档的**工程结构与实施序列仍然有效**；
> 但其**设计决定已被 Research 阶段推翻重审**——以以下三份基于真实 Apple 官方资料的研究文档为准：
> `UI-APPLE-DESIGN-RESEARCH.md` · `UI-APPLE-MOTION-RESEARCH.md` · `UI-WEB-DESIGN-LANGUAGE.md`。
> 上一轮 Phase 1 代码仅代表"CSS foundation 工程完成"，不构成"Apple-inspired 设计系统完成"；
> 其中 glass 单一定义、motion 时长-only、reduced-motion 全零等决定按研究裁定修订（见 WEB-DESIGN-LANGUAGE §9）。

日期：2026-09-06 · 授权：项目所有者《Open Learning OS — UI System Rebuild》指令书
基线：`main = 31c328b` · 性质：Phase 0 只读审计 + Phase 1 设计基础层的依据文档
方向：**Apple-inspired / Liquid Glass / Learning Workbench**，在当前 `frontend/` 白纸上重建，
旧 `web/` 与根级 `ui/`（已于 `3fe8d13` 删除）**仅作考古参考，不作为实现资产**。

---

## 0. Anti-Drift Constraints（最高优先级，覆盖一切审美主张）

1. Apple-inspired ≠ Apple clone · 2. Liquid Glass ≠ 全站毛玻璃 · 3. 高级感 ≠ 渐变/阴影/Glow 堆砌
4. 灵动 ≠ 到处动画 · 5. Workbench ≠ VS Code clone · 6. Learning OS ≠ Dashboard
7. Context ≠ Card Wall · 8. Graph ≠ Chart · 9. Galaxy ≠ 游戏界面 · 10. Algorithm Lab ≠ Animation Player

优先级：**Content > Hierarchy > Interaction > Context > Material > Decoration**。
任何效果若降低阅读效率/信息层级/可操作性/性能/Accessibility → 删除。

---

## 1. 新设计原则（Open Learning OS — Scientific Spatial UI）

1. **内容为王**：阅读面永远是普通 surface；材质只服务交互层。
2. **空间表达层级**：优先 spacing / grouping / depth / typography，减少 border / divider / card。
3. **Liquid Glass 是功能层**：仅用于 Floating TopBar、Activity Rail、Command Palette、Popover、
   Sheet/Drawer、PeekPanel、Context Controls；**禁止全站玻璃化**（Apple HIG：Liquid Glass 只用于
   最重要的交互层）。
4. **Concentricity**：嵌套圆角成几何节奏（内层 radius = 外层 radius − padding，见 tokens 注释）。
5. **动画表达关系**：materialize / dissolve / morph / slide / scale / spring，必须回答"从哪来、
   到哪去、什么引起、什么在焦点"；禁止 bounce / 旋转 / 随机发光 / 大面积粒子。
6. **品牌 DNA 只继承语义**：暖白 + 石墨 + 克制橙（橙 = 注意力指针），视觉实现全部重写。
7. **Light workspace + dark immersive 技术面**：Galaxy / Graph / Algorithm 可视化 / 代码区允许暗色。

## 2. Design Tokens（实现于 `frontend/src/design/`）

```
design/
├── index.css        # 汇总入口（@import 顺序固定）
├── tokens.css       # color / radius / space / elevation / z-index
├── typography.css   # 字阶：display→caption + 阅读双尺度（阅读正文 17px/1.75）
├── surfaces.css     # 7 种 surface（base/raised/floating/glass/popover/sheet/immersive）
├── motion.css       # 时长/缓动 + prefers-reduced-motion 全局覆盖
├── layout.css       # App Shell 网格与断点变量（1280/1440/1920/2560）
└── DesignPlayground.tsx  # dev-only 预览（?design 查询参数进入）
```

Token 命名遵循指令书 §4 清单（`--color-*` / `--radius-*` / `--space-*` / `--motion-*`），
实现细节以 tokens.css 内注释为准（含 concentricity 推导规则与暗色 immersive 子树）。

## 3. Surface System

| Surface | 用途 | 材质 |
|---|---|---|
| base | 页面/阅读内容 | 平色，无阴影 |
| raised | 次级面板（Explorer/ContextRail 静止态） | 白 + hairline + 微影 |
| floating | Floating TopBar / Activity Rail | raised + 更大 shadow |
| **glass** | **仅限浮层交互**（Palette/Popover/Sheet/Drawer/Peek/浮层 toolbar） | backdrop-filter blur+saturate，hairline，柔和影 |
| popover / sheet | 弹层 | glass 材质 + 对应圆角/影 |
| immersive | Galaxy/Graph/Algorithm 可视化/代码 | 暗色子树，重定义局部 token |

约束：`backdrop-filter` 只允许出现在 glass/popover/sheet 三类；base/raised 禁用。
（此约束由 `design/design-tokens.test.ts` 源码门禁守护。）

## 4. Motion System

`--motion-instant 80ms / fast 120ms / standard 180ms / slow 240ms / spatial 320ms`；
`--ease-standard cubic-bezier(0.2,0,0,1)`、`--ease-exit`、`--ease-spring`（仅确认类反馈）。
`prefers-reduced-motion: reduce` → 全局动画时长压至 0.01ms。动画不是装饰，是信息。

## 5. Component Catalog（Phase 2 起，全部重写，不复制旧代码）

```
P0 原语：Button · IconButton · ButtonGroup · Toolbar · TextField · SearchField · Textarea
        · Select · Toggle · Checkbox · Radio · Slider · Tabs · SegmentedControl · Badge · Chip
        · StatusIndicator · Progress · ProgressRing · Tooltip · Popover · Menu · ContextMenu
        · Dialog · Sheet · Drawer · Toast · Banner · Skeleton · EmptyState · ErrorState
        · Breadcrumb · Divider
每组件必备状态：default / hover / pressed / focus / disabled / loading / selected
P1 知识组件：NoteTree · Outline · Backlinks · ConceptChip · ConceptInspector · LearningStatus
        · DecayIndicator · ReviewQueue · MistakeList · TutorContext · GraphInspector · GalaxyControls
P2 算法组件：AlgorithmWorkspace · CodePane · CodeLineHighlight · TraceTimeline · PlaybackControls
        · VisualizationCanvas（Array/Tree/Graph/Matrix/Stack/Queue/LinkedList Renderer）· VariableInspector
        · CallStack · StepInspector · StepExplanation
```
红线：无第三方 UI/icon/CSS 框架（MUI/Ant/Chakra/Tailwind/Radix/shadcn 均禁）；
图标用内部 SVG 小集合（统一 stroke/size/optical alignment，参考 SF Symbols 思路不复制资产）。

## 6. Workbench Layout

```
Floating TopBar（glass）
┌──────────┬──────────────────────────────┬──────────────┐
│Activity  │ Workbench（Tabs + 视图区）     │ ContextRail  │
│Rail      │                              │ /Inspector   │
│+Explorer │                              │              │
└──────────┴──────────────────────────────┴──────────────┘
Status / Utility（极简：Saved/Syncing/Provider unavailable）
```
- Activity Rail：icon-first 浮动导航（Notes/Graph/Galaxy/Review/MindMap/Algorithm Lab/Tutor/Settings）。
- WorkbenchTabs = 工作台多开标签（本地 UI state，非 URL 路由 → 与 ADR-029「无路由」不冲突，
  不引入 react-router）。
- ResizablePanels：拖拽/收起/恢复；布局仅存本地（UI pointer ≠ canonical data，循 ADR-030 先例）。
- QuickOpen/CommandPalette（Ctrl/Cmd+K）：Notes/Concepts/Actions/Recent 分组、键盘导航、fuzzy。
- PeekPanel：[[链接]] 就地预览（mastery/recall/review/mistakes + Open/Ask Tutor），Esc 关闭。
- 响应式：窄窗口 Explorer/ContextRail 可收起，Workbench 保持主体。

## 7. View Mapping（现状 → 目标）

| 现状（frontend/） | 目标工作区 |
|---|---|
| App.tsx 5 平级 tab | Activity Rail + WorkbenchTabs 工作区 |
| NotesView | Note Workspace（reading first，680px 舒适行宽，上下文浮动 toolbar） |
| ConceptsView | Explorer/Concepts + Concept Inspector + Peek |
| MasteryView | Learning Status（主掌握度 + 四维 + decay 时间线 + next action，非卡片墙） |
| ReviewView | Review Workspace（专注模式，1 Again/2 Hard/3 Good 键盘） |
| TutorView/ChatPanel | Contextual Tutor（Drawer/Sheet + streaming/Stop/partial，语义冻结项全保留） |
| （无） | Graph / Galaxy / MindMap / Algorithm Lab / Settings |

**冻结语义必须原样保留**：`presentError` 收口、`assistantMessageView` 生命周期呈现、
`sessionStorage` 会话指针（ADR-030）、`tutorSeed` ≠ 自动发送、UI 禁写「用户已停止」。

## 8. Algorithm Lab Architecture（Phase 5）

范式：**IDE Step-through（ADR-025 v3），不是 Animation Player**。
```
Trace API（已有 trace.py）→ Trace Model → Step Playback State Machine
                                    ├─ CodePane + CodeLineHighlight
                                    ├─ VisualizationCanvas（多 Renderer）
                                    └─ VariableInspector / CallStack / StepExplanation
```
数据边界：Backend 决定 events/step/line/variables/stack/state；Frontend 只做
visual state/selection/animation/presentation。**禁止前端重算算法逻辑**。
步进交互按 Apple spatial continuity：一次 step = 一个连续事件（行高亮→变量→元素移动→Inspector 同帧更新）。

## 9. Backend Capability Mapping（全部已存在，UI 只做消费）

notes · search(FTS5+CJK bigram) · concepts · links/backlinks · hierarchy · graph · mindmap ·
universe(galaxy) · mastery(4D+decay) · review(SM-2) · mistakes · memories · tutor+SSE ·
sync · export · trace(M9)。**结论：UI Rebuild 不需要任何后端改动。**

## 10. Implementation Sequence

| Phase | 内容 | 状态 |
|---|---|---|
| 0 | 只读审计（本文档） | ✅ |
| 1 | Design Foundation + Design Playground | ✅ 本轮交付 |
| 2 | Primitive Components（全状态可视化验证） | 待做 |
| 3 | Workbench Shell（Rail/Explorer/Tabs/Panels/Palette/Peek/ContextRail/StatusBar） | 待做 |
| 4 | Core Learning UI（Note/Graph/Galaxy/MindMap/Review/Tutor/LearningStatus） | 待做 |
| 5 | Algorithm Lab（接真实 /trace/*） | 待做 |
| 6 | Integration 一致性清扫 | 待做 |

Quality Gate（不使用"看起来不错"）：Visual（calm/层级即读/内容主导）· Interaction（每个过渡有
空间理由）· Product（吃满后端能力/学习上下文可见）· Engineering（零不必要依赖/零后端重复/
零 canonical 数据变异）。

---

## 11. 治理记录

- **ADR-013 §2.7 冲突解除**：本方向需要 Liquid Glass（backdrop-filter），与 §2.7「禁 gradient /
  backdrop-filter / glassmorphism / glow」冲突。按项目既定「带日期附录」修订形式，已在本轮提交
  ADR-013 附录 §2.7.1：**仅**解除 glass/popover/sheet 三类浮层交互面的 backdrop-filter 限制，
  gradient/glow 装饰禁令维持不变；使用范围由 §3 + 源码门禁守护。
- **ADR-029 不冲突**：WorkbenchTabs 为本地 UI state，非 URL 路由，不引入路由库（§117「路由需求
  出现时另立决策」——如未来需要深链再立）。
- **旧资产处置**：`3fe8d13^` 的 `ui/`、`web/` 只读考古（交互语义/已验证概念/被否方案），
  禁止复制代码进 `frontend/`。
- 本文档随 Phase 1 实现一并提交，是后续各 Phase 的验收依据。
