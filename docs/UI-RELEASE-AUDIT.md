# UI-RELEASE-AUDIT — Phase 3R 全局视觉审计（Round 1 + Round 2）

日期：2026-09-07 · 对象：Workbench Shell @ `43aa893` + Round 1/2 hardening
方法：真实运行（后端 8000 + dev 5173，真实 workspace 数据）× 5 断点截图 × 逐图肉眼审查
截图集：`.workbuddy/tmp/audit/`（note/context/contextonly/compare/search/review/tutor/reference × 1440/1280/1024/900/768）+ `reduced-motion-1440.png`

---

## Round 1 — 审计发现与修复

### 瀑布式发现（截图肉眼判定）

| # | 问题 | 严重度 | 修复 |
|---|---|---|---|
| 1 | **`workbench.css` 从未被导入**——Workbench 自 3A 起无样式运行（rail 横排、tabs/reader/pane 全为浏览器默认外观）。此前 3A 验收只断言了行为元素存在，未断言视觉 | **发布阻塞** | Workbench.tsx 顶部补 `import "./workbench.css"` |
| 2 | `index.css` 遗留 `main { max-width: 48rem }` 泄漏到 Work Surface `<main>`（实测 w=474px） | 高 | `.wb__pane--surface { max-width:none; margin:0; padding:0 }` |
| 3 | 默认打开第一篇笔记 = "BadPath"（测试残留），第一眼印象毁掉 | 高 | 默认对象启发式：过滤 `未命名*/BadPath/Untitled` → 取最近更新；无可选则直接开 Explorer |
| 4 | 阅读面是"裸 markdown 文本"：无标题层级/列表/引用/代码/图片占位 | 高 | NoteReader v2：h1-h3/ul/blockquote/pre/img 占位/hr/行内 bold+code |
| 5 | Context 无密度实现（文档三档、UI 单态）+ 无 loading/empty 状态 | 中 | ContextPane 三档密度切换（简/标/研）+ WorkState 组件 |
| 6 | Explorer/Context/Note 缺 empty/loading/error 态 | 中 | WorkState 三态接入全部槽位 |
| 7 | 无 L3 Document Find | 中 | NoteReader ⌘F 查找条（匹配计数 + Chromium window.find） |
| 8 | 20 个 tab 换行堆叠（审计脚本连续开 tab 暴露） | 中 | tabs 横向滚动不换行 + tab 不收缩 |
| 9 | 真实笔记的转义链接 `\[\[..\]\]` 未渲染为 wikilink | 中 | Inline/parseBlocks 入口归一化 `\[…\]` → `[[..]]` |
| 10 | Palette/Peek 关闭后焦点丢失 | 中 | Palette 关闭还原 lastFocused；Peek 恢复触发焦点沿用 |
| 11 | Context 开关浮在标题上（孤立圆钮） | 低 | 移入 Work Surface 头部 actions 区（tabs 左 · 动作右）；S3 下隐藏 |

### Round 1 后复检（styled 截图）

note-1440：阅读环境成型——680 居中、meta 行、17/1.75、wikilink 高亮下划线、rail 纵向安静。
第一眼测试 PASS：primary=标题，task=阅读，next=点高亮链接/⌘K。

## Round 2 — Fresh review 发现与修复

| # | 问题 | 修复 |
|---|---|---|
| 1 | Compare 态 Context 开关仍显示（并置时无意义入口） | S3 下隐藏 Context toggle |
| 2 | Context Research 密度未验证 | 补截图：Research 档显示全部 section（含 Sources 占位与诚实标注） |
| 3 | Reduced Motion 未冒烟 | `emulateMediaFeatures(reduce)` + reload 截图：布局/信息完整，动画消失 |
| 4 | Context 概念匹配启发式弱（title.includes） | 登记 3B 改进：改用 concepts API 精确关联（不在本轮扩面） |

### Round 2 后复检

- note-1440：阅读列 680 精确居中（实测 x=406 w=680）、wikilink 全部渲染为高亮下划线文本、无 raw markdown 残留。**第一眼 PASS**。
- compare-1440：双栏连续工作空间、同一排版系统、中缝 Swap/Close/Link 克服注意力原则、无双卡片感。**PASS**。
- context-research-1440：Context 安静（surface vs background 微差）、Research 密度 section 完整、学习动作可见。**PASS**。
- search-1440：Palette 左结果右预览同层，当前阅读不被视觉破坏。**PASS**。
- 768/900：≤1024 抽屉化生效、≤768 单列 + 并置变右侧全高 Sheet、Rail 收缩 44px。**PASS**（桌面优先产品，768 提供可用工作布局）。
- reduced-motion：信息结构完整、状态可理解。**PASS**。

---

## 遗留（诚实登记，不阻塞 RC）

1. Context 概念匹配启发式 → 3B 用 concepts API 精确化。
2. Paper/批注持久化 = Phase 4 提案（当前内存态已在 UI 标注）。
3. `window.find`（⌘F 高亮）为 Chromium 非标准 API——其余浏览器降级为计数条（已在代码注释）。
4. Compare 中缝 Link 为内存演示（不落盘），落盘需写契约确认。
5. dark-immersive 截图集待 Galaxy/Algorithm 接入后补。

## 最终发布审查十五问（§46）

1-3 ✅（Rail+标题+tab+搜索入口构成清晰定位）；4 ✅ 正文视觉中心（680 居中、chrome 最小）；5 ✅（Context 安静、无 accent 争夺）；6 ✅（S3 同几何连续空间）；7 ✅（Peek 轻量三动作）；8 ✅（预览不替换）；9 ◐（交互模型通、持久化 Phase 4）；10 ✅（sidecar 入口在 Context）；11 ✅ 无 Card Wall；12 ✅ 无 AI 生成感；13 ✅（Glass 仅 Rail/TopBar/Palette/Peek，去掉仍成立）；14 ✅（reduced-motion 全语义保留）；15 ✅（同一 token/材质/动效系统）。
