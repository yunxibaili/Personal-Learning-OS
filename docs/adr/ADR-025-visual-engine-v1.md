# ADR-025: Visual Engine V1 (算法执行轨迹可视化)

**状态**：提议 **v3**（2026-09-01 按二轮终审修正；v1 草案已作废，v2 六项偏离已获二轮终审全部确认，以本文为准）
**决策者**：项目负责人
**评审**：终审意见《M9 V1 技术方案最终评审意见》（2026-09-01）·
二轮终审《v2 改稿审核结论》（2026-09-01，六项偏离全部确认，另提 5 项冻结前修正，已落入本文，见 §11.2）
**关联**：ADR-001（Markdown 唯一事实源）· ADR-004（依赖管理）· ADR-013（前端设计系统）·
ADR-023（可视化边界）· ADR-024（frontmatter round-trip 地基）·
`TECH_DESIGN.md` §8.2–§8.5 · `AGENTS.md` §9（技术栈冻结）

---

## 1. Problem

`TECH_DESIGN.md` §8.2–§8.5 定义了 Visual Engine V1 的规格，但契约位置、安全模型、
与 ADR-023 的边界、模板路由四件事未在既有 ADR 中裁决。

2026-09-01 代码核查（HEAD `3db327a`）：

| 交付物 | 应有位置 | 实际 |
|---|---|---|
| 采集 / 编排 | `server/app/core/tracer/` | ❌ 不存在 |
| 路由 | `server/app/routers/trace.py` | ❌ 不存在 |
| 契约 | `shared/types/trace.ts` | ❌ 不存在 |
| 播放器 | `web/src/components/visual-engine/` | ❌ 不存在 |
| 示例库 | `server/app/core/tracer/examples/` | ❌ 不存在 |
| 数据表 | migration 010+ | 止于 `009_event_id_rename.sql` |
| API | `POST /api/v1/trace/run` | §9.2 标 ❌，归属 M9 |

**已就位**：`core/mastery.py:134/194/391` 已实现 `visualize → practice +0.05 × weight`
——掌握度侧零改动，M9 只补事件生产者。
**门槛已解除**：`TECH_DESIGN` §10「后端 backlog 清零前 M9 不启动」——`TASKS.md:26` 已标清零，M6 已完成。

---

## 2. 范围锁定（V1）

### 2.1 定位

> **受控的 Python 教学示例执行可视化器，不是通用代码可视化器。**

`sys.settrace` 对受控教学示例足够好，但没有必要用它解决通用算法可视化问题。

### 2.2 允许 / 禁止

**允许**：Concept 页预置的 6 个教学示例 · 单文件 · 基础类型
（`None` / `bool` / `int` / `float` / `str` / `list` / `tuple` / `dict`）·
元数据中显式声明的 `example_id` · 三个已知 Renderer。

**禁止（V1 硬性边界）**：

| 禁止项 | 归属 |
|---|---|
| 用户笔记中任意 code block 自动执行 | 永不（违反安全模型） |
| 用户任意输入代码 | 永不 |
| 力扣题 · `class ListNode` 等复杂对象 · 链表 / 树 / DP / 图 | M9.5 ALGOGEN / VTA |
| 依赖 LLM 动态分析自定义代码 | M9.5 |
| 通用 AST → 可视化 | M9.5 |
| 函数图像等专用可视化（`FuncPlotView`） | 有真实需求时再立 |

### 2.3 三类数据职责不混淆

```text
Markdown      = 知识 + 可视化声明（VisualizationSpec，载体 M9.5 待定）
TraceRun      = 运行时派生数据，不属于 Markdown 事实源；V1 不持久化
Learning Event= 用户是否使用过动画 → Mastery
```

**核心原则**：Markdown 保存**声明**，不保存动画 Trace 本体。

---

## 3. Decision

### 3.1 核心链路

```text
Concept 页预置示例
   ↓ example_id
Trusted Examples（随代码发布，非用户数据）
   ↓
POST /api/v1/trace/run
   ↓
独立 Python 子进程（sys.settrace）
   ↓
safe_snapshot + limits
   ↓
TraceRun
   ↓
VisualEngine（IDE 步进）→ FrameStackView / ArrayView / GeneralView
   ↓
Learning Event（visualize）
```

### 3.2 目录结构

**后端**（`tracer` 是**包**不是单文件，快照逻辑独立以便 Python 升级时隔离）：

```text
server/app/core/tracer/
   ├── __init__.py        # 编排入口 run_trace()
   ├── runner.py          # 子进程入口（python -m），import hook + builtins 收敛 + settrace
   ├── snapshot.py        # safe_snapshot()，唯一取值出口
   ├── limits.py          # 五重限制常量
   └── examples/
        ├── manifest.py   # 示例清单（example_id / title / concept_title / template）
        ├── quicksort_basic.py
        ├── binary_search.py
        ├── bubble_sort.py
        ├── factorial.py
        ├── fibonacci.py
        └── linear_search.py
server/app/routers/trace.py
shared/types/trace.ts
```

> **示例文件位置铁律**：`examples/` 随代码发布，属**应用资产**，
> **绝不放 `workspace/vault/`**（用户数据区，会参与同步，且可被用户改写——
> 一旦可改写就不再是「受信任示例」）。

