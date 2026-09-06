# UI-WORKBENCH-WORKFLOW-MODEL — 工作流模型（Phase 3.5）

日期：2026-09-07 · 状态：**FROZEN 草案**（实施依据）
前置：`UI-WORKBENCH-COMPETITIVE-RESEARCH.md`（模式来源）· `UI-WORKBENCH-IA.md`（布局状态机 S0–S4）

---

## 0. 一级设计原则（正式采纳）

> **One object in focus. Everything else stays close, contextual, and reversible.**
> 一个对象保持焦点。其他知识保持靠近、相关、可逆。

四个推论（贯穿所有工作流）：
1. **Focus**：视觉中心永远只有一个 Work Object；任何时刻只有一个 primary。
2. **Context**：与焦点对象相关的信息在 Context Pane 跟随出现，但不抢焦点。
3. **Nearby**：次级对象可进入并置位（Compare），与主对象共享同一工作流。
4. **Reversible**：一切出现都可退回（Peek→Esc、Compare→合并回单栏、Focus→恢复原 workspace state）。

**什么占据中心 / 暂时出现 / 值得固定 / 自动隐藏**：
- 占据中心：用户显式打开的对象（click/Enter）。
- 暂时出现：Peek（查看类动作）、选中气泡、Toast。
- 值得固定：被用户显式 pin/在右侧打开的对象、被链接过的概念 Context。
- 自动隐藏：与当前对象无关的 pane（Explorer/Context 在专注任务中退场）、滚动时 TopBar 收纳。

## 1. Work Object Model

Workbench 的中心不是 Editor，是 **Work Object**。对象类型 × 能力矩阵：

| 对象类型 | 默认打开方式 | 可 Peek | 可并置（右对象） | 可 Tab | 可成 primary |
|---|---|---|---|---|---|
| Note | Peek（链接点击）/ Open（显式） | ✓ | ✓ | ✓ | ✓ |
| Concept | Peek → Context 聚焦 | ✓ | ✓（定义+回链视图） | ✓ | ✓ |
| Paper（附件，Phase 4+） | Open（阅读型） | ✗（内容重） | ✓（+Note 边注） | ✓ | ✓ |
| Search 结果集 | Open（结果集即对象） | — | ✓（结果+预览） | ✓ | ✓ |
| Annotation | Context 聚焦（不独立打开） | ✓ | — | ✗ | ✗ |
| Review | Focus Mode（S4） | ✗ | ✗ | ✗ | ✓（独占） |
| Tutor Context | Sidecar（Context 内/Drawer） | ✗ | ✓（窄屏 Drawer） | ✗ | ✗ |
| Graph/MindMap | Open | ✗ | ✓ | ✓ | ✓ |
| Algorithm Trace | Open | ✗ | ✗（三栏固定） | ✓ | ✓ |

> [A] Notion per-view default 转译：**按对象类型设默认打开方式**；[A] Tana 转译：tab=另一工作流、并置=同一工作流的第二对象。

## 2. 对象生命周期（四级评估后裁定）

指令书提议 Peek → Context → Pinned → Tab 四态。**评估结论：四态成立，但 UI 载体合并为三个**：

```text
Peek（浮层，查看）        → 独立 UI：PeekPanel
Context（跟随，关系）     → 独立 UI：Context Pane（自动跟随焦点对象）
Pinned（固定，参考）      → 无独立 UI：= 并置位（Compare 右槽）中的对象固定态
Tab（独立，工作任务）     → 无独立 UI：= Work Surface 的 WorkbenchTabs
```

理由：Pinned 与"在右侧打开"本质是同一动作（对象进入并置位且不被替换 [A] VS Code locked group；[A] Obsidian "links in a pinned tab always open in another tab"）；Tab 与 pinned 的差异只是"是否独占工作流"。**四个生命周期 × 三个 UI 载体 + 一组升迁动词**：

```text
查看（Peek）→ 聚焦（Context 跟随）→ 打开（Open/替换 primary）→ 并置（Open Right/Pin）
任意状态可逆：Esc（Peek）/ 合并（Compare→单栏）/ 关闭（Tab）
```

## 3. 任务模型（10 项，每项九要素）

通用：Entry 来自 Rail/链接/快捷键；Persistent=Work Surface tab + pane 状态；Temporary=Peek/气泡；Escalation=升迁动词（§2）。

| 任务 | Goal | Primary | Secondary | Context 内容 | Entry | Exit | Escalation |
|---|---|---|---|---|---|---|---|
| Read | 读完并留住理解 | Note | —（默认 S0） | 可展开 Outline/回链 | Rail/搜索 | — | [[链接]]→Peek；选中→批注 |
| Explore | 找到"该看什么" | —（导航态） | Explorer 结果 | — | Rail/⌘1 | 点开对象→Read | 结果→Open Right |
| Understand | 弄懂概念 | Concept/Note 段落 | — | 概念 Context（Mastery/定义） | Peek→聚焦 | — | Ask Tutor；Mark Weak |
| Compare | 对照两个对象 | Note A | Note B | 关系操作（Link/Ref） | Open Right | 合并回单栏 | 中缝 Link/Create Concept |
| Research（论文） | 深读文献并沉淀 | Paper | — | Annotation 层 | 打开附件 | — | Highlight→Annotation→Concept |
| Annotate | 把原文变记忆 | 选区 | — | 该批注上下文 | 选中文字 | — | Add to Review/Create Note |
| Write | 写作并引用 | Editor | 参考 Note（并置） | Related | Rail | — | 引用→建立 link |
| Review | 巩固记忆 | Review Card | — | 概念 Context | Rail/弱概念入口 | 回原 workspace | Again/Hard/Good |
| Recall | 自测 | Review Card | — | — | Review | — | Mark Weak→错题 |
| Ask Tutor | 定向求解释 | 当前对象+选区 | Tutor Sidecar | source+selection+concept | 选中气泡/Context | 收起 | Add to Review |

