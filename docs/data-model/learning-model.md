# Learning Model — 学习状态数据模型契约

> 本文件冻结学习状态的数据模型。M5/M4/M3b/Mobile Sync 的共同基础。
> 完整 DDL 见 `TECH_DESIGN.md §4`；变更追踪见 `INDEX.md`。
> 日期：2026-08-27 · 状态：Frozen（M3 实现 + M5 评审冻结）

---

## 1. Purpose

学习行为 → 掌握状态 → 复习调度的数据模型。

核心循环（Learning Loop）：

```
学习行为 → learning_events → mastery 变化 → review_queue → 用户复习 → 新事件
```

## 2. Truth Hierarchy（冻结原则）

```
learning_events  = 事实真相（追加式，永不修改）
concept_mastery  = 状态投影（可由 events 重放重建）
review_queue     = 调度结果（可由 mastery + SM-2 重建）
```

类比：

```
Markdown = 内容真相（ADR-001）
SQLite   = 索引缓存
↓
learning_events = 学习真相
mastery         = 状态缓存
```

## 3. Core Entities

### 3.1 Concept（concepts 表）

知识实体。第一等公民。详见 ADR-008/009。

### 3.2 Learning Event（learning_events 表）

一次学习行为。追加式日志。**真相源。**

| 字段 | 类型 | 说明 |
|---|---|---|
| id | INTEGER PK | 本地自增主键 |
| event_uuid | TEXT UNIQUE | 跨设备幂等标识（UUID v4，ADR-005 同步用） |
| concept_id | INTEGER FK | 关联概念 |
| event_type | TEXT | 事件类型（见下方枚举） |
| dimension | TEXT | 目标维度（可选，见映射表） |
| weight | REAL | 权重（默认 1.0） |
| source | TEXT | 来源（见下方枚举） |
| created_at | TEXT | UTC 时间戳 |

**event_type 枚举**（冻结）：

| event_type | 目标维度 | 增量公式 |
|---|---|---|
| answer_correct | dimension or knowledge | +0.15 × weight |
| answer_wrong | dimension or knowledge | -0.10 × weight |
| explain | knowledge | +0.08 × weight |
| visualize | practice | +0.05 × weight |
| review | recall | +0.10 × weight |
| code_run | practice | +0.08 × weight |

约束：增量后 clamp 到 [0.0, 1.0]。

**source 枚举**（冻结）：

| source | 说明 |
|---|---|
| manual | 用户手动标记 |
| review | 复习答题 |
| tutor | AI Tutor 讲解后提取 |
| code_trace | 代码执行追踪 |
| exam | 考试/测验 |
| import | 外部导入（UpMark 等） |
| ai_generated | AI 自动生成学习计划 |

**幂等设计**：

- `id`：本地数据库主键，每设备独立自增
- `event_uuid`：跨设备全局唯一，同步时用于幂等去重（ADR-005）
- 设备 A 写入 event_uuid=xxx → 同步到设备 B → 设备 B 用 event_uuid 去重忽略

### 3.3 Concept Mastery（concept_mastery 行）

每概念一行。首次触达时惰性创建。**状态投影，可重建。**

| 字段 | 类型 | 说明 |
|---|---|---|
| concept_id | INTEGER PK | 关联概念 |
| dimensions | TEXT (JSON) | 四维当前值（v1 存储形式，未来可投影为列） |
| effective | REAL | 加权有效值 |
| ease_factor | REAL | SM-2 难度因子（≥1.3） |
| interval | INTEGER | 当前复习间隔（天） |
| review_count | INTEGER | 已复习次数 |
| next_review | TEXT | 下次复习时间（UTC） |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 最后更新时间 |

**四维权重**（冻结）：

| 维度 | 权重 | 含义 |
|---|---|---|
| knowledge | 0.35 | 知识理解（概念认知、定义记忆） |
| practice | 0.30 | 应用能力（解题、代码实现） |
| recall | 0.20 | 主动回忆（不提示下能否想起） |
| transfer | 0.15 | 迁移能力（跨领域应用、类比） |