**前端**（组件**入 ui 组件库**）：

> **2026-09-01 落地裁定**：组件落在 **`ui/visual-engine/`**（ui 库），
> **不合并进 `web/`**。`web/src/components/ui/index.ts` **不导出** M9 组件——
> 避免出现「ui 库一套样式、项目里另一套」的双份来源。
> 样式定稿处是 `ui/visual-engine.html`（HTML 原型，内含 6 个示例的真实 TraceRun），
> 组件 CSS 是它的等值转写。**回灌 `web/` 的时机归 M9-007。**

```text
ui/visual-engine/
   ├── VisualEngine.tsx      # 组合壳：CodePane + Renderer + DebugToolbar 三区布局 + 键盘绑定
   ├── CodePane.tsx          # 代码 pane：gutter 行号/执行热力 + 当前行橙底 + 行尾 inline values
   ├── DebugToolbar.tsx      # IDE 步进语义：Back/Into/Over/Out/Continue/Restart + KEY_BINDINGS
   ├── FrameStackView.tsx    # 调用栈（栈顶在上，y 偏移表递归深度）
   ├── ArrayView.tsx         # SVG 柱状图（数值数组）
   ├── GeneralView.tsx       # 兜底：数组 chips + 帧列表
   ├── stepping.ts           # 步进状态纯函数（无 React）：nextStepIndex / canStep / stackDepth
   ├── derive.ts             # 派生计算纯函数（热力/变更键/inline values/柱高归一化）
   ├── highlight.ts          # 零依赖 Python 词法高亮（跨行字符串状态机）
   ├── visual-engine.css     # 取值全部来自 ../../tokens.css，无裸值
   ├── index.ts              # 唯一对外暴露面（组件 + 纯逻辑 + 类型 + CSS_PATH）
   ├── tsconfig.check.json   # 仅类型自检；ui/ 无 node_modules，react 类型经 paths 指向 web/
   └── *.test.ts             # 68 项：stepping 19 / derive 37 / highlight 12

ui/archive/visual-engine-tsx-2026-09-01/   # 归档：样式定稿前的 TSX 稿，冻结不再维护
```

**验证命令**（三条，须全绿）：

```bash
cd web && ./node_modules/.bin/vitest run --dir ../ui/visual-engine        # 68 项
cd ui/visual-engine && ../../web/node_modules/.bin/tsc --noEmit -p tsconfig.check.json
node ui/visual-engine.smoke.js                                            # HTML 原型 36 项断言
```

> **交互范式裁定（2026-09-01 所有者）**：**否决 StepPlayer 播放器**
> （播放三角 + 拖拽进度条的时间轴隐喻），改用 **IDE 调试器语义**——
> 代码是主角，步进 = 检查程序状态而非"看视频"。借鉴 VS Code Debug
> （inline values、CALL STACK、Step Over/Into/Out）与 birdseye（执行热力）。
> 轨迹全量已录（TraceRun 一次性返回），所以"后退"天然可用，无需播放器。
>
> **键位刻意偏离 VS Code（F5/F10/F11/Shift+F11）**：F 键会被浏览器抢走
> （F5 刷新、F11 全屏），笔记本上还需配合 Fn。改用 **↓ 单步进入 / → 单步跳过 /
> ↑ 单步跳出 / 空格 继续 / ← 上一步 / R 重新开始**，单手可达、无需说明。
> 详细理由与业界对照见 `ui/UI_DESIGN.md` §7.4.1。

**职责解耦**：**模板 View 不处理步进控制**。M8 Mobile 改触摸交互时只动
`DebugToolbar` / `stepping.ts`，三个 Renderer 不受影响。

### 3.3 示例库 = 唯一可执行来源

V1 **只执行 `examples/` 清单内的示例**。请求只传 `example_id`，**不接受任意代码**。

| example_id | 算法 | template |
|---|---|---|
| `quicksort-basic` | 快速排序 | `ArrayView` |
| `binary-search` | 二分查找 | `ArrayView` |
| `bubble-sort` | 冒泡排序 | `ArrayView` |
| `factorial` | 阶乘递归 | `FrameStackView` |
| `fibonacci` | 斐波那契递归 | `FrameStackView` |
| `linear-search` | 线性查找 | `GeneralView` |

- 清单条目字段：`example_id` · `title` · `concept_title`（匹配 `concepts.title`）· `template` · `path`
- **不建表**：`concept_demos` 表按 `TECH_DESIGN` §4 仍延后至「M9 后评估」
- Concept 页按 `concepts.title` 匹配 `concept_title`；**无匹配示例的 Concept 不显示 Visualize 按钮**
  （不是灰置，是不出现）

**Trusted Example Registry 硬性规则（二轮终审 P0-2）**：

1. **`example_id` 是清单枚举键，不是文件路径。** worker 源码只经 manifest 的 `path`
   字段映射解析；**绝不** `Path("examples") / example_id` 直接拼接——
   否则 `../../something.py` 形成路径穿透。
2. **registry 保证 `concept_title → example_id` 唯一**，manifest 加载时校验：
   重复即启动失败。Concept 页匹配语义：0 个 → 无按钮；1 个 → 显示；**>1 个 → 禁止猜测**，
   构建期已拦住，不应发生。
