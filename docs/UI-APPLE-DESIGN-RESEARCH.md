# UI-APPLE-DESIGN-RESEARCH — Apple 当前设计语言研究（Phase 0 / Research）

日期：2026-09-07 · 性质：**真实网络研究**，不是"Apple 风格"四字臆测
研究来源（本轮实际访问并提取）：

| 来源 | 状态 |
|---|---|
| HIG: Materials | ✅ 完整提取（含 Liquid Glass 专节） |
| WWDC25-219《Meet Liquid Glass》 | ✅ 完整转录提取 |
| Apple Docs《Adopting Liquid Glass》 | ✅ 完整提取 |
| HIG: Buttons | ✅ 完整提取（2025-12 更新含 Liquid Glass 指引） |
| HIG: Motion | ✅ 完整提取 |
| SF Symbols 官方页 | ✅ 完整提取 |
| WWDC25-356 / 323 | ⚠️ 仅章节结构与开场转录（全转录未整页捕获）；其主题已被 219 + Adopting 文档覆盖，关键结论可交叉验证 |
| Mobbin / Awwwards / Radix | ⏸ 未访问——属组件实现期参考，Research 阶段不阻塞 |

---

## 1. Apple 当前 UI 为什么"显得轻"

研究结论（各来源交叉一致）：轻来自**分工**，不是来自"没有边框"这么简单。

1. **界面只有两层，且职责绝对分开**：HIG Materials 原文——
   > "Liquid Glass forms a distinct functional layer for controls and navigation elements — like tab bars and sidebars — that floats above the content layer, establishing a clear visual hierarchy between functional elements and content."
   功能层（控件+导航）悬浮在内容层之上；层级靠**层的物理关系**表达，而不是靠每层自己描边、加底色。
2. **背景被主动移除**：Adopting Liquid Glass——
   > "Reduce your use of custom backgrounds in controls and navigation elements."
   系统组件不再自带实底背景，让"浮起来"本身成为层级信号。移除背景 = 移除视觉噪音，同时保留控件可寻址性。
3. **材质替影子干活**：材质让底层颜色"透"上来建立方位感——
   > "By allowing color to pass through from background to foreground, a material establishes visual hierarchy to help people more easily retain a sense of place."
4. **色彩极度克制**：着色只给主操作——
   > "Tinting should only be used to bring emphasis to primary elements and actions in the UI."（219）
   且内容层要上色时上色在内容层："If you want to imbue color into your app, do it in the content layer instead."——玻璃控件本身基本保持单色。

**推论（对 OLOS 的强制含义）**：我们的 ContextRail/Explorer 之所以显得"重"，是因为用 border+card 模拟层级；Apple 的做法是把"谁浮在谁上面"作为第一层级的表达手段。

## 2. 为什么层级明显但边框很少

- 层级信号 = **z 空间（浮起）+ 材质（透）+ 影（自适应）+ 同心几何**，边框只是最后兜底。
- 影是**动态的、语义的**：219——
  > "The element is aware of what's behind it and increases the opacity of its shadow when it is over text. Conversely, it lowers the opacity of its shadow when it is over a solid light background."
  影子不是装饰，是可读性保障机制。
- 分隔靠 spacing/grouping（Toolbar 分组机制）："provide a grouping mechanism for toolbar items, letting you choose which actions display together"，组间用分隔符而非每项加框。

## 3. 为什么控件看起来像"漂浮"

- 漂浮是**导航层的存在方式**："Key navigation elements like tab bars and sidebars float in this Liquid Glass layer to help people focus on the underlying content."（Adopting）
- 静止态安静、交互时苏醒：
  > "Elements can even lift up into Liquid Glass temporarily... This lets the resting state stay visually quiet, while it comes to life on touch."（219）
- 失焦主动退场："when a window loses focus... Liquid Glass shifts its appearance and visually recedes to guide attention."（219）

## 4. 什么时候用 material / 什么时候不用（硬边界）

**用（Liquid Glass，仅此范围）**：
- 导航层：tab bars、sidebars、toolbars（"best reserved for the navigation layer that floats above the content"）
- 瞬态浮层：popovers、sheets、alerts、menus
- 内容层中的瞬时交互控件：激活瞬间可"暂时玻璃化"强调其可交互性（sliders/toggles，HIG Materials 例外条款）

**不用**：
- **内容层永远不用**：
  > "Don't use Liquid Glass in the content layer."（HIG Materials）
  放入内容层会 "compete with other elements and muddy the hierarchy"（219）
- **玻璃叠玻璃禁止**：
  > "always avoid glass on glass. Stacking Liquid Glass elements on top of each other can quickly make the interface feel cluttered and confusing."（219）
  玻璃上的元素用 fills/transparency/vibrancy，"use fills, transparency, and vibrancy for the top elements to make them feel like a thin overlay that is part of the material."
- **克制总量**：
  > "Use Liquid Glass effects sparingly... Limit these effects to the most important functional elements in your app."（HIG Materials）
- 稳态下内容不与玻璃相交："In steady states... avoid intersections between content and Liquid Glass."（219）

## 5. Regular / Clear 两变体（不得混用）

> "There are two to choose from: Regular and Clear. They should never be mixed."（219）

