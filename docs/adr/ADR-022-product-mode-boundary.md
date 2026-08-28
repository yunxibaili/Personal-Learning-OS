# ADR-022: Product Mode Boundary

> 状态：Accepted · 日期：2026-08-27 · 冻结

---

## 背景

项目已具备 Knowledge Universe、Mastery、Review Loop、Tutor、Sync 五大模块。若不控制 UX 方向，容易从「知识管理工具」滑向「强制学习打卡 App」。移动端（M8）上线后风险更高。

## 决策

冻结产品双模式架构，默认 Knowledge Mode。

### Mode A: Knowledge Mode（默认）

定位：用户管理知识，系统不打扰。

```
Dashboard
├── 最近笔记
├── 搜索
├── 图谱
├── Universe
└── 编辑
```

学习相关：弱提醒（状态栏 / Dashboard 小卡片），不阻断工作流。

示例：`Review due: 3 concepts`

禁止：
- 启动弹窗"你今天还没有学习"
- 首页"今日学习任务"进度条
- 连续天数 / 打卡记录

### Mode B: Learning Mode（主动进入）

定位：用户主动进入学习状态。

切换方式：`[ Knowledge ] [ Learning ]` Tab 切换。

Dashboard 变为：
- Review Queue
- Weak Concepts
- Tutor 入口
- Learning Graph

### 切换规则

```
Knowledge Mode（默认）
        │
    用户主动切换
        │
        ▼
Learning Mode
```

禁止：
- 打开 App 直接进入 Learning Mode
- 系统强制弹窗要求学习
- 未操作超时自动切换

## 禁止清单（永久）

以下功能**永远不进入本项目**：

| 禁止项 | 原因 |
|---|---|
| XP / 经验值 | 游戏化，偏离知识管理 |
| 连续天数 / Streak | 打卡压力，非核心 |
| 徽章 / 成就系统 | 游戏化 |
| 等级 / 排行榜 | 社交竞争，非本项目定位 |
| 学习任务强制推送 | 打扰用户 |
| "今日必须完成 N 个任务" | 任务系统，非知识维护 |

## Review Loop 定位

不是：任务系统（"今天必须完成 5 个复习"）

而是：知识维护系统（"这些知识正在遗忘，需要维护"）

用户可以选择忽略 Review，不影响其他功能。

## Tutor 定位

不是：AI 老师（"你今天还没学习"）

而是：知识辅助工具（"你问，我答"）

Knowledge Mode：用户提问 → Tutor 回答
Learning Mode：用户请求复习 → Tutor 辅助

## Reminder 三级模型

| 级别 | 行为 | 默认 |
|---|---|---|
| Level 0 | 无提醒 | ✅ 默认 |
| Level 1 | 轻提示（Dashboard 小卡片 / 状态栏） | 可选 |
| Level 2 | 弹窗提醒 | 需用户开启 |

Level 2 需要用户主动开启 `Daily learning reminder` 设置。

## 数据模型

Mode 状态存储为用户偏好，不进入 SQLite：

```
settings.json（通过 settings API）
{
  "workspace_mode": "knowledge"
}
```

原因：这是 UI 偏好，不是学习事实。符合 ADR-020 三层模型（Layer 3 Local Cache）。

## 架构影响

无核心架构改动。现有分层已支持：

```
Knowledge Layer（vault / concepts / links）
Learning Layer（mastery / review_queue / events）
Thinking Layer（MindMap）
AI Layer（Tutor）
```

Mode 切换只是前端入口路由变化，不改变数据流。

## 关联

- ADR-013 Frontend Design System（Mode UI 遵守设计规范）
- ADR-014 AI Tutor Architecture（Tutor 边界不变）
- ADR-019 MindMap Boundary（MindMap 不因 Mode 改变行为）
- ADR-020 Sync Truth Model（Mode 偏好不同步）
