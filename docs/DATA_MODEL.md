# Data Model — 数据模型契约与变更追踪

> 合并自原 `docs/data-model/` 下的多份文档（2026-08-29 文档整合）。
> 完整 DDL 权威来源：`TECH_DESIGN.md` §4；ADR 级决策见 `adr/`。

---


## A. 变更索引与新表登记规矩

> **规范来源唯一**：完整 DDL、字段语义、索引与 vault 目录约定统一维护在
> `docs/TECH_DESIGN.md` §4。本文件只做变更追踪，避免两处 DDL 漂移。

> **🚨 新表登记规矩（2026-08-28 D5 裁决生效）**：任何 migration 新增表，
> 必须在同一提交中登记生产者位置（模块 · 函数 · 调用路径），无生产者的表
> 不得合入。全表生产者/消费者对照见 `docs/archive/data-model/TABLE_AUDIT.md`。

## 变更日志

| 日期 | 变更 | 关联 |
|---|---|---|
| 2026-08-26 | 初版 11 表 + notes_fts：settings/concepts/edges/concept_mastery/learning_events/mistakes/memories/notes/note_concepts/note_links/conversations/messages | TECH_DESIGN §4 |
| 2026-08-26 | 决策：Mind Map 采用旁车 json，**零新表**（结构与布局由 `*.mindmap.json` 承载） | ADR-002 |
| 2026-08-26 | migration 002：统一 links 表，DROP 三旧关系表；migration 003：concepts 补 `status` 列（stub→confirmed→active→archived 生命周期，origin 仅记来源） | ADR-008/009 · M2 |
| 2026-08-26 | ADR-012 编辑器上下文感知架构（Omniscience Mode · Knowledge Radar）；零新表零新依赖 | ADR-012 · M3.5-A |
| 2026-08-27 | learning-model.md 冻结：学习状态数据模型契约（event_uuid 幂等 + source 枚举扩展 + 时间计算规则 + SM-2 可替换声明） | M5 评审 |
| 2026-08-27 | M4-B Prompt Contract 冻结：TutorContext TypedDict + TutorMode Literal + TutorPrompt 输出结构 + token 截断 + 双重安全过滤 | M4-B |
| 2026-08-27 | ADR-015 Language Contract 冻结：Content language independent + Concept aliases + Tutor 语言自适应 | ADR-015 |
| 2026-08-27 | M2b-003 MindMap Exchange Format v1（.map.json 导入导出）：零新表，导图结构真相仍为旁车 json | ADR-021 |
| 2026-08-27 | ADR-020 Sync Truth Model 冻结：三层真值——Layer1 同步层=vault/*.md + eventlogs/*.jsonl + mind_maps/*.mindmap.json；Layer2 本地重建=concepts/links/mastery/review_queue；Layer3 永不同步=settings/API keys/SQLite。零新表，白名单实现在 core/sync/manifest.py SYNC_PATTERNS，黑名单含 db/ 与 metadata/devices.json | ADR-020 · docs/SYNC.md |

| 2026-08-28 | P8-003E：mistakes 断链修复（mastery.answer_wrong 同事务落库）· 乙路线 auto_notes（ADR-014 附录许可，默认关闭）| P8-003E |
| 2026-08-28 | **空表盘点（D5）**：14 张活表三分定界，零死表；memories/conversations/messages 三张 (b) 缺生产者待补（设计在案），TABLE_AUDIT.md 为准；新表登记规矩生效 | TABLE_AUDIT.md |
| 2026-09-01 | **ADR-024 主/副笔记层级**：`parent` 关系存于子笔记 frontmatter（Markdown 事实源），**零新表零 migration**；`links(relation='parent')` 仅作派生索引，reindex 时全量重算，不作第二事实源。前置地基 = frontmatter round-trip（`compose_file` 须保任意 key） | ADR-024 · ADR-001 |

## 延后建表（禁止提前创建）

| 表 | 触发条件 |
|---|---|
| blocks | 块级引用功能立项（backlog） |
| embeddings | RAG 立项且概念数 >2000 或匹配质量不足（backlog） |
| concept_demos | 可视化示例保存功能立项（M9 后评估） |

---

## B. Learning Model — 学习状态数据模型契约

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
| event_id | TEXT UNIQUE | 跨设备幂等标识（UUID v4，ADR-005 同步用） |
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

> 2026-09-05（E1/E2）：`POST /api/v1/events` 输入层按本枚举校验 `event_type`
> （`core.mastery.VALID_EVENT_TYPES` 与本表同源），非法值 → `400 invalid_body`，
> 不再 201 + silent no-op；枚举本身与事件处理语义不变。
> `POST /review/{id}/answer` 的 `quality` 输入层限 0–5 整数（bool 拒绝），
> SM-2 内部 clamp 行为不变。

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
- `event_id`：跨设备全局唯一，同步时用于幂等去重（ADR-005）
- 设备 A 写入 event_id=xxx → 同步到设备 B → 设备 B 用 event_id 去重忽略

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
| M8 Mobile Sync | learning_events（event_id） | 事件日志跨端重放 |
| T-EXPORT | 全部 | 数据导出 |

## 8. Forbidden Changes

- 不得将 mastery 合并进 notes 表
- 不得只存派生值不存 events（events 是真相）
- 不得修改已写入的 learning_events 行（追加式）
- 不得在 Router 层直接计算 mastery（必须经 Core）
- 不得在 mastery 计算中直接调用 datetime.now()（必须显式传入 timestamp）
- 不得删除 event_id 字段（多端同步依赖）

---

## C. Tutor Context — AI 可见性契约

> AI Tutor 可见的数据契约。冻结 AI 看到什么、看不到什么。
> 配合 `ADR-014`（AI Tutor Architecture）使用。

---

## 1. Context API

```
GET /api/v1/tutor/context/{concept_id}
```

返回：
```json
{
  "concept": {
    "id": 1,
    "title": "特征值",
    "definition": "矩阵 A 的特征值 λ 满足 det(A-λI)=0"
  },
  "mastery": {
    "knowledge": 0.35,
    "practice": 0.20,
    "recall": 0.50,
    "transfer": 0.10,
    "effective": 0.305
  },
  "mistakes": [
    {
      "id": 1,
      "question": "矩阵乘法维度",
      "wrong_answer": "2x2 * 2x2 = 2x2",
      "created_at": "2026-08-25T10:00:00"
    }
  ],
  "review": {
    "next_review": "2026-09-01",
    "last_result": "wrong",
    "ease_factor": 1.8,
    "interval": 3
  },
  "related": [
    {"id": 2, "title": "矩阵", "type": "concept"},
    {"id": 3, "title": "线性变换", "type": "concept"}
  ],
  "recent_events": [
    {"event_type": "answer_wrong", "source": "review", "created_at": "2026-08-27T09:00:00"},
    {"event_type": "explain", "source": "tutor", "created_at": "2026-08-26T14:00:00"}
  ]
}
```

## 2. AI 可见字段

| 层 | 字段 | 用途 |
|---|---|---|
| Concept | id, title, definition | 理解用户在学什么 |
| Mastery | 四维 + effective | 判断薄弱维度 |
| Mistakes | question, wrong_answer | 针对性讲解 |
| Review | next_review, last_result, ease, interval | 判断复习紧迫性 |
| Related | title, type (1-hop) | 关联知识引导 |
| Events | event_type, source, created_at | 学习轨迹 |
| Notes（P8-003D） | note_id, title, excerpt（≤2 篇，片段 ≤600 字符） | 用户显式引用的笔记片段（ADR-014:114「除非用户明确引用」+ 附录 §2.8.1） |
| Memories（B8） | kind, content, importance, last_used_at（top ≤5，importance×新近度） | 用户长期记忆（ADR-014 附录 §2.5.1；敏感形态条目排除出上下文） |

## 3. AI 不可见字段（黑名单）

| 数据 | 原因 |
|---|---|
| vault 全文 | 隐私 + token 预算（用户显式引用的 ≤2 篇笔记片段除外，P8-003D） |
| 全部聊天记录 | 隐私 + 上下文过长 |
| .env / API key | 安全 |
| 其他用户数据 | 隐私 |
| SQLite 结构 | 防注入 |
| settings 表 | 含 API key |

## 4. Context Snapshot

每次 AI 调用产出 `context_json` 快照，随消息落库：

```json
{
  "concept_id": 1,
  "question": "为什么我不会特征值？",
  "context": { ... 上面的 context ... },
  "model": "deepseek-chat",
  "created_at": "2026-08-27T10:00:00"
}
```

用途：
- 上下文透视 UI（用户看到 AI 看到了什么）
- 审计（为什么 AI 给了这个回答）
- 调试（context 质量评估）

## 5. Token 预算

| 组成 | 预算 |
|---|---|
| System prompt | ~500 tokens |
| Context snapshot | ~1000 tokens |
| User question | ~200 tokens |
| **Total input** | **~1700 tokens** |
| Response | ~1000 tokens |

总计 < 3000 tokens/次，兼容所有模型。

**P8-003D 增记（2026-08-28）**：注入用户引用笔记时（≤2 篇 × ≤600 字符 ≈ ≤600 tokens），
related 10→6、recent_events 5→3 收缩让位；总预算维持不变。未引用笔记全文永不进入 context。

**P8-003E 增记（2026-08-28）**：`auto_notes=true`（显式开启）时以 concept
标题+别名做 FTS5 检索补足剩余名额（≤2 总额不变），检索词来自概念元数据
（可审计）。默认关闭；显式引用优先，auto 只补缺且排除已引用。

## 6. 错误处理

| 场景 | 处理 |
|---|---|
| Concept 不存在 | 返回 404 + 错误信息 |
| LLM 超时 | 重试 1 次，失败返回错误 |
| LLM 返回空 | 返回兜底提示 |
| Context 过大 | 截断 recent_events |
| API key 无效 | 返回 settings 错误 |

---

## D. Prompt Contract — TutorPrompt 结构契约

> AI Prompt 结构的冻结契约。M4-C 接 LLM Provider 时以此为准。

---

## Input

```python
from app.core.tutor_types import TutorContext, TutorMode

context: TutorContext   # 由 build_tutor_context() 产出
query: str             # 用户问题
mode: TutorMode        # "explain" | "hint" | "review" | "debug"
```

## Output

```python
from app.core.tutor_types import TutorPrompt

prompt: TutorPrompt
```

结构：

```json
{
  "system": "You are Learning OS Tutor...",
  "messages": [
    {"role": "user", "content": "Learner context:\n\n...\n\nQuestion:\n..."}
  ],
  "metadata": {
    "context_version": "1",
    "mode": "explain",
    "truncated": false
  }
}
```

## TutorMode

| Mode | 用途 | 行为 |
|---|---|---|
| explain | 解释概念 | 清晰讲解，引用掌握度调整深度 |
| hint | 提示 | 不直接给答案，用问题引导 |
| review | 复习 | 基于掌握度提问测试回忆 |
| debug | 代码分析 | M4-B fallback to explain |

## Token 限制

| 段 | 字符上限 | ≈ Tokens |
|---|---|---|
| system | 2000 | 500 |
| context | 10000 | 2500 |
| query | 2000 | 500 |
| **total** | **14000** | **3500** |

字符估算：`CHARS_PER_TOKEN = 4`

## 安全过滤（双重防御）

### Layer 1: Context Builder（tutor_context.py）

负责：不输出危险数据（db_path, api_key, filesystem, migration）

### Layer 2: Prompt Builder（ai/tutor.py）

负责：即使收到异常 context，也不送入模型

过滤规则：

- **字段名黑名单**：api_key, password, secret, token 等 → 删除整个字段
- **内容前缀黑名单**：sk-, Bearer , ghp_, xoxb- → 替换为 `[REDACTED]`

注意：正常知识内容（如 "token bucket algorithm"）不被误删。

## 禁止行为

Prompt Builder 不得：

- 查询 SQLite
- 读取文件
- 调用网络
- 修改 event / mastery
- 引入新依赖

## 与 M4-A 的关系

```
M4-A: build_tutor_context(conn, concept_id) → TutorContext
                                    ↓
M4-B: build_prompt(context, query, mode) → TutorPrompt
                                    ↓
M4-C: LLM Provider(prompt) → Response
```

## 与 shared/types/tutor.ts 的关系

- `tutor_types.py` 是 Python Core 内部 contract
- `shared/types/tutor.ts` 是 API response contract
- 两者概念对齐，不强耦合
- M4-B 无 API 变更，不修改 tutor.ts

## Language Handling

Prompt builder MUST NOT assume Chinese content.

Supported:
- English
- Chinese
- Mixed language

Default:
Response language follows user query language.

Future (M4-C+):
metadata 可扩展 `detected_language` / `response_language` 字段。
详见 `docs/DATA_MODEL.md` + `docs/adr/ADR-015-multilingual.md`。

---

## E. Language Contract — 多语言契约

> 多语言知识支持的冻结契约。与 ADR-015 配套。

---

## 原则

```
Content language independent
UI language configurable
Tutor response language adaptive
```

## 当前阶段（M4-B）

- 不实现语言检测
- 不实现语言切换
- 不修改 Prompt 结构
- metadata 保留扩展位

## Prompt 增补（未来 M4-C+）

```json
{
  "metadata": {
    "context_version": "1",
    "mode": "explain",
    "truncated": false,
    "detected_language": "zh",
    "response_language": "zh"
  }
}
```

## Tutor 输出语言规则

```
language=auto
  → detect(query language)
  → respond same language

language=en
  → force English

language=zh
  → force Chinese
```

## 语言检测（简易方法）

```python
def detect_language(text: str) -> str:
    """字符范围判断，不引入语言检测库。"""
    cjk_count = sum(1 for c in text if '\u4e00' <= c <= '\u9fff')
    if cjk_count / max(len(text), 1) > 0.3:
        return "zh"
    return "en"
```

## Token 估算（未来调整）

```python
LANGUAGE_CHARS_PER_TOKEN = {
    "en": 4,
    "zh": 1.5,
    "ja": 1.5,
    "ko": 1.5,
}
```

## Concept 语言元数据（未来 M7+）

```sql
ALTER TABLE concepts ADD COLUMN language TEXT NOT NULL DEFAULT 'en';
ALTER TABLE concepts ADD COLUMN aliases_json TEXT NOT NULL DEFAULT '[]';
```

## 禁止

- 翻译 API（用户自己写双语笔记）
- 语言检测库（字符范围判断足够）
- Note 层语言字段
- SQLite 全文索引语言分割

---

## F. Table Audit — 空表盘点（D5，2026-08-28）

> 日期：2026-08-28 · 基线：e3f76ff · 方法：migration DDL 清单 × 全仓 grep
> （INSERT=生产者 / FROM=消费者）× 真实 workspace db 行数 三方对照
> 起因：三次串行发现"建表无生产者"断链（eventlogs → event_uuid → mistakes），
> 本盘点一次性关闭此类问题（PM 裁决 D5）。

## 结论：14 张活表全部定界，零死表

### (a) 有生产者且有消费者 — 11 张 ✅

| 表 | 生产者 | 消费者 | 运行时行数 |
|---|---|---|---|
| settings | db.py（数据访问函数） | routers/settings | 2 |
| concepts | routers/concepts · knowledge.ensure_entity_by_title | 全局 | 18 |
| notes | routers/notes（写盘+索引） | 全局 | 5 |
| notes_fts | knowledge.upsert_note_index | search/suggest | 5 |
| links | knowledge.rebuild_note_links · concepts router | graph/tutor/universe | 5 |
| concept_mastery | mastery.update_mastery | universe/tutor/dashboard | 4 |
| learning_events | mastery.update_mastery（含 eventlog 双写） | review/universe/dashboard | 9 |
| review_queue | mastery.ensure_concept_learning_state · routers/mastery | review/tutor | 3 |
| mistakes | **mastery.py:160（P8-003E 刚补的桥）** | tutor_context | 0* |
| mind_maps / mind_map_nodes / mind_map_edges | core/mindmap.py | mindmap router/export | 0** |
| schema_migrations | db.migrate | migration runner | 7 |

\* mistakes 生产者 P8-003E 才接通，行数为 0 属预期（等真实答错发生）。
\** mindmap 有完整功能链路，0 行是用户尚未创建导图，非断链。

### (b) 缺生产者待补 — 3 张（均零行、零消费者，但设计在案）

| 表 | 设计承诺 | 现状 | 建议排期 |
|---|---|---|---|
| memories | TECH_DESIGN §6.3：extractor 产出 memories 直接落库；ADR-010：importance×新近度 top5 进 context | extractor（M4-C/D）未实现落库；tutor_context 也无 memories 数据源——**生产者/消费者双缺** | extractor 补课 micro-task（可与 P8-003E 后续合并） |
| conversations | TECH_DESIGN §6.2⑥：对话落库 + §9 GET/POST /conversations | Tutor 当前为无状态单轮（M4-D） | 对话历史功能立项时（前端解冻后，UI 是其消费前提） |
| messages | 同上：context_json 快照落 messages（上下文透视 UI 依赖） | 同上 | 同上 |

### (c) 死表待删 — 0 张

三张空表全部有在案设计承诺（TECH_DESIGN §4 DDL + §6），不删。
历史遗留表 edges / note_concepts / note_links 已被 migration 002 显式 DROP，
不在运行时——历史清理已闭环。

## 对 T-EXPORT 范围的联动结论（D2）

EXPORT_MANIFEST 现有定义（vault + attachments + metadata/eventlogs + settings 去密钥）
**不含** conversations / messages / memories——三者当前为空且 TECH_DESIGN §4.2
标注"单设备内容，v1 不参与同步"，导出范围无需因此收窄。
**附条件**：未来对话历史落地时，T-EXPORT 范围必须复议（对话属用户数据，
"数据不锁死"红线适用）。此条件已足矣，无需现在动作。

## 流程规矩（自下一个 migration 生效）

**任何 migration 新增表，必须在同一提交中登记生产者位置**
（哪个模块、哪个函数、哪次调用写入）；无生产者的表不得合入。
登记位置：`docs/DATA_MODEL.md` 变更行 + 代码内注释。
本规矩已写入 INDEX.md 顶部规则区。

---