3. **`concepts.title` 是 V1 匹配键，但不是长期契约**——concept 改名即断链（§10 已知代价），
   待稳定 ID（T-NOTE-HIER P1）落地后前置映射，不改 registry 结构。

### 3.4 模板路由

**由示例清单的 `template` 字段决定，前端只读该字段路由，不做任何语义分析。**

| Renderer | 场景 | 职责 |
|---|---|---|
| `FrameStackView` | factorial / 递归 / 调用栈 | 展示 stack frames |
| `ArrayView` | quicksort / 二分 / 排序 | 展示数组、当前位置 |
| `GeneralView` | 其他简单算法（**V1 fallback**） | 通用 frames + locals + 简单容器 |

- `FuncPlotView` **取消**，改为 `GeneralView`；函数图像待有真实需求时再立
- 不做复杂 SVG、函数图像、专用动画布局
- **V1 不做模板自动推断**（原方案 A）：tracer 不做 swap 语义检测、不做 heap diff。
  延后至 M9.5，需独立附录解除本条冻结

### 3.5 Provider 中立（settrace 是实现，不是协议）

**约束**：`sys.settrace` 是 V1 的**实现方式**，不得成为协议本身。
协议是 `TraceRun` JSON——前端与 API 都不得感知 settrace 的存在。

**兑现方式**：不预先建 `TraceProvider` 抽象基类，而是靠契约约束——
`TraceRun` / `TraceEvent` 中**不得出现任何 settrace 专有概念**
（无 `opcode`、无 `f_lineno`、无 `frame.f_*` 语义、无 `settrace` 事件类型枚举）。
未来切到 Python 3.12+ `sys.monitoring` 或 M9.5 的 VTA 时，只要 `TraceRun` 形状不变，前端零改动。

> **为何不建抽象基类**：V1 只有一个实现。一个实现配一个接口是 speculation，
> 违反 `AGENTS.md` §2.3 与「boring solution 优先」。待 M9.5 出现第二个 Provider 时再抽取——
> 届时真实的两个实现会让接口设计有依据。详见 §11 偏离 6。

### 3.6 编码通道预算（横切约束）

沿用 ADR-023 判据「一个维度 = 一个通道」：

| 维度 | 允许通道 | 禁止 |
|---|---|---|
| 当前执行行 | 品牌橙底纹（唯一） | 同时改字号 / 加边框 / 加动画 |
| 变量变更 | 橙色描边 + ≤0.3s transition | 引入第三色相 |
| 递归深度 | 帧堆叠的 **y 偏移**（位置编码） | 用颜色深浅表示深度 |
| 数组元素值 | 条高（长度编码） | 条高 + 颜色双编码 |
| 比较 / 当前指针 | 复用品牌橙 | 引入 `ArrayView` 专属新色 |

橙 = 注意力指针，只服务交互焦点与进度，**不用于静态分类**（变量类型、数据类型等）。

### 3.7 与 ADR-023 的边界裁决

| 维度 | ADR-023 三类（知识可视化） | ADR-025（算法可视化） |
|---|---|---|
| 可视化对象 | 概念 / 笔记 / 关系 | Python 代码执行过程 |
| 数据源 | `concepts` · `links` · `mastery` | `TraceRun`（内存，一次性） |
| 交互范式 | 探索 / 过滤 / 布局 | 播放 / 暂停 / 单步 / 拖拽进度 |
| 持久化 | Universe 视口 localStorage · MindMap 旁车 JSON | **V1 不持久化** |
| 数据流 | 双向 | 单向（示例 → trace → 前端） |

**裁决**：

1. Visual Engine 是**第四类可视化**，与 ADR-023 三类无数据源重叠，不消费
   `concepts` / `links` / `mastery`，故 ADR-023 的布局缓存与图谱视觉编码不适用于 M9。
2. **唯一例外（写入通道）**：视觉化触发 → `POST /api/v1/events` 写
   `event_type="visualize"`。这是 mastery 的**生产者**而非消费者，
   不违反 ADR-023——ADR-023 冻结的是「把 mastery 投射到图上」，不是「产生 mastery 事件」。
3. ADR-023 的编码通道预算条款不适用于 M9（M9 不是图谱），但其精神适用，已落地为 §3.6。

---

## 4. TraceRun v1 契约

> **整个 API 返回值是 `TraceRun`，不是 `TraceEvent[]`。**
> `status` / 错误 / 版本 / 运行元数据不得塞进 `TraceEvent`。

### 4.1 顶层（冻结）

```typescript
interface TraceRun {
  version: "1";                  // 契约版本，字符串；新增字段须升 "2" 并经附录裁决
  language: "python";            // V1 唯一取值
  events: TraceEvent[];          // ≤ MAX_TRACE_EVENTS
  status: "completed" | "timeout" | "error" | "trace_limit" | "output_limit";
  error?: { type: string; message: string };
  metadata: {
    example_id: string;
    template: "FrameStackView" | "ArrayView" | "GeneralView";
    [key: string]: unknown;      // M9.5 VTA 扩展位
  };
}
```

### 4.2 TraceEvent（冻结）