```
effective = 0.35×knowledge + 0.30×practice + 0.20×recall + 0.15×transfer
```

**dimensions JSON 说明**：

v1 以 JSON 存储四维值，优先保证简单性。未来如需高频按维度查询（如"找所有 practice < 0.3 的概念"），可投影为独立列。投影不改 API 契约。

### 3.4 Review Queue（review_queue 行）

复习调度。由 SM-2 计算写入。**调度结果，可重建。**

| 字段 | 类型 | 说明 |
|---|---|---|
| concept_id | INTEGER PK | 关联概念 |
| due_at | TEXT | 到期时间（UTC） |
| priority | REAL | 优先级（0~1） |
| status | TEXT | pending / done / skipped |
| last_result | TEXT | correct / wrong |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 最后更新时间 |

## 4. Mastery Calculation

**输入**：learning_events（按 concept_id 过滤，按 created_at 升序）
**输出**：concept_mastery 行

**算法**：

1. 取 mastery 行（无则创建默认值）
2. 按 event_type 映射 → 维度增量
3. clamp 到 [0, 1]
4. 重算 effective = 加权求和
5. 写回 concept_mastery

**时间计算规则**：

不直接读取当前时间；时间相关计算必须显式传入 timestamp 参数。

```python
# 正确
compute_mastery(events, now=datetime.now(timezone.utc))

# 禁止
compute_mastery(events)  # 内部调用 datetime.now()
```

这是多端同步重放的前提（ADR-005）：同一事件流在不同设备、不同时间重放，必须产生相同结果。

## 5. Review Algorithm

SM-2（`review_scheduler.py`），独立模块，可替换为 FSRS/Leitner。

**当前实现**：

```
输入：quality(0-5), ease_factor, interval, review_count
输出：{ease_factor, interval, next_review, review_count}

quality < 3：interval 重置为 1 天
quality ≥ 3：interval = prev_interval × ease_factor
```

**可替换声明**：

SM-2 参数（ease_factor 更新公式、interval 计算规则）不是产品常量。
替换为 FSRS 或其他算法时，只改 `review_scheduler.py`，不改 mastery 模型。
替换需开 ADR 评审。

## 6. Concept Learning State Initialization

概念首次触达时（创建或 stub），惰性初始化完整学习状态：

```python
def ensure_concept_learning_state(conn, concept_id: int) -> None:
    """确保概念的学习状态完整：mastery + review_queue。"""
    # 1. 确保 mastery 行存在
    get_or_create_mastery(conn, concept_id)
    # 2. 确保 review_queue 行存在（due_at = now，首日可复习）
    ...
```

触发时机（不绑定笔记）：

| 来源 | 触发 |
|---|---|
| 笔记创建 | `[[新概念]]` 解析创建 stub 时 |
| AI Tutor | extractor 建议新概念时 |
| Import | UpMark 等外部导入时 |
| Code Trace | 代码执行产生新概念时 |

## 7. Consumers

| 消费者 | 读取 | 用途 |
|---|---|---|
| M4 AI Tutor | mastery + events + mistakes | 上下文感知讲解 |
| M3b Knowledge Universe | mastery.effective | 节点亮度/颜色编码 |
| M5 Review Loop | review_queue + mastery | 今日复习队列 |
| M8 Mobile Sync | learning_events（event_uuid） | 事件日志跨端重放 |
| T-EXPORT | 全部 | 数据导出 |

## 8. Forbidden Changes

- 不得将 mastery 合并进 notes 表
- 不得只存派生值不存 events（events 是真相）
- 不得修改已写入的 learning_events 行（追加式）
- 不得在 Router 层直接计算 mastery（必须经 Core）
- 不得在 mastery 计算中直接调用 datetime.now()（必须显式传入 timestamp）
- 不得删除 event_uuid 字段（多端同步依赖）
