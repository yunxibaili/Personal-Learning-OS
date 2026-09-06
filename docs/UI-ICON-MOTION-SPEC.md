# UI-ICON-MOTION-SPEC — 图标系统与语义动效规范（Phase 1.5 Frozen）

日期：2026-09-07 · 状态：**FROZEN**
依据：SF Symbols 官方页（Bounce/Wiggle/Rotate/Breathe/Magic Replace/Draw/Variable Rendering，
"These animated effects leverage a symbol's layer structure"）+ `UI-APPLE-MOTION-RESEARCH.md` §6。
来源标注：[A] Apple Fact / [B] Interpretation / [C] OLOS Decision。
红线：**不复制 Apple 图标资产** [A 指令书]；不引入 icon library；内部 SVG 自绘。

---

## 1. 图标几何规范（对齐 SF Symbols 思路，不复制资产）

> [A] SF Symbols："nine weights and three scales, automatically align with text... multi-layer drawings designed for motion"。

[C] 转译为内部图标标准：
- 网格 24×24，绘制区 20×20（2px 安全边）；
- stroke 宽度三档：regular 1.8 / medium 2.2 / bold 2.6（随 UI 字重匹配）；
- 尺寸：16 / 20 / 24（`--icon-sm/md/lg`），默认 20；
- 圆角端点（round cap/join），光学对齐优先于几何居中；
- 单色 currentColor 继承；状态色只经语义 token。

## 2. 分层结构（动效的前提）

> [B] Apple 动效"leverage a symbol's layer structure"——不分层就没有语义动效。

每个图标 SVG 内部按四层组织（`<g data-layer="...">`）：

```text
icon
├── base geometry    （主形，永不单独动）
├── semantic layer   （语义差异部分：如播放▶/暂停‖ 的可变段）
├── state layer      （状态附加：角标、对勾、警示点）
└── transition layer （动效专用：opacity/transform 挂载点）
```

要求：全部内部图标注册到 `frontend/src/components/icons/`（Phase 2A 建），导出 `<Icon name size />`；
首批清单（指令书 §17 验证集 + Rail 需要）：

```text
Search · Close · Back · Forward · Play · Pause · Sync · Save · Success · Error
Review · Tutor · Notes · Graph · Galaxy · MindMap · AlgorithmLab · Settings
Plus · ChevronDown/Up/Left/Right
```

## 3. 语义动效语言（四种，一一对应 SF Symbols 研究）

| 动效 | SF 对应 [A] | OLOS 触发语义 [C] | Web 实现 |
|---|---|---|---|
| **Replace** | Magic Replace（"contextual continuity when transitioning between related symbols"） | 同位置状态对切换：Play↔Pause · Sync 进行↔完成 · 收藏态 | 旧层 dissolve(60ms) + 新层 materialize(80ms)，同尺寸同位置，spring-bouncy 轻弹一次 |
| **Bounce** | Bounce（"respond to user input, convey status changes"） | 操作确认：复制成功、保存完成、加入复习 | semantic/state 层 translateY spring 单次（-3px→0），仅一次性事件 |
| **Breathe/Pulse** | Breathe（"signal ongoing activity"） | 持续活动：同步中、Tutor 生成中、保存中 | opacity 1→0.55→1，2s 循环；reduced-motion 降为常亮状态色 |
| **Draw** | Draw On/Off（"inspired by the calligraphic movement of handwriting"） | 首次出现的引导/空态插画级图标 | stroke-dashoffset 描绘，spatial 时长；**克制**：仅空态/首启，不做日常交互 |

**Variable Rendering 转译** [A]："Variable Color changes the opacity of individual layers in sequence"——
进度类图标（Sync 中）按层序轮转 opacity（CSS 分层 animation delay），reduced-motion 降级为静态部分填充。

## 4. 禁动清单（与 HIG Motion 对齐）

- 高频交互（列表 hover、普通按钮 hover）图标**不做动画** [A] "avoid adding motion to UI interactions that occur frequently"；
- 装饰性 Wiggle/Rotate 不引入（无对应产品语义）；
- 任何图标动画必须过九问（UI-MOTION-SPEC §8）；
- reduced-motion：全部图标动效降为静态状态表达（Breathe→常亮，Replace→直接切换）[A] "Make motion optional"。

## 5. 验收标准

1. 每个内部图标通过分层审计（四层标注齐全，无动效需求的允许合并层）；
2. Replace/Bounce/Breathe 三种动效在 Component Laboratory 的 Motion Lab 中可真实触发/打断/切 reduced-motion；
3. 图标与文字基线对齐（vertical-align 校验）；
4. 全部图标 `aria-hidden` 或配 `aria-label`（装饰 vs 语义区分）。