```typescript
interface TraceEvent {
  step: number;
  line: number;
  frames: TraceFrame[];          // 调用栈，frames[0] 为当前帧
  stdout: string;                // 本步新增 stdout，可为空串
  metadata: {};                  // V1 恒为空对象；M9.5 VTA 扩展位
}

interface TraceFrame {
  func: string;
  line: number;
  locals: Record<string, TraceValue>;
}
```

**关于 `heap` 字段**：终审 §6 列了 `heap: TraceHeapObject[]`。本 ADR **取消该字段**，
值全部内联在 `frames[].locals`。理由见 §11 偏离 3。

### 4.3 TraceValue（冻结，无 `$ref`）

V1 **不做对象图**，无 heap_id、无 `$ref` 去重。取值规则：

| 输入 | 输出 |
|---|---|
| `None` / `bool` / `int` / `float` | 原值（JSON 原生） |
| `str` | 截断至 200 字符 |
| `list` / `tuple` / `dict` | 递归展开，深度上限 3，元素上限 200 |
| 其他（自定义对象 / 函数 / 模块 / 类） | `{ "type": "object", "class": "<ClassName>" }` |
| 超限容器 | `{ "type": "truncated", "n": <实际元素数> }` |

**绝不调用用户对象的 `repr()` / `str()`**——用户自定义 `__repr__` 是任意代码执行面。

### 4.4 status 语义与 HTTP 状态

| status | 触发 | HTTP | 说明 |
|---|---|---|---|
| `completed` | 正常执行完毕 | 200 | — |
| `timeout` | 超过 `MAX_RUNTIME` | 200 | 已录得部分轨迹**可回放** |
| `trace_limit` | 超 `MAX_TRACE_EVENTS` 或 `MAX_RECURSION_DEPTH` | 200 | 同上 |
| `output_limit` | stdout / stderr 超限 | 200 | 同上 |
| `error` | `SYNTAX` / `IMPORT_DENIED` / `RUNTIME` | 200 | — |

> **四类非 `completed` 状态一律返回 HTTP 200**：执行本身成功完成，
> 用户代码的问题是**业务结果**，不是 API 调用失败。前端须渲染错误态，
> 且在 `timeout` / `trace_limit` / `output_limit` 下仍回放已录得的部分轨迹。
> 真正的 HTTP 4xx/5xx 只用于**调用方错误**（未知 `example_id` → 404；
> `mode: "vta"` → 400；引擎内部故障 → 500）。

### 4.5 请求体与 mode

```typescript
interface TraceRunRequest {
  example_id: string;            // V1 唯一必需字段
  mode?: "trace" | "vta";        // 预留，V1 不接受 "vta"
}
```

| mode | V1 行为 |
|---|---|
| `undefined` | → `trace` |
| `"trace"` | → `trace` |
| `"vta"` | → **400 `{error:{code:"unsupported_mode"}}`** |

**明确禁止**在 V1 后端写 `if mode == "vta": ...` 分支——那会让 API 看起来已支持 VTA 实则没有。

> **关于 `code` 字段（二轮终审 P0-1）**：终审 §17 请求体含 `{ code: string }`。本 ADR **不开放该字段**，
> 理由见 §11 偏离 1。措辞为**「V1 禁止字段」**而非「暂不支持」——
> 一旦接受任意 `code`，§2「用户任意代码不执行」的安全边界形同虚设（前端校验可绕过）。
> API 收到含 `code` 的请求体按未知字段拒绝（422），不做静默忽略。

---

## 5. 安全模型

### 5.1 五重限制（`core/tracer/limits.py`）

**不能只依赖 timeout。** 五者必须同时存在：

| 常量 | V1 取值 | 触发 status |
|---|---|---|
| `MAX_RUNTIME` | 10 s | `timeout` |
| `MAX_TRACE_EVENTS` | 5,000 | `trace_limit` |
| `MAX_STDOUT_BYTES` | 64 KB | `output_limit` |
| `MAX_STDERR_BYTES` | 64 KB | `output_limit` |
| `MAX_RECURSION_DEPTH` | 100 | `trace_limit` |

数值经验收测试可调；**调整必须同步本表与契约测试**。
`MAX_RECURSION_DEPTH` 独立于 Python 自身 `RecursionError`（后者由 `error`/`RUNTIME` 兜底）。

### 5.2 执行与终止

```text
FastAPI ── Popen(worker) ── watchdog(threading.Timer) ── kill()
```

- **绝不在 FastAPI 主进程执行教学代码**
- 超时由父进程 `process.kill()`（Windows 即 `TerminateProcess`）
- `threading.Timer` 是 V1 watchdog 实现，但**它不是安全边界**——
  **真正的安全边界是独立 OS process**

### 5.3 ⚠️ 事件循环红线

> **`POST /api/v1/trace/run` 的 handler 必须是同步 `def`，不得改为 `async def`。**

`subprocess.Popen` + `wait()` 是阻塞调用。若在 `async def` 中直接等待，
将**冻结整个 FastAPI 事件循环最长 10 秒**——期间所有其他请求全部排队。

同步 `def` 由 FastAPI 自动调度到线程池，不阻塞事件循环。
此约束须由 code review 与一条守护测试（断言 handler 非协程函数）锁定。

