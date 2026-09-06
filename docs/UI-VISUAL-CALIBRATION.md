# UI-VISUAL-CALIBRATION — 视觉校准记录（Round 1，2026-09-07）

方法（指令书 §21）：implement → browser → screenshot → inspect → identify weakest → change → compare → repeat。
截图存档：`.workbuddy/tmp/reference-v1-*.png`（失败版）· `reference-v2-*.png` · `reference-final-*.png`（当前）。
校准页：`?design=reference`（`src/dev/ReferenceGallery.tsx` + `LiquidGlassLab.tsx`）。

---

## Round 1 迭代记录

### v1 → v2 的四个"最弱细节"及修复

| # | v1 问题（截图肉眼判定） | 修复 |
|---|---|---|
| 1 | **颜色太花哨**（Owner 裁定）：Glass 对照/按钮区背景为四色高饱和 radial 色斑，Liquid Glass 实验为整幅彩虹 conic——恰是指令书 §14 禁止的 gradient blob 审美 | 全部降饱和：色斑 alpha 降至 0.20–0.30、底色回归暖白；实验背景改为低饱和三色斑 + 暖灰渐变 |
| 2 | **布局拉伸**：校准页容器 `display:grid` 使 Button/Tabs/Popover 触发钮被拉成全宽横条 | Block 容器改 flex column + align-items:flex-start |
| 3 | **Glass A/B/C 不可判**：三卡放在素底上，玻璃与 plain 完全同观感 | A/B/C 移入低饱和富背景条——玻璃透过背景色可判 |
| 4 | **折射不可见**：`feImage` 仅用 `href` 有兼容风险；scale -42 / rim 40 偏弱 | 补 `xlinkHref` 双写；scale → **-70**、rim → 56、按下时 -120 |

### 有效（What worked）

- **Press 物理压缩**：scale 0.96 + brightness 0.96 + 影收紧 + 按下段 60ms——比 opacity 变化"像按物体"。
- **玻璃 specular 顶缘**：`inset 0 1px 0 rgba(255,255,255,.6)` + 双层影（环境+投射）——Popover/Toolbar 的玻璃从"白色圆角 div"变成"有厚度的板"。
- **FLIP 指示器**（Tabs/Segmented）：单实体移动，浏览器实测 mid-flight 连续插值。
- **hover 不缩放**：材质/高度变化（bg 提亮 + border 加深 + shadow-1→2）即足够。
- **字重分层**：按钮/选中 600、正文与 tab 标签 400——去掉 500 万能方案后层级更清晰。

### 失败/避免（What failed）

- v1 彩虹 conic 背景（渐变 blob 反模式，被 Owner 否）。
- `scale(1.05)` 式 hover（典型 Web AI 风）——未采用。
- 全局 `font-weight:500` 万能方案——已替换。

### 液态玻璃实验裁定（指令书 §15/§16）

| 档 | 实现 | 观感结论 |
|---|---|---|
| A 纯 blur | `blur(20px) saturate(180%)` | 雾白磨砂，边缘无折射——"看起来像磨砂，不像玻璃" |
| B SDF 边缘折射 | 运行时 canvas 生成圆角矩形 SDF 位移图 + `feDisplacementMap`（**负 scale** -70）经 `backdrop-filter: url(#lens)` | 背景色块在边缘弯折放大，中心不动——明显更"玻璃"；**动态中比截图更明显**（与 Apple "reads stronger in motion" 一致） |
| C 按压形变 | 按下 scale → -120 + 指针位置局部压暗 radial + 元素 scale 0.985 | 指尖压玻璃的暗示成立，release 由 spring-snappy 收 |

- 技术注意：`backdrop-filter: url()` 仅 Chromium 支持；**回退声明必须写在 url() 之前**（Safari/Firefox 自动降级为纯 blur，无需 @supports）。
- 位移图由运行时 `<canvas>` 生成（300×190 约 4ms，一次性），等价 liquid-glass-react 的 Python 生成脚本，零资产文件零依赖。
- **待 Owner 肉眼裁定**：B/C 档是否进入生产组件（Popover/Toolbar）。若采纳，需为其建生产级 SDF 生成 util + 组件接入 + 性能验证（同屏位移面预算）。

---

## 校准后参数终值（同步进 SPEC 的 OLOS 实现参数）

### Button 几何（[C]）
`min-height 44/32/52 (md/sm/lg)` · capsule · `padding 0 16px` · `font 14px/600, letter-spacing -0.01em` ·
hover=材质+高度（无 scale）· press=`scale(.96)+brightness(.96)+60ms` · release=spring-snappy 回弹。

### Popover 材质配方（[C]）
`radius 14px` · `border = white 55% mixed hairline` · 影四层：`inset top specular + 0.5px ring + 12px/32px 投射 + 2px/8px 近影` ·
materialize=`opacity .9→1, scale .96→1, blur 3→0, saturate .9→1, 300ms spring-gentle` · dissolve=`120ms ease-exit`。

### Glass 三档实验参数（[C]，实验页）
`map: SDF rim=56` · `refraction scale=-70（按下 -120）` · `blur(5px) saturate(160%) brightness(1.06)` ·
回退链：`blur+saturate 声明在前，url(#lens) 在后`。

### Icon 光学重量（[C]）
密几何降 stroke：settings 1.5 · galaxy/mindmap 1.8 · notes/graph/review/save/tutor/algorithm/error 1.9 · sync 2.1 · success 2.2 · 其余 2。

### Typography（[C]）
按钮/选中态 600；正文、tab/segment 标签 400；大标题 700；**全局禁 500 万能方案**；按钮 letter-spacing -0.01em。

---

## 最终审查十问（指令书 §29，Round 1 自评）

1. 静止是否安静？——✅（v2 相比 v1 大幅安静；按钮静止仅 shadow-1）
2. 内容是否视觉第一层？——✅（实验背景已降饱和）
3. 空间关系先于 border？——✅（分组靠 spacing/divider，控件靠浮起）
4. 控件有物理响应？——✅（press 压缩 + spring 回弹）
5. material 随上下文变化？——✅（glass 仅浮层；C 档交互响应）
6. 动画表达关系？——✅（指示器实体移动、popover 从 origin）
7. 快速操作流畅？——✅（CSS transition 天然 retarget，浏览器实测）
8. 有无 AI SaaS 感？——✅ 已去除（v1 色斑即此问题，v2 修复）
9. 删掉 Glass 设计仍成立？——✅（A 档 plain elevated 完全可用——正是保留 A/B/C 对照的原因）
10. 删掉动画信息结构仍成立？——✅（reduced-motion 语义降级 + 静态状态完备）

## 遗留判定（等 Owner）

- B/C 档折射是否进生产（建议：先在 Popover/Toolbar 各做一个试点对照）。
- Glass A vs B/C 的最终取舍（实验页保留，随时肉眼复判）。