| 变体 | 特性 | 适用 |
|---|---|---|
| **regular** | 自适应、模糊+调亮度保可读，"works in any size, over any content" | 默认选择；alerts/sidebars/popovers 等文字多的组件 |
| **clear** | 无自适应行为、永久高透，**必须配压暗层**才有可读性 | 仅富媒体背景之上；需同时满足三条件（富媒体内容/压暗层无害/其上内容粗壮明亮）；亮背景需 "a dark dimming layer of 35% opacity"（HIG Materials） |

**Web 推论**：我们的 `.surface-glass` 单一定义是**不完整的**——必须拆 `glass-regular`（默认）与 `glass-clear`（媒体之上专用 + dimming layer），且两变体不得混用于同一视图。

## 6. Concentricity 为什么重要

> "Glass controls nest perfectly into the rounded corners of windows, maintaining concentricity throughout the UI."（219）

几何一致不是审美偏好，而是"控件属于容器"的从属关系证明； Apple 提供 `ConcentricRectangle` API 专做此事。嵌套圆角 = 内层 radius 由外层 radius 与 padding 推导，形成统一几何节奏。

## 7. Toolbar / Tab / Navigation 的空间组织

- 侧边栏与标签栏是**同一导航语言的两种形态**："The sidebar and tab bar, together, form a cohesive and consistent language for the core navigation of apps across all platforms... a single navigational element that fluidly scales as the canvas of the app grows."（219）→ 宽屏=sidebar，窄屏=tab bar，语义连续。
- 标签栏可随滚动退场："Tab bars can help elevate the underlying content by receding when a person scrolls up or down."（Adopting）→ 我们的状态栏/工具栏应有同款 scroll-edge 退让。
- Scroll edge effects 与玻璃协同："Scroll edge effects work in concert with Liquid Glass to maintain that crucial separation between the UI and content layers"（219）——内容滚入玻璃下方时被"gently dissolve"，而不是被玻璃硬压。
- 工具栏项分组 + 禁止混排："不要在共享背景的项目中混用文字与图标"；自定义间隔需审查一致性。

## 8. Apple 的动效为什么不像"网页动画"

见《UI-APPLE-MOTION-RESEARCH.md》。一句话版本：Apple 的动效是**材质的物理响应**（光、影、形变），而网页动画默认是**属性插值**（opacity/transform 从 A 到 B）。前者动的是"物"，后者动的是"参数"。

## 9. Buttons 专项（HIG，2025-12 Liquid Glass 版）

- **Anatomy = Style × Content × Role**："a button combines three attributes to clearly communicate its function: [Style / Content / Role]"
- **Prominence 节制**："Keep the number of prominent buttons to one or two per view."；"Use style — not size — to visually distinguish the preferred choice"
- **Role 语义**：Normal / Primary / Cancel / Destructive；"Don't assign the primary role to a button that performs a destructive action"
- **形状**：prefer capsule / circular；"the more rounded a button's shape, the easier it is for people to look steadily at it"；纵向列表用 rounded-rectangle，横向一行用 capsule；图标-only 用圆形
- **Press state 强制**："Always include a press state for a custom button. Without a press state, a button can feel unresponsive"
- **命中区**：≥ 44×44pt；玻璃按钮样式系统已提供 `glass` / `glassProminent`——"Instead of creating buttons with custom Liquid Glass effects, you can adopt the look and feel of the material with minimal code"
- **禁**：大小混排、破坏性主按钮、相似色 label/背景

## 10. 对"上一轮 Phase 1"的重新裁定（设计决定层面）

| 上一轮决定 | 研究后裁定 |
|---|---|
| 7 类 surface 单一 glass 定义 | **修订**：glass 必须拆 regular/clear 两变体；clear 附 dimming layer；禁止混用 |
| glass 定义未含"自适应"语义（shadow 随内容、明暗翻转） | **修订**：glass 材质需随内容自适应（至少：文字上方加影、可读性兜底） |
| motion 只有 5 个时长 token + 3 条曲线 | **不足**：缺 spring 模型（duration+bounce）、缺 materialize（非 fade）语义、缺 micro-interaction 库 |
| reduced-motion = 全部 0.01ms | **修订**：HIG 要求"motion optional 但信息不丢"——需保留 opacity 状态反馈与非动效层级线索 |
| Button 等原语未做 | 属 Phase 2；已获 anatomy 硬约束（上表） |
| Anti-Drift 10 条 | **确认有效**，与 Apple 官方限制条款一致 |

工程结构（design/ 目录、Playground、源码门禁模式）**保留**；上述设计决定按本文档执行修订。

---

## 附：逐字引用索引

- HIG Materials: developer.apple.com/design/human-interface-guidelines/materials
- WWDC25-219: developer.apple.com/videos/play/wwdc2025/219/（页面含带时间戳完整转录）
- Adopting Liquid Glass: developer.apple.com/documentation/TechnologyOverviews/adopting-liquid-glass
- HIG Buttons: developer.apple.com/design/human-interface-guidelines/buttons（Updated 2025-12-16）
- HIG Motion: developer.apple.com/design/human-interface-guidelines/motion
- SF Symbols: developer.apple.com/sf-symbols/