### 5.4 Import 白名单与 builtins 收敛

**首要裁决：`sys.settrace` 只采集，不拦截。** `line` 事件在该行**执行前**回调，
能观察到即将执行哪一行，但**无法否决该行内部发生的 builtin 调用**。

| 关注点 | 机制 |
|---|---|
| Import | 子进程内替换 `builtins.__import__` 为白名单版本 |
| Builtins | 执行用户代码**前**移除 `open` / `exec` / `eval` / `compile` / `input` / `breakpoint` |
| 进程隔离 | `Popen([sys.executable, "-m", "app.core.tracer.runner", ...])` |

```python
ALLOWED_IMPORTS = {
    "math", "random", "datetime", "collections",
    "itertools", "functools", "string", "re",
    "json", "heapq", "bisect", "copy",
    "decimal", "fractions", "statistics",
    "typing", "dataclasses", "enum", "abc",
}
```

禁止：`os` · `sys` · `subprocess` · `socket` · `pathlib` · `urllib` · `shutil` ·
`pickle` · `ctypes` · `multiprocessing` · `importlib` 及全部第三方库（含 `numpy`）。
白名单外 import → `error.type == "IMPORT_DENIED"`。

### 5.5 stdout / stderr 一律走 tempfile

```text
stdout → tempfile
stderr → tempfile
```

**禁止 `Popen(stdout=PIPE)`。**

> **理由修正**：常见说法是「PIPE 在大输出时阻塞」——严格说，
> `subprocess.run(capture_output=True)` 内部已用线程读取，**不会死锁**。
> 采纳 tempfile 的真实理由是**内存无界**：`while True: print("hello")`
> 会让父进程把全部输出读进内存直至 OOM；tempfile 天然可设硬上限且可被 OS 回收。
> 结论相同，归因不同——归因错了会在别处做出错的取舍。

超限即终止 worker 并置 `status = "output_limit"`。

### 5.6 快照序列化防御

所有取值集中在 `core/tracer/snapshot.py`，Python 版本升级时不污染 tracer 主逻辑。

| 规则 | 内容 |
|---|---|
| 绝不调用 `repr()` / `str()` | 未知类型 → `{"type":"object","class":...}` |
| 深度上限 3 | 超出降级为 `object` |
| 容器元素上限 200 | 超出 → `truncated` |
| 快照时机 | 拿到 frame **立即**快照，不跨事件持有引用 |

> **版本差异**：Python 3.13（PEP 667）起 `frame.f_locals` 返回独立写透快照；
> 3.12 是共享字典、每次访问刷新。项目锁定 3.12。`AGENTS.md` §9。
> 「立即快照」规则在两版下均安全。
>
> **澄清**：读 `frame.f_locals` **不会**触发用户代码的 `__getattribute__`——
> 它只是把已存在的对象引用拷进字典。真正的副作用风险在**序列化阶段调用 `repr()`**，
> 故防御点在 serializer，不在读取点。

**信任声明**：V1 = 本地应用执行随代码发布的受信任示例，等同用户手动 `python examples/x.py`。
Docker 隔离保留至 Phase 5（`AGENTS.md` §705）。

### 5.7 并发限制与资源清理（二轮终审 P1-1 / P1-2）

**并发限制**：handler 用同步 `def` 只是**不阻塞事件循环**，不是吞吐保护——
FastAPI 把同步 handler 调度进线程池，多个 10 秒级 trace 并发会把线程池占满，
拖死所有其他 API。故新增 API 层限制：

| 常量 | V1 取值 | 超出行为 |
|---|---|---|
| `MAX_CONCURRENT_TRACES` | **1**（`trace semaphore = 1`） | HTTP **429** `{error:{code:"trace_busy"}}` |

- 取 1 是因为 M9 V1 是教学动画生成，不是高吞吐计算服务；串行化让超时/取消语义最简单
- 实现为进程内 `threading.Semaphore(1)`，`acquire(blocking=False)` 失败即 429，**不排队**
- 此限制是 **API 层的第六道护栏**，不属于 §5.1 五重限制（那是 worker 内的单次执行预算）

**cleanup 生命周期（kill ≠ cleanup complete）**：无论正常完成、超时 kill 还是异常退出，
都必须在 `finally` 中完成全部收尾，Windows 下尤其如此：

```text
worker 结束（含 kill）
  → cancel watchdog Timer
  → 关闭 stdout/stderr tempfile 句柄
  → process.wait() 回收 returncode（无僵尸进程）
  → 删除 tempfile
```

守护测试覆盖：trace 结束后 **tempfile 已删除、Timer 已 cancel、无残留子进程**。
长期运行遗留临时文件视为缺陷。

---

## 6. 持久化与学习事件

### 6.1 Markdown 只保存声明

**原则**：

```text
Markdown 保存 VisualizationSpec，不保存 TraceEvent[]。
```

`example: quicksort-basic` 是**对受信任示例的引用**，不是嵌入代码：

```text
Markdown ── example_id ──> trusted_examples/quicksort-basic.py
```

由此明确区分：**普通代码块 ≠ 可执行代码**。

