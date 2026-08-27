# ADR-016: Tutor UI Design

**状态**：已批准（2026-08-27）
**决策者**：项目负责人
**关联**：ADR-013（Frontend Design System）· ADR-014（AI Tutor Architecture）· M4-D

---

## 1. Problem

M4-D 引入 Tutor UI，是用户第一次「看到」AI 能力。
前端 AI 代码容易陷入 ChatGPT 范式：气泡聊天、AI 头像、打字动画、魔法按钮。
需要冻结 Tutor UI 的设计边界。

## 2. Decision

### 2.1 定位

```
Tutor is a knowledge tool, not a chatbot.
```

Tutor 是知识系统里的辅助面板，不是一个 AI 角色。

参考产品（交互模式）：
- Obsidian 插件侧栏（AI 辅助面板）
- IDE Context Panel（代码助手）
- Notion AI（轻量辅助，非主角）

### 2.2 布局

三栏布局中的右侧 Tutor Panel：

```
┌────────┬──────────────┬──────────┐
│ Notes  │ Content      │ Tutor    │
│        │              │          │
│        │ Markdown     │ Context  │
│ Graph  │ Editor       │ Response │
│        │              │ Actions  │
└────────┴──────────────┴──────────┘
```

Tutor Panel 永远是辅助层，不是主角。

### 2.3 禁止清单（MUST NOT）

| 禁止 | 原因 |
|---|---|
| AI 头像 / 角色形象 | 不制造虚假人格 |
| 对话气泡 | 不是聊天机器人 |
| 消息列表 / 聊天历史 | 不是 IM 产品 |
| "AI 正在思考..." 动画 | 不制造魔法感 |
| 打字机效果 | 纯装饰，浪费注意力 |
| 星星 / 魔法按钮 | 不是 SaaS 营销页 |
| 渐变 / 发光 / 玻璃效果 | 违反 ADR-013 |
| 浮窗 / 弹窗对话 | 不打断学习流 |
| AI 称呼用户 "你" | 不制造亲密感 |

### 2.4 允许清单（MAY）

| 允许 | 说明 |
|---|---|
| Context Panel | 显示当前概念的 mastery/mistakes/related |
| Structured Answer | 分段文本输出，非气泡 |
| Mode Switcher | Explain / Hint / Review 三个按钮 |
| Input Box | 单行输入框 + Ask 按钮 |
| Related Concepts | 可点击的概念链接 |
| Mastery Bar | 掌握度可视化（已有） |
| Action Suggestion | "Review chain rule" 建议链接 |

### 2.5 AI 输出格式

禁止：

```
AI: 你好，我来帮你理解梯度下降...
```

允许：

```
Explanation

Gradient descent minimizes loss
by moving opposite to the gradient.

Key points:
- learning rate controls step size
- too large → diverge
- too small → slow convergence

Related:
- Backpropagation
- Optimizer

Suggestion:
Review "chain rule" (mastery: 0.2)
```

像知识工具的输出，不是聊天消息。

### 2.6 交互模式

三个固定动作，不多不少：

| 动作 | 行为 | 输出 |
|---|---|---|
| Explain | 解释当前概念 | 概念解释 + 关联 + 薄弱点提示 |
| Hint | 给提示不给答案 | 引导性问题 |
| Review | 加入复习队列 | 跳转到 M5 复习视图 |

未来扩展走 mode，不走 prompt 乱长。

### 2.7 响应式行为

- **有概念选中**：Tutor Panel 显示该概念的 context + 问答
- **无概念选中**：Tutor Panel 显示 "Select a concept to start"
- **加载中**：简洁 loading indicator（ spinner 或 "Loading..."），不制造 AI 感

### 2.8 与 ADR-013 的关系

ADR-016 是 ADR-013 在 Tutor 领域的细化：

- 颜色：沿用白橙主题
- 字体：沿用系统字体
- 间距：沿用 8px 网格
- 动画：沿用 150-250ms transition
- 组件：沿用 CSS 变量

禁止引入 ADR-013 禁止的任何元素。

## 3. Consequences

### 代码结构

```
web/src/views/
├── NoteEditor.tsx       ← 已有
├── TutorPanel.tsx       ← M4-D 新增
└── DashboardView.tsx    ← 已有
```

### 对现有模块的影响

- `NoteEditor.tsx` — 右侧增加 Tutor Panel 集成点
- `global.css` — 新增 `.tutor-panel` 样式（沿用 CSS 变量）
- `App.tsx` — 三栏布局调整（如需要）

### 测试要求

- `npm run build` 通过
- 视觉审查：不违反 ADR-013/016

### 未来扩展

- M4-D2：streaming 输出（逐字显示，但不是打字机效果）
- M4-D3：多轮对话（但保持面板模式，不做聊天窗口）
- M3b：Knowledge Universe 中的 AI 路径点亮

## 4. References

- ADR-013: Frontend Design System
- ADR-014: AI Tutor Architecture
- Obsidian Copilot 插件（侧栏 AI 面板）
- VS Code Copilot（Context Panel 模式）
