# UI-RELEASE-SCORECARD — Phase 3R 发布评分（2026-09-07）

每项附证据；评级基于 `UI-RELEASE-AUDIT.md` 两轮审计与真实浏览器截图集（`.workbuddy/tmp/audit/`）。

| Area | Score | 证据 |
|---|---:|---|
| Information Architecture | **9**/10 | 布局状态机 S0–S4 派生自任务动作；Explorer/Context 非常驻；任务×工作面矩阵落地（compare-1440 默认无三栏）。−1：Context 概念匹配仍为启发式（3B 精确化） |
| Visual Hierarchy | **8**/10 | Reading 第一眼测试 PASS（标题→meta→正文 680 居中）；Header actions 右置。−2：tab 溢出态与多 tab 场景的层级节奏待长会话检验 |
| Layout | **9**/10 | grid 状态机实测：header w=1388、reader x=406 w=680 精确居中；≤1024 抽屉、≤768 单列（审计截图 5 断点）。−1：900×700 极限宽度下 reading 列挤压（可接受范围） |
| Typography | **8**/10 | 阅读 17/1.75、标题 title/tight、meta caption 三层；400/600/700 无 500。−2：numeric 对齐（Mastery 百分比）未用 tabular-nums（落地项） |
| Components | **8**/10 | 10 Reference Components + 状态完备（empty/loading/error 全槽位接入）。−2：Sheet/CommandPalette 未经历 3R 视觉轮（3C 范围） |
| Material | **9**/10 | 玻璃仅 Rail 头部/Palette/Peek（实测 computed `saturate(1.8) blur(20px)`）；内容层 raised/base；ADR-013 §2.7.1 边界由门禁守护。−1：Peek 玻璃在浅底上的自适应（文字上方加影）未实现 |
| Motion | **8**/10 | spring 三 token + materialize/dissolve 语义；retarget 实测（tabs mid-flight 连续插值）；reduced-motion 语义降级截图。−2：图标 Replace/Bounce 未接入真实动作（ICON-MOTION 落地项） |
| Responsive | **8**/10 | 5 断点截图；≤1024 抽屉、≤768 移动式单列 + 并置 Sheet 化。−2：768 下 Focus/Peek 细节未逐一走查 |
| Accessibility | **7**/10 | 语义元素（tablist/dialog/listbox）+ aria-selected/expanded/busy + focus-visible ring + 焦点还原（palette）+ reduced-motion。−3：无屏幕阅读器实测；Explorer 中键并置无键盘等价（待 3B） |
| Performance | **8**/10 | 零依赖；backdrop-filter 同屏 ≤3（Palette/Peek 开启时才挂载）；动效仅合成属性。−2：未做滚动帧率量化（仅目测无掉帧） |
| Workflow UX | **9**/10 | 6 条 Workflow 真实数据浏览器 PASS（3A）+ 本轮再验；打开动词分级。−1：Compare Link 为内存演示 |
| Product Identity | **8**/10 | 竞品气味测试无 Obsidian/Notion/VS Code/SaaS 皮肤感；学习链（批注→概念→掌握度→复习入口）在 Context 内可见。−2：批注持久化缺席使链路末段弱于设计 |
| **合计** | **99/120（8.25 均分）** | |

## 发布 Gate 裁定

| Gate | 状态 |
|---|---|
| Information hierarchy | ✅ PASS |
| Reading experience | ✅ PASS（680 居中实测 + 排版系统） |
| Responsive | ✅ PASS（5 断点） |
| Accessibility | ✅ PASS（键盘/焦点/reduced-motion 实测；屏读实测列 3B） |
| Workflow continuity | ✅ PASS（6 条真实数据） |
| Visual consistency | ✅ PASS（Round 2 复检） |
| Performance | ✅ PASS（目测无掉帧；量化列 3B） |

**结论：UI RELEASE CANDIDATE（候选）**——允许进入 3B/3C 迭代；`Annotation 持久化`与`屏读实测`完成后方可声明 GA。
