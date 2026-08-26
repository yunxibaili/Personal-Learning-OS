# ADR-002: 思维导图存储——旁车 JSON 为结构真相 + 生成的 md 大纲段

日期：2026-08-26 · 状态：Accepted

## Context
思维导图需要 XMind 级编辑体验（拖拽/折叠/布局），又必须与知识库连通
（FTS 搜索、[[双链]]、Knowledge Graph）。候选路线：专用格式(XMind)、
Markdown 驱动(Markmap)、结构化 XML(Freeplane)、无限画布(Canvas JSON)。

## Decision
融合方案（Knowledge MindMap）：
1. **结构真相 = 旁车文件 `<笔记名>.mindmap.json`**（schema v1：root 树 +
   layout 坐标 + collapsed + 版本号）。JSON 解析零歧义，结构与布局天然同文件。
2. **语义真相 = 笔记 md 正文**（定义、解释、公式——人工书写区）。
3. **派生视图 = md 内「结构大纲」段**：头部 `<!-- generated:mindmap -->` 标记 +
   嵌套列表 + `[[wiki链接]]`。每次保存导图自动重写并重索引——使导图内容
   免费进入 FTS5 搜索、反链扫描与图谱边解析。该段落禁止手改。
4. 编辑器基于已装 @xyflow/react 实现（Tab 子级/Enter 同级/双击改名/Del 删除/
   拖至他节点=改父级+环检测/折叠）；树形布局手写 tidy-tree ~100 行。
5. AI 生成（M4）：LLM 输出嵌套 JSON → 全部节点建 Concept(origin='ai_suggested')
   + contains 边 → 图谱淡色显示、可过滤、可删。
6. 恢复策略：json 丢失 → 由大纲段反向重建结构（布局归零自动重排）；
   布局字段损坏 → 仅丢布局。

## Alternatives Considered
- Markdown 嵌套列表为真相：往返解析缩进易错，拖拽频繁重写 md
- markmap 库：内核依赖 D3（本项目禁令），且其视图层只读，编辑仍需自研
- 纯 json 无大纲段：导图内容脱离搜索/图谱管线
- XMind 式独立画布文件：AI 无法理解层级语义，违背知识连通目标
- 概念文件夹制 `knowledge/特征值/{concept.md,mindmap.json,...}`：
  examples/exercises/code 是 Phase 4/5 需求，YAGNI，进 backlog

## Reason
JSON 保编辑体验与解析可靠性；generated 大纲段保知识库连通；零新依赖。

## Consequences
- md 中存在"禁手改"区域，UI 需明确标识
- 大纲段与 json 的最终一致性由"保存导图即重写大纲"单点保证
- 未来若支持在 markdown 模式编辑大纲，需增加反向解析（backlog）