## 4. 六条 Workflow Prototype（验收剧本）

每条回答指令书 §41 八问（进入/焦点/临时/固定/可弃/上下文去向/返回/保留状态）。

### A. Read → Understand
```text
进入：Rail→Notes→打开笔记（S0）。焦点：Note 正文。
临时：[[Attention]] 点击→Peek（定义/Mastery/最近复习）；不离开。
升迁：Peek「在右侧打开」→S3（Concept 成为副对象）；Context 自动切到 Attention。
收起：Esc；上下文保留（回到该笔记滚动位置）。状态：tab、滚动位、pane 宽度保留。
```
### B. Search → Preview → Open
```text
进入：⌘K。焦点：Palette 输入。
临时：↑↓ → 右侧预览刷新（当前阅读不破坏）[A] HIG scope 显式（占位符标"全部笔记"）。
固定：Enter→替换 primary / ⇧Enter→Open Right。
状态：搜索词入 Recent；Esc 回到原位。
```
### C. Compare
```text
进入：Note A 中链接菜单「在右侧打开」→ Note B（S3）。
焦点：主 A；两侧共享同一 reading geometry（同字阶同行宽规则）。
关系操作：中缝悬停出现 Link / Reference / Create Concept（上下文成立才显示）。
退出：合并→A 单栏；状态：B 保留为 tab 可召回。
```
### D. Research（论文批注）
```text
进入：打开 Paper（S1，Context=Annotation 层）。
选中文字→行内气泡 [Highlight][Annotate][Ask Tutor]（禁大 Dialog）。
Highlight=标记；Annotate=写理解；@[[Attention]]=ConceptLink；
Add to Review=该片段进复习队列（L4）。
双向：点正文标记→Context 聚焦该批注；点 Context 条目→正文滚至锚点。
密度：Quiet（仅标记点）/ Normal（+气泡）/ Research（+全部批注面板）。
```
### E. Review → return
```text
进入：Rail→Review 或笔记 Context「弱概念→开始复习」→S4 Focus。
焦点：Review Card（Again/Hard/Good，1/2/3 键）。
保留：进入前 workspace 快照；完成→逐字恢复（tab/滚动/pane）。
```
### F. Write + Reference
```text
进入：Note A 编辑中，⌘P/链接菜单把 Note B 并置右侧（只读参考）。
写作中 @[[Transformer]] 引用 B→建立 link；中缝「Create Concept」可当场升格。
状态：编辑内容自动保存（local-first）；并置关闭不丢 A 的光标位置。
```

## 5. 反模式审查（对照指令书 §43）

| 反模式 | OLOS 现状 | 处置 |
|---|---|---|
| Dashboard Card Wall | 无（Mastery 用状态条非卡墙） | 维持 |
| Permanent Three Columns | 布局状态机 S0–S4 显式反对 | 维持 |
| Inspector Metadata Dump | Context=relevance 非 metadata | 维持 |
| Global Search 替换当前页 | L1 预览不替换 | 维持 |
| Modal for every action | 仅 destructive 确认用 Dialog | 维持 |
| Annotation list 独立页 | 批注=Context 内 tab | 冻结 |
| 浮动 pill 过多 | 选中气泡唯一，随选区出现消失 | 维持 |
| 万物玻璃/万物动画/万物高亮 | ADR-013 §2.7.1 + MOTION-SPEC 九问 | 维持 |
| 每个对象常驻可见 | 布局状态机 + peek 优先 | 维持 |

## 6. 后端能力映射（指令书 §46——无幻想功能）

| UI 能力 | 后端 | 缺口 |
|---|---|---|
| Peek（概念/笔记摘要） | notes/concepts/mastery GET | 无 |
| Compare | notes×2 并行 GET | 无 |
| Context Pane | mastery/review/mistakes/links/search | 无 |
| Backlinks+snippet | links/backlinks API | snippet 需返回源上下文片段（若现契约无，Phase 3B 提契约扩展提案，另行授权） |
| Search 三层 | search API（FTS5+CJK） | L2 工作集=前端过滤即可；L3=前端行内 |
| Tutor sidecar | tutor+SSE+context builder | 无（语义冻结） |
| Review Focus | review/study API | 无 |
| Annotation 四层级 | **无 annotations 实体** | **Phase 4 提案**：annotations 表+锚点；Paper 渲染依赖附件 API（已有 attachments） |
| Focus scope（Bear 式） | hierarchy/搜索参数 | **Phase 4 提案**：scope 查询参数 |

## 7. OLOS 差异化（结论重申）

竞品链路止步：Obsidian/Tana/Capacities→**link**；Zotero→**note**；Notion→**database**。
OLOS：**Annotation→Concept→Mastery→Review→Tutor 全链在 Workbench 内零切换**。这是不可被上述产品组合替代的唯一部分；本文件所有模型都服务于这条链。
