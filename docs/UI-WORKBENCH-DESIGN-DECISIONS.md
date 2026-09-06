# UI-WORKBENCH-DESIGN-DECISIONS — 设计决策矩阵（Phase 3.5）

日期：2026-09-07 · 状态：**FROZEN 草案**
格式（指令书 §39）：Problem / External References / Research Finding / OLOS Interpretation / Decision / Rejected Alternatives / Reason。
来源标注：[A] Apple Fact · [B] Interpretation · [C] OLOS Decision。

---

## D1. 如何查看 `[[Concept]]`？

- **References**：VS Code Peek（"nothing worse than a big context switch..."）；Notion side/center peek。
- **Finding**：查看类动作频率极高，付不起整页切换。
- **OLOS**：Knowledge Peek = 就地浮层（定义+Mastery+最近复习+相关笔记 + [打开][在右侧打开][问 Tutor]）。
- **Decision**：**Peek first → Pin second**（Peek 内升迁动词进入并置位/主位）。
- **Rejected**：A 直接导航（丢失当前阅读位）；B Dialog（模态过重，打断流）。
- **Reason**：避免 context switch；[A] "Peek window is closed if you press Escape"——轻、可逆。

## D2. 双笔记功能命名与语义

- **References**：VS Code Split Editor / Tana panels / Notion side peek。
- **Finding**：三者都把"打开行为"按生命周期分级；VS Code 的 split 是编辑器复制，Tana 的 panel 是对象容器。
- **OLOS**：命名 **Compare Workspace（并置工作区）**；第二 pane = 第二工作对象（可以是 Note/Concept/搜索结果/Tutor 上下文），主 pane = 研究对象。
- **Decision**：**Compare**（任务语义）+ 槽位名 **Side Object**。
- **Rejected**：Split Editor（编辑器复制语义）；Parallel Work（暗示并行任务，实际是同一任务两对象）。
- **Reason**：知识工作里"第二 pane 不是第二个编辑器"；命名即语义。

## D3. Pinned / Locked 要不要独立 UI？

- **References**：VS Code locked group（"new editors will not open in a locked group"）；Obsidian pin（"links in a pinned tab always open in another tab"）。
- **Finding**：两者本质都是"这个槽位不被导航顶掉"。
- **OLOS**：不暴露独立 pin 按钮；**并置位（Side Object）天然 locked**——新对象只进 Work Surface。
- **Decision**：**并入 Compare 的槽位语义**；主位 tab 显式关闭。
- **Rejected**：独立 pin/unpin UI（增加 chrome，语义重复）。
- **Reason**：行为一致即可，不需要第二个概念教给用户。

## D4. Backlinks 怎么显示？

- **References**：Capacities（"Backlinks are shown **with context**... decide whether to open the source"）；Obsidian（"Show more context" 开关）；"link for meaning, not for volume"。
- **OLOS**：Backlink 条目 = `source 标题 + 引用片段（选中态上下文）+ 关系类型`；点击 → 打开源对象并滚至锚点（Zotero Show on Page 语义）。回链区在 Context Pane 内，跟随焦点对象。
- **Decision**：**source+snippet+relationship** 三元组；无 snippet 的回链折叠入「仅链接」分组。
- **Rejected**：纯标题列表（链接计数器）。
- **Reason**：回链的价值是唤起"当时为什么链它"。

## D5. Context Pane 的信息密度

- **Decision**：三档密度（Minimal/Standard/Research），**按对象类型 + 任务自动选档**，用户可切：
  - Minimal（阅读默认）：Mastery 摘要 · Tutor 入口
  - Standard（学习态）：+ Related · Backlinks · Review·Mistakes
  - Research（论文/深研）：+ Annotations · Concepts · Sources
- **Rejected**：全信息常驻（Inspector metadata dump 反模式）；单一密度。
- **Reason**：[A] Apple hide-panes 思想的信息版——信息也按任务伸缩。

## D6. Search 三层的 UI 区分

- **References**：[A] HIG Searching（单一入口+scope 显式+local search=过滤器）；VS Code Find vs Search 分离。
- **OLOS**：
  - L1 ⌘K：Palette，居中浮层（functional layer，glass-regular），**↑↓ 预览不替换当前阅读**，Enter/⇧Enter 分流。
  - L2 Workspace：Explorer 顶部 SearchField，结果即 Explorer 过滤视图。
  - L3 ⌘F：行内查找条（Work Surface 内，非浮层），高亮+计数+上下导航。
- **Decision**：共享同一搜索语言（FTS5+CJK）与结果模型，**三个不同 UI 宿主**。
- **Rejected**：三处长相一样的搜索框（scope 混淆）。
- **Reason**：[A] "Clearly display the current scope of a search"——scope 由宿主表达。

## D7. Focus Mode 的定义