**⚠️ 载体待定，HTML 注释已被排除。** 终审 §12 建议的 `<!-- olos:visualize ... -->`
在本项目**必然丢数据**——实证：`web/src/components/editor/TiptapEditor.tsx:27`
配置为 `Markdown.configure({ html: false, linkify: true })`，`html: false` 关闭 HTML 透传，
注释在**载入编辑器时即被丢弃**，随后 `onChange → getMarkdown()` 保存即永久删除。

**V1 决策：不引入 Markdown 声明。** 入口是 Concept 页按 `concepts.title` 匹配示例清单
（§3.3），不需要 Markdown 承载任何声明。理由：

1. HTML 注释载体已被 `html:false` 排除
2. frontmatter 是**笔记级**，无法表达「某个 code block 的可视化」这一段落级语义
3. code fence info string（` ```python visualize:x `）需改 tiptap-markdown 配置并验证往返，属独立风险
4. V1 验收标准（§8 第 8 条）只要求「Concept 页可以打开动画」，笔记内入口不在 V1 范围

Markdown 声明的**载体**标为 M9.5 待定；**原则**（只存声明、不存 Trace）本 ADR 即刻生效。

### 6.2 TraceRun 是运行时派生数据

```text
Markdown Vault ── VisualizationSpec ──> Engine ──> TraceRun ──> VisualEngine
```

> **TraceRun 是运行时派生数据，不属于 Markdown 事实源；V1 不持久化。**
> 未来若有性能需求，可作为可重建缓存讨论（届时须走 `TECH_DESIGN` §4 建表流程）。
> ——不说「Trace 是 SQLite 派生缓存」：V1 没有这张表，缓存只是未来选项。

**V1 不建 `trace_cache` 表**（详见 §11 偏离 4）。但原则即刻生效：

> **删除 SQLite 不会造成任何用户知识损失**——Trace 可从 Markdown 声明重新生成。

这与 ADR-001「Markdown 是唯一事实源」及 ADR-024 §2.6 红线 1
（「任何业务结果不得依赖 SQLite 中不可从 Markdown 重建的状态」）完全一致。

### 6.3 visualize 事件：点击即记录

```text
用户点击 Visualize → POST /trace/run → 成功生成 TraceRun → 记录 visualize
```

**不等待动画播放完成。** V1 衡量的是「用户是否主动使用算法可视化能力」，
不是「是否完整观看动画」。

M9.5 再考虑 `visualize_started` / `visualize_25` / `visualize_50` / `visualize_completed` 细分。

---

## 7. Implementation Order

| # | 任务 | 产出 | 前置 |
|---|---|---|---|
| **M9-001** | 本 ADR 批准 + 文档同步 | 4 处文档 | — |
| **M9-002** | `shared/types/trace.ts`（TraceRun / TraceEvent / TraceValue）+ 契约测试 | 契约与守护测试 | M9-001 |
| **M9-003** | tracer PoC（**拆 4 步，见下**） | runner / snapshot / limits | M9-002 |
| **M9-004** | `POST /api/v1/trace/run` + API 测试（含 `mode:"vta"` → 400） | 路由 | M9-003 |
| **M9-005** | `CodePane` + `DebugToolbar` + `stepping` 状态模型（**入 ui 组件库**，见 §3.2 裁定） | IDE 步进壳，无 Renderer | M9-002 |
| **M9-006** | `FrameStackView` / `ArrayView` / `GeneralView` | 三 Renderer | M9-005 |
| **M9-007** | 示例清单 6 条 + Concept 页入口 + `visualize` 事件 | 端到端闭环 | M9-004 + M9-006 |
| **M9-008** | M9 全量验收（11 条） | 验收报告 | M9-007 |

### 7.1 M9-003 PoC 四步（不得跳步）

| 步 | 用例 | 验证点 |
|---|---|---|
| **PoC-1** | `factorial` | `call` / `line` / 递归 frames / `return` |
| **PoC-2** | `quicksort` | 数组变更、行高亮、ArrayView 数据完整性 |
| **PoC-3** | `while True: pass` | watchdog 生效、`process.kill()`、`status == "timeout"` |
| **PoC-4** | 大量 `print` | tempfile 输出、output limit、无阻塞 |

M9-003 的目标**不是「做通用 tracer」**，而是证明：settrace + 递归 frame + 安全快照 +
process.kill + stdout tempfile + TraceRun 序列化，六件事全部成立。

**四步全绿后才进入 M9-004。**

---

## 8. 验收标准（11 条，按二轮终审分三层）

> 分层目的：失败时能立即定位是**引擎**、**UI** 还是**产品集成**的问题，
> 而不是在一张 11 条平铺表里排查。编号保持 v2 连续，跨节引用不失效。

### A. 技术层

| # | 标准 |
|---|---|
| 1 | `factorial` 能正确产生递归 frames |
| 2 | `quicksort` 能产生正确数组状态 |
| 5 | 无限循环能被父进程可靠终止 |
| 6 | 大量 stdout 不会导致 API / worker 阻塞 |
| 7 | `TraceRun` 能通过前后端契约测试 |

### B. UI 层

| # | 标准 |
|---|---|
| 3 | `DebugToolbar` 支持步进语义：Step Over / Into / Out / Continue / Restart（含后退——轨迹全量已录） |
| 4 | 当前 step 能正确高亮代码行 |

### C. 产品 / 架构层

| # | 标准 |
|---|---|
| 8 | Concept 页可以通过示例清单打开动画 |
| 9 | Markdown 中只保存可视化声明，不保存 `TraceEvent[]`（V1：不保存任何声明，见 §6.1） |
| 10 | 删除 SQLite 后可以从 Markdown 重新生成动画 |
| 11 | `visualize` 事件能够进入 Learning Memory |

### 守护测试清单（契约测试 ≥18 项）

1. `TraceRun` 顶层六字段齐备；未知 `version` 走降级只读渲染
2. `TraceValue` 类型封闭：未知类型 → `{"type":"object","class":...}`
3. 用户自定义 `__repr__` **不被调用**（断言调用次数为 0）
4. 深度 >3 → `object`；容器 >200 → `truncated`
5. `MAX_TRACE_EVENTS` 超限 → `status == "trace_limit"` 且 HTTP 200
6. `while True: pass` → `status == "timeout"` 且**无僵尸进程**
7. 1 MB `print` → `status == "output_limit"`，API 不阻塞
8. 递归深度超限 → `status == "trace_limit"`
9. `import os` → `error.type == "IMPORT_DENIED"`
10. `open()` 在示例代码中不可用（builtins 收敛生效）
11. `mode: "vta"` → HTTP 400 `unsupported_mode`
12. **`POST /trace/run` handler 是同步 `def`**（断言非协程函数，锁 §5.3 红线）
13. 未知 `example_id` → HTTP 404
14. 无匹配示例的 Concept → 不渲染 Visualize 按钮
15. 点击 Visualize → `POST /events` 写 `visualize`，`practice` 增量 = `0.05 × weight`
16. **并发限制**：已有 1 个 trace 在跑时再发请求 → HTTP 429 `trace_busy`，不排队（锁 §5.7）
17. **路径穿透**：`example_id = "../../x"` → HTTP 404，绝不触达 `Path("examples") / example_id` 拼接（锁 §3.3 规则 1）
18. **cleanup 生命周期**：trace 结束（含 timeout kill）后 tempfile 已删除、watchdog Timer 已 cancel、无僵尸进程（锁 §5.7）

> 12 只证明「不阻塞事件循环」，16 才证明「并发不拖垮线程池」——两条缺一不可（二轮终审 §13/§14）。

---

## 9. Deferred（M9.5 ALGOGEN / VTA）

V1 **不实现**，但协议层预留扩展位：

| 项 | 载体 |
|---|---|
| VTA 结构（链表 / 树 / DP 表 / 图） | `TraceRun.metadata` 扩展位 |
| `vta_hint` / `structure_type` | 同上，**V1 不实现任何字段** |
| `mode: "vta"` | 请求体已预留，V1 返回 400 |
| 模板自动推断（原方案 A） | 需独立附录解除 §3.4 冻结 |
| `trace_cache` 表 | 见 §11 偏离 4 |
| Markdown VisualizationSpec 的载体 | 见 §6.1，待 `html:false` 问题解决后定 |
| Docker 沙箱 | Phase 5（`AGENTS.md` §705） |
| 打包态（`sys.frozen`）子进程解释器 | M6 未打包后端（无 sidecar / 无 PyInstaller spec），V1 不触发；**后端一旦打包必须回补** |

**M9 与 M9.5 复用同一层**：`VisualEngine` 组件集（CodePane · DebugToolbar · Renderer 架构）·
`VisualizationSpec` · `Learning Event`。因此 M9 **不需要**为 M9.5 提前实现复杂算法可视化。

---

## 10. Consequences

**正**：

- 补齐算法教学闭环；Concept 页可直接演示排序 / 递归 / 查找
- 零新依赖（全部标准库），零新表，不触碰 `AGENTS.md` §9 与 `DEPENDENCIES.md` 注册表
- 掌握度侧零改动：`visualize` 事件权重已就位
- 安全边界清晰：只执行随代码发布的示例，不执行用户代码——
  相比「执行任意代码 + 沙箱」路线，攻击面小一个数量级

**负 / 代价**：

- **能力受限**：用户无法可视化自己的代码，力扣 / 链表 / 树 / DP 全部不可用，
  直到 M9.5。这是**显式接受**的取舍
- `sys.settrace` 逐行回调开销大（典型 10–30× slowdown），5000 事件上限是硬约束
- 本地信任模型无进程外隔离——受信任示例是随代码发布的，风险由代码 review 承担，
  而非运行时沙箱
- 示例清单与 `concepts.title` 的匹配是**脆弱耦合**：concept 改名即断链
  （与 ADR-024 §2.1 wikilink 标题寻址同构，同样待稳定 ID 解决）

**回滚路径**：若安全模型被挑战，可降级为「仅回放预录 trace，完全不执行 Python」，
此时 §5 整体删除，但需重写验收标准 1 / 2 / 5 / 6。

---

## 11. 对终审意见的六处偏离（**已获二轮终审全部确认，2026-09-01**）

> 终审方向全部采纳。以下六处是**内部矛盾或实证冲突**，按工程判断处理，逐条列出供推翻。
> **裁决记录**：二轮终审已逐条确认全部成立（偏离 1 评级🔴坚决通过，2/4/5/6🟢，3🟢/🟡），
> 无需推翻；本 ADR 据此由 v2 升级 v3。

| # | 终审原文 | 本 ADR 处理 | 理由 |
|---|---|---|---|
| **1** | §17 请求体 `{ code: string; lang; mode? }` | **不开放 `code` 字段**，请求体 = `{ example_id, mode? }` | 与终审 §2「V1 只执行预置示例 / 用户任意代码不执行」**直接冲突**。API 一旦接受任意 `code`，安全边界形同虚设——前端校验可绕过。**须裁决** |
| **2** | §6 status 枚举 4 值；§11 要求 `status = output_limit` | 枚举补为 **5 值**：`completed \| timeout \| error \| trace_limit \| output_limit` | §11 引入的 `output_limit` 不在 §6 枚举内，属内部遗漏。补上即可，无副作用 |
| **3** | §6 `TraceEvent.heap: TraceHeapObject[]` | **取消 `heap` 字段**，值内联在 `frames[].locals` | 终审 §8 同时要求「不做完整 Heap Graph、不要 Python Tutor 对象图」。无 `heap_id` / `$ref` 去重需求时，`TraceHeapObject[]` 无从定义——那正是要砍掉的东西。少一个契约面 |
| **4** | §13 建议建 `trace_cache` 表 | **V1 不建表**；「Trace 是可重建派生数据」原则即刻生效 | 终审自述「可选」；`TECH_DESIGN` §4 明定新表须延后；5000 事件生成耗时 <1s，缓存收益低于建表成本（新表须同提交登记生产者，见 `TECH_DESIGN` §4）。**原则与表解耦**——删库零损失不依赖这张表 |
| **5** | §11「PIPE 会阻塞」 | 采纳 tempfile **结论**，**修正理由** | `subprocess.run(capture_output=True)` 内部用线程读管道，**不会死锁**。真实理由是**内存无界**。归因错了会在别处做错取舍，故写入 §5.5 |
| **6** | §5 建 `TraceProvider` 抽象（SetTrace / Monitoring / VTA） | **不建抽象基类**，改由契约约束兑现 Provider 中立 | V1 只有一个实现；一个实现配一个接口是 speculation，违反 `AGENTS.md` §2.3。中立性靠「`TraceRun` 不得出现 settrace 专有概念」（§3.5）锁定，效果等价且零成本。待 M9.5 出现第二实现时再抽取 |

### 11.1 附：本次同步的文档漂移

| # | 位置 | 问题 | 处理 |
|---|---|---|---|
| 1 | `AGENTS.md:257` | ADR 范围写「001~023」，漏 024 | 已改 `001~025` |
| 2 | `TECH_DESIGN.md` §8.3–8.5 | 与终审冲突（limits 数值 / FuncPlotView / 用户代码块入口） | 已同步 |
| 3 | `AGENTS.md:213` / `:532` / `ADR_INDEX.md` | 引用 `REGISTRY.md`，该文件已并入 `docs/DEPENDENCIES.md`，仓库根无此文件 | **未处理**（超范围），已登记 `TASKS.md` 挂起区 |

### 11.2 二轮终审五项冻结前修正（v2 → v3，2026-09-01 落实）

> 二轮终审判定 v2 为「A- / 可冻结候选版」，批准六项偏离，但要求冻结前补 5 项修正。
> 全部已落入本文：

| # | 优先级 | 修正 | 落点 | 状态 |
|---|---|---|---|---|
| 1 | **P0** | `example_id` 取代 `code` 成为唯一执行入口；`code` 定性为**禁止字段**（收到即 422），不是「暂不支持」 | §4.5 · §11 偏离 1 | ✅ |
| 2 | **P0** | **Trusted Example Registry** 硬性规则：`example_id` 是枚举键非路径（防穿透）；`concept_title → example_id` 唯一，manifest 加载期校验；>1 匹配禁止猜测 | §3.3 | ✅ |
| 3 | **P1** | `MAX_CONCURRENT_TRACES = 1`，超出 → 429 `trace_busy`，不排队（防止同步 handler 占满线程池） | §5.7 · 守护测试 16 | ✅ |
| 4 | **P1** | cleanup 生命周期：kill ≠ cleanup complete，`finally` 中 cancel Timer / 关句柄 / 回收进程 / 删 tempfile | §5.7 · 守护测试 18 | ✅ |
| 5 | **P0** | 清除旧契约残留：`heap` / `$ref` / `Event.metadata.template` / `{code}` API 已全部清出；`TraceRun.metadata = { example_id, template }` 锁定；措辞统一为「TraceRun 是运行时派生数据，V1 不持久化」（不再出现「SQLite 派生缓存」） | §2.3 · §4.1 · §4.2 · §6.2 | ✅ |

**验收分层**（技术 / UI / 产品三层，替代 v2 平铺表）亦按二轮终审建议落实，见 §8。

**M9.5 不再扩写**：VTA / Provider / cache / Markdown DSL 均已封入 §9 Deferred，
继续往 V1 里塞任何一项都会重新违反「最少依赖、最小 V1」原则（二轮终审结语，采纳为纪律）。
