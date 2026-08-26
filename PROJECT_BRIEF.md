# Open Learning OS — 项目决策文档（Project Brief）

> 供架构评审/路线判断使用。生成于 2026-08-26，对应提交点：M1 完成 + ADR-008 模型冻结。
> 标注 **【待定】** 的字段需要项目所有者拍板；其余内容均为已冻结的既有决策（附出处）。

---

## 1. 项目愿景

### 1.1 一句话介绍

```
一个开源、本地优先、AI 驱动的学习型知识操作系统：
帮助用户收集知识、理解概念、练习技能，并形成长期记忆。
（Open Learning OS — open-source, local-first AI learning environment）
```

### 1.2 核心目标（按优先级）

| # | 目标 | 说明 |
|---|---|---|
| 1 | AI 学习助手 | 记忆感知 Tutor：知道"我学过什么、哪里薄弱"，而非通用聊天 |
| 2 | 长期记忆系统 | 四维掌握度 + SM-2 复习 + 错误本——产品灵魂 |
| 3 | 知识管理 | Markdown vault 双链 + 类型化知识图谱（Node=Entity） |
| 4 | 数学学习环境 | LaTeX 即时渲染 + SymPy/Jupyter（Phase 3 触发） |
| 5 | 编程学习环境 | 执行轨迹可视化 Trace→动画（M9/M10），非 IDE |

明确不做：击败 Obsidian/Notion · 商业 SaaS · 云端绑定 · 用户锁死。

---

## 2. 用户需求

### 2.1 用户画像
P1 项目所有者（数学/编程/备考）→ P2 学习者（大学生/自学/转行/考证）→ P3 开源贡献者。

### 2.2 用户每日任务
学数学 · 学编程 · 写笔记（双链+LaTeX）· 复习（SM-2 队列）· 问 AI（带个人上下文）。

### 2.3 解决的核心痛点
1. 笔记很多但用不起来 → 图谱 + 掌握度让知识"活"
2. 学完容易忘 → 遗忘曲线 + 自动复习排期
3. AI 回答没有个人上下文 → Tutor 前置查询掌握度/错误史
4. 错题没有沉淀成薄弱点 → mistakes 表 + 概念级归因（未来 UpMark 联动）

---

## 3. 产品边界

**当前一定做**：vault 笔记(双链/LaTeX/附件) · 类型化图谱 · Learning Graph(SM-2) ·
记忆感知 Tutor · 执行轨迹可视化 · LAN 多端同步。

**明确暂缓**（Future Roadmap，TECH_DESIGN §10）：云端账号 · 在线云同步 · 社区 · 商店 ·
商业化 · 插件运行时（仅目录约定）· i18n（预留）· Docker（公开发布前评估）· 复杂 3D 宇宙。
**数据导出（T-EXPORT）为发布前必须项**——数据不锁死红线。

---

## 4. 数据架构

