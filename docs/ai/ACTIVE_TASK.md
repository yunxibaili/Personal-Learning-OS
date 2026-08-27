# Active Task

> AI 工作记忆：当前正在做什么。

---

## Task ID

M4-D Tutor Panel

## Goal

新增 TutorPanel.tsx，实现 Context-aware Tutor 面板。
三个动作：Explain / Hint / Review。
连接 /api/v1/tutor/test（MockProvider）。

## Allowed Changes

- `web/src/components/tutor/TutorPanel.tsx`
- `web/src/components/tutor/TutorPanel.css`
- `web/src/App.tsx` — 替换 placeholder
- `web/src/global.css` — 追加 tutor 样式
- `docs/ai/CURRENT_STATE.md`
- `CHANGELOG.md`

## Forbidden Changes

- ❌ Chat 气泡 / 消息列表
- ❌ AI 头像 / 角色形象
- ❌ 打字动画 / streaming cursor
- ❌ 渐变 / 发光 / 玻璃效果
- ❌ 新增 npm 依赖
- ❌ 修改 NoteEditor 布局

## Acceptance Criteria

- npm run build 通过
- TutorPanel 显示 concept context + mastery
- 三个动作按钮可用
- Mock response 正确渲染
- 不违反 ADR-013 / ADR-016