- **References**：Bear Workspace（"Everything else steps aside"）；VS Code Zen Mode。
- **OLOS**：Focus = 布局状态机 **S4**：保留 Rail（收纳为图标态）+ 最小顶控（退出/完成度）；**退出后逐项恢复进入前 workspace 快照**（tab、滚动位、pane 宽度）。
- **Decision**：Focus ≠ fullscreen 隐藏一切；= 「当前对象 + 最小顶控 + 可恢复」。
- **Rejected**：`display:none` 式全隐（回来后丢失工作现场）；Bear 式 scope（需后端 scope 查询 → **Phase 4 提案**）。
- **Reason**：学习的专注是暂态，恢复现场是硬需求。

## D8. 批注的呈现密度

- **Decision**：三档密度 **Quiet（仅右缘标记点）/ Normal（+选中气泡）/ Research（+全部批注面板）**，随任务切换（读=Quiet，研=Research）；批注列表是 Context Pane 内的 tab，**永不独立成页**。
- **Rejected**：卡片墙；与源分离的批注列表（Hypothesis/Zotero 均为源绑定）。
- **Reason**：[A] Zotero 双向锚定是批注类工具的共同硬约束；正文可读性优先。

## D9. Tutor 的宿主

- **Decision**：Tutor = **Contextual Sidecar**：宽屏宿主于 Context Pane 的 Tutor 区，窄屏/专注态降级为 Drawer（同一 state model 两载体）；上下文 = 当前对象 + 选区锚点 + 概念 + 回链（[A] Capacities "backlinks automatically added to the context" 转译）。
- **Rejected**：独立聊天页（打断学习链）；每次问询弹 Dialog。
- **Reason**：[B] Tutor 的价值在于"附着在学习对象上"；现有 SSE/会话语义冻结不动。

## D10. Explorer 是什么

- **Decision**：动态分区（Current/Related/Hierarchy/Recent）+ 完整 vault 树收进「All Notes」模式 + 顶部 L2 搜索常驻。
- **Rejected**：全量文件夹树常驻（回答不了"我现在该看什么"）。
- **Reason**：[B] Markdown 是数据真相，但导航应服务当前任务。

## D11. 打开动词分级

- **Decision**（[A] Tana 模式转译，具体键位 [C] 可调）：
  `click/Enter` = 替换 primary · `⌘/Ctrl+Click` = 新 tab（另一工作流）· `⇧+Click / 「在右侧打开」` = 并置 Side Object · `⌘K` 结果 ↑↓ = 预览。
- **Reason**：用输入动作表达对象生命周期，行为可预期、无需菜单记忆。

## D12. Material 服从 IA（顺序冻结）

- **Decision**：Task → Information hierarchy → Layout → Interaction → **Material** → Motion。玻璃只出现在布局裁定为 functional layer 的位置（Rail/TopBar/Palette/Peek/Popover/Sheet/Drawer）；内容面（Explorer/Context/正文）用 raised/base。
- **Reason**：[A] Apple "Don't use Liquid Glass in the content layer"；先层级后材质（apple-like-ui-skill："Add material, blur, or motion only after the static hierarchy works"）。

---

## 反向审查结论（KEEP/MODIFY/REJECT 总表）

| 来源 | KEEP | MODIFY | REJECT |
|---|---|---|---|
| Apple | hide/show pane、thin divider、scope 显式 | sheet→改用非模态 Peek | 全屏 sheet 做查看 |
| VS Code | locked group、preview/pinned、Peek-Esc、⌘P | split editor→Compare | 网格布局、浮动窗口、CodeLens |
| Obsidian | linked view 跟随、pin 语义、unlinked mentions（后续） | 布局记忆范围（仅 pane 宽度+tabs） | 无限 pane 链、stacked tabs、同步滚动 |
| Tana | tab=工作流/panel=对象、打开动词分级 | 键位具体值 | Cmd+S 面板搜索 |
| Notion | 三档打开方式 | per-view default→per-object-type default | 块数据库 |
| Zotero | Show on Page、批注→笔记带引文 | 批注列表→Context 内 tab | 独立 PDF 阅读器形态（OLOS 用附件渲染） |
| Capacities | backlink context、link for meaning、AI 回链上下文 | promote object→ConceptLink | 万物对象元模型、无全局图谱限制 |
| Bear | Focus 的"整界面收缩"思想 | scope 实现推迟 Phase 4 | — |

## Anti-Pattern 审查（结论）

十项反模式（Dashboard 卡墙/永久三栏/metadata dump/搜索替换页/万物 Modal/批注脱离源/浮 pill 泛滥/万物玻璃/万物动画/万物常驻）——逐项对照现有设计**均不成立**；形成机制：布局状态机+Context 密度+动画九问+ADR-013 §2.7.1（详见 WORKFLOW-MODEL §5）。
