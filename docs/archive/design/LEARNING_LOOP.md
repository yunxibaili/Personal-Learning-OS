# Learning Loop — 学习循环设计

> 本文件描述用户每日学习循环与系统事件流。
> 配合 `learning-model.md`（数据契约）使用。

---

## 1. Daily Loop

用户每天：

```
打开软件
  ↓
看到今日复习（review_queue）
  ↓
回答问题 / 阅读讲解
  ↓
系统生成 learning_event
  ↓
mastery 重新计算
  ↓
review_queue 更新（下次复习时间）
  ↓
继续学习新内容
```

核心问题：**用户每天为什么打开它？**

答案：因为系统知道他该复习什么。

---

## 2. Event Flow

```
用户行为
  │
  ├─ answer_correct / answer_wrong    （复习答题）
  ├─ explain                          （Tutor 讲解）
  ├─ code_run                         （代码实践）
  ├─ visualize                        （可视化探索）
  └─ manual                           （手动标记）
  │
  ↓
learning_events（追加写入，永不修改）
  │
  ↓
event reducer（mastery.py 计算）
  │
  ↓
concept_mastery（更新四维掌握度）
  │
  ↓
review_scheduler（SM-2 计算下次复习）
  │
  ↓
review_queue（写入/更新待复习条目）
```

---

## 3. Data Flow Rule

**永远通过 event 间接更新，禁止直接修改 mastery。**

```
正确:
  user action → event → mastery calculation → mastery update

禁止:
  user action → mastery update（跳过 event）
```

原因：
- event 是真相，mastery 是投影
- 未来多端同步只同步 event，mastery 可重放
- 未来 AI Tutor 需要 event 历史做分析

---

## 4. UI 原则

### 允许

- 掌握度数值（effective 百分比）
- 学习趋势（最近 7 天 event 数量）
- 待复习数量
- 薄弱概念列表

### 禁止

- 游戏积分
- 等级系统（Lv.1 → Lv.2）
- 徽章 / 成就
- 排行榜
- 连续打卡天数（压力感）

原因：这不是 Duolingo，是学习操作系统。

---

## 5. 页面对应

| 页面 | 循环角色 |
|---|---|
| Dashboard | 今日复习入口 + 学习趋势 |
| Review Queue | 答题 + 反馈 |
| Note Editor | 学习新内容 + 生成 event |
| AI Tutor | 讲解 + 生成 explain event |
| Knowledge Radar | 发现关联知识 |
| Graph | 知识关系可视化 |

---

## 6. 未来扩展点

- **M4 Tutor**：explain event 增加 AI 讲解质量维度
- **M3b Universe**：event 驱动节点动画（新 event → 节点亮起）
- **M7 Sync**：event log 同步（jsonl 追加式）
- **M8 Mobile**：移动端复习入口
