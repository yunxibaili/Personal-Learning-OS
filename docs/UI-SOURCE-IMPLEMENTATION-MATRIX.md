# UI-SOURCE-IMPLEMENTATION-MATRIX — Source-First 移植矩阵（2026-09-07）

策略（指令书 §0）：SOURCE-FIRST——成熟开源实现 → 读源码 → 移植 → 去依赖 → OLOS 适配 → 浏览器校准。
源码缓存：`.workbuddy/tmp/sources/`（浅克隆）。

## 1. License First（全部核验通过）

| Repo | License | 版权 | 处置 |
|---|---|---|---|
| seunghan91/ios27-design-system | **MIT** | (c) 2026 Dcode Labs (Seunghan Kim) | ✅ 移植（PRIMARY SOURCE） |
| hwyuanzi/LiquidGlass-UI | **MIT** | (c) 2026 Hollan Yuan | ✅ 参考（Web Components 材质管线） |
| lucaperullo/simple-liquid-glass | **MIT** | (c) 2025 lucaperullo | ✅ 参考（含 llms.txt / Claude skill） |
| Simonstorms/lore-glass | **MIT** | (c) 2026 Simon Gneuß | ✅ 参考（组件行为） |
| drawbuildplay/liquidglass-react | **MIT** | (c) 2025 drawbuildplay | ✅ 参考（组件组合） |

MIT 要求保留版权声明 → 所有移植文件头部已带 attribution。**未复制任何 Apple 官方资产/图形。**

## 2. Source Matrix

| Component | Primary Source | Secondary Source | OLOS Action | 状态 |
|---|---|---|---|---|
| Button | iOS27 Button.tsx/.css | lore-glass | **transplant ✅** | `components/ios27/Button.*`（5 variants×3 sizes，press scale(.97)+focus ring 4px+reduced-motion） |
| Tabs / Segmented | iOS27 SegmentedControl+TabBar | lore-glass Tabs | **transplant ✅** | `SegmentedControl.*`（roving 键盘、active=bg-primary+shadow） |
| Popover / Menu | iOS27 ContextMenu | lore-glass Popover | **transplant ✅** | `ContextMenu.*`（Portal+useFocusTrap+material('thick')） |
| Sheet | iOS27 Sheet | liquidglass-react Sheet | **transplant ✅** | `Sheet.*`（detent+drag-ready+--duration-sheet-*） |
| Toolbar | iOS27 Toolbar | liquidglass-react Toolbar | **transplant ✅** | `Toolbar.*`（title/leading/trailing/largeTitle/scrollY collapse） |
| Search | iOS27 SearchBar | — | **adapt ✅** | `SearchBar.*`（视觉=source；行为=OLOS 三层架构 [ADR-031]） |
| Sidebar / Rail | iOS27 — | macOS React | **custom（已按 HIG 自建）** | 3R.1 落地：quiet selection/分组/scroll edge |
| Glass | LiquidGlass-UI + simple-liquid-glass | lore-glass | **core 已自建（SDF 位移/feDisplacementMap）** | 3R.1 实验；生产接入前按 §20 对比选型 |
| Motion | iOS27 tokens（--easing-apple-default/--duration-*） | simple-liquid-glass | **adapt ✅** | bridge 映射到 OLOS --ease-standard/--spring-gentle |
| Icons | **OLOS SVG（禁 SF Symbols 资产）** | SF Symbols 行为 | **redesign（已完成）** | 3A Icon 分层系统 |
| Workbench | OLOS | macOS/VS Code 行为参考 | **custom** | ADR-031，不复制 desktop |

## 3. 移植实现记录（What copied / changed / why）

- **复制**：组件 TSX 逻辑、CSS 几何与动效、lib（cn/useControllableState/Portal/useFocusTrap/material/Icon）。
- **变更**：① import 路径 `../../lib` → `./lib`；② `cn` 的 clsx 依赖**剥离**为本地 join 实现（[指令书 §21] 依赖抽取）；③ tokens bridge 映射 `--color-blue`→OLOS accent（几何移植、色彩身份保持 OLOS [§52]）；④ 材质变量（--material-*/--blur-*）映射 OLOS 玻璃参数域。
- **依赖**：新增 0 个 npm 依赖；clsx 被替换。`tokens-bridge.css`/`materials.css`/组件 CSS 共约 1200 行。
- **行为保留**：press scale(0.97)、focus ring `0 0 0 4px 35%`、roving 键盘、sheet detent/drag、toolbar large-title collapse（scrollY>44）。

## 4. 遗留/后续

- Popover 采用 iOS27 **ContextMenu** 形态（menu 语义）；OLOS 侧普通 Popover（非菜单）仍用 3A 组件——两形态并存按语义选用。
- SegmentedControl `defaultSelected` 行为需复核（benchmark 截图显示 index 0）——3B 修。
- 第二阶段（Layout port）：Reading/Research/Compare/Focus 场景逐个对照 source page recipes（48 recipes 中的 Settings/List/Content/Navigation/Search/Sheet）。