### 4.1 数据真相
**选 A**：Markdown 是真相（vault/*.md）；SQLite 只存元数据/索引/学习状态缓存；
旁车 `*.mindmap.json` 为导图结构真相（ADR-002）。事件日志 jsonl 可跨端回放重建状态（ADR-005）。

### 4.2 知识模型
**选 C 混合**：Node = 类型化 Entity。v1 = {note, concept}；
预留 code_symbol/formula/person/resource（ADR-008）。关系统一进多态 `links` 表
（relation: wikilink/mentions/requires/contains/...，origin: manual/markdown/ai_suggested）。

### 4.3 数据目录
```
workspace/
├── vault/            # *.md 正文 + *.mindmap.json 旁车（事实源）
├── attachments/      # uuid 命名媒体（仅相对 URL 引用）
├── metadata/
│   ├── eventlogs/    # learning_events 追加日志（跨端同步的学习状态真相）
│   ├── devices.json
│   └── manifest.json # 本机私有，不同步
└── db/learning-os.db # SQLite 缓存/索引 —— 永不同步、永不锁死用户
```

---

## 5. 功能路线

| 里程碑 | 内容 | 战略 Phase | 状态 |
|---|---|---|---|
| M0 ✅ | 脚手架/分层/migration | Phase 0 | 完成 |
| M1 ✅ | 笔记 CRUD/TipTap v3/LaTeX/附件/FTS 端点 | Phase 1 | 完成 |
| M2-A~E ⏳ | [[双链]]解析器/links 索引反链/搜索 UI/graph 读模型/React Flow 基础图 | Phase 1 | 待办 |
| M2b | Mind Map 编辑器（旁车 json） | Phase 1 | 待办 |
| M3 / M3b | Learning Graph 掌握度引擎 / Knowledge Universe 视觉层 | Phase 2（灵魂） | 待办 |
| M4 / M5 | 记忆感知 AI Tutor（云端优先）/ SM-2 复习闭环 | Phase 2 | 待办 |
| M6 | Tauri 桌面打包 | Phase 4 | 待办 |
| M7 / M8 | LAN Sync v1 / Mobile MVP(Android, RN+混合内核) | Phase 4 | 待办 |
| M9 / M10 | Visual Engine V1(trace 动画) / AI 生成可视化 | Phase 3 | 待办 |

> 注：执行顺序沿用已批准里程碑序（多端先于编程可视化）；
> 若要严格按战略 Phase 2→3→4 交换 M6-M8 与 M9-M10，请在开始 M6 前提出。

---

## 6. AI 设计

### 6.1 运行方式
**混合**：云端 OpenAI-compatible API 优先（DeepSeek/Qwen/OpenAI 任一，settings 配置驱动）；
Ollama = 改 base_url 即切本地；M8 后手机在家走桌面引擎、外出直连云。

### 6.2 能力优先级
1 记忆感知问答(Tutor) → 2 自动链接(auto-link) → 3 生成思维导图 → 4 错题分析(extractor+
UpMark 联动预留) → 5 学习计划(复习推荐) → 6 总结 → 7 代码解释(配 trace) → 8 代码生成(远期)。
Embedding/RAG 延后（触发：概念 >2000 或匹配质量不足）。

---

## 7. 技术栈确认

| 层 | 选型 | 备注 |
|---|---|---|
| Desktop | Tauri 2（M6） | sidecar: PyInstaller 打包 FastAPI |
| Frontend | React 18 + TS + Vite + Zustand | 单 global.css；TipTap v3 线编辑 |
| Backend | Python 3.12 + FastAPI | 仅绑 127.0.0.1；PORT 可覆盖 |
| Mobile | React Native（Expo，Android 先行） | M8；iOS 待 macOS 条件 |
| Database | SQLite(stdlib sqlite3)+FTS5 | 无 ORM；图查询递归 CTE |
| 图渲染 | @xyflow/react | 仅渲染；d3-force 布局在 M3b |

---

## 8. 开源要求

- **许可证：【待定】** — 建议 MIT 或 Apache-2.0（后者含专利授权条款更稳）；当前仓库无 LICENSE 文件，首次对外发布前必须补上
- **开源目标（建议，待确认）**：希望别人使用 ✓ · 形成长期社区 ✓ · 不做商业化
- **开源标准**：文档完善（进行中：AGENTS/TECH_DESIGN/ADR×8/environment/separation/CONTRIBUTING）✅ ·
  一键安装（两条命令）✅ · 数据导出（T-EXPORT，发布前必须）⏳ ·
  插件系统（仅设计预留）⏳ · i18n（预留）⏳ · Docker（发布前评估）⏳

---

## 9. 约束条件

- **开发方式**：AI 生成代码（受宪法/ADR/ECR/§12 八项清单约束）；
  人负责产品决策 · 测试验收 · Code Review · 方向裁决
- **时间投入：【待定】**
- **硬件（影响本地 AI）：【待定】** —— 当前云端优先，故不阻塞任何里程碑

---

## 10. 当前已有成果

**已完成里程碑**：M0（脚手架，pytest6/vitest2/build 绿）、
M1（notes CRUD+TipTap+附件+FTS 端点，pytest18 全绿，端到端实测），
T-M1R（ADR-008 模型冻结 + migration 002 已应用真实 workspace）。

**代码结构**（21 文档文件 + server/app 三层 + web/src 六视图 + shared/types）：
详见 `git ls-files` 与 TECH_DESIGN §2.2 模块图。

**依赖清单**：Python 运行时 3（fastapi/uvicorn/python-multipart）；
Web 运行时 12（react/react-dom/zustand/katex/marked/@xyflow/react 未装/
tiptap×3/tiptap-markdown/math-ext/extension-image/d3-force 未装）；
全部登记于 docs/dependencies/REGISTRY.md 并含否决备选记录。

**技术文档**：AGENTS（宪法）· TECH_DESIGN（唯一技术来源 §1-§10）·
environment · separation · CONTRIBUTING · architecture/(principles+ADR-001~008+
integration-upmark) · dependencies/(policy+REGISTRY) · version-control/git-policy ·
data-model/INDEX · tasks/TASKS · CHANGELOG。

---

## 11. 当前最大疑问（按风险排序）

1. **中文 FTS5 分词**：默认 unicode61 对中文按整串分词，搜索体验受限——
   M2-C 时需裁决（trigram tokenizer / 外挂 jieba 预分词列 / icu 扩展）
2. **RN 混合内核双实现一致性**：SM-2/掌握度 Python↔TS 双写的长期维护成本与漂移风险（ADR-006）
3. **图片路径与多端同步兼容细节**：当前存服务端相对 URL `/api/v1/attachments/x`，
   手机离线时如何解析（M7/M8 需定：随包下载 or 本地重映射）
4. **许可证选择**：MIT vs Apache-2.0（见 §8，待定）
5. **M9 Trace 引擎投入产出比**：护城河潜力高但工程量大，开始前建议再做一次三问复核
6. **插件体系升级时机**：从目录约定到真实加载器的触发条件（社区规模？）

---

## 附：决策资料包索引（你点名要的文件 → 实际位置）

| 要求 | 实际文件 |
|---|---|
| 必须：TECH_DESIGN.md | [docs/TECH_DESIGN.md](docs/TECH_DESIGN.md)（§1-§10 含 DB 设计/API 设计/路线） |
| 必须：TASKS.md | [docs/tasks/TASKS.md](docs/tasks/TASKS.md) |
| 必须：ARCHITECTURE | [AGENTS.md](AGENTS.md)（宪法）+ [docs/architecture/](docs/architecture/)（principles + separation + ADR-001~008 + integration-upmark） |
| 必须：REGISTRY.md | [docs/dependencies/REGISTRY.md](docs/dependencies/REGISTRY.md)（+ dependency-policy.md） |
| 数据库设计 | TECH_DESIGN §4 + [docs/data-model/INDEX.md](docs/data-model/INDEX.md) |
| API 设计 | TECH_DESIGN §9（/api/v1 全量清单）+ shared/types/*.ts 契约 |
| 目录结构 | README「目录」节 + environment.md §三 归属表 |
