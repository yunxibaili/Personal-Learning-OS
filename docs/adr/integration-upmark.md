# UpMark 联动计划（挂起中 · 未排期）

> **状态：SHELVED**。本文档只记录计划与边界，不含任何已实现功能；
> 用户显式发起联动开发时才解挂。关联：TECH_DESIGN §10 backlog · TASKS 挂起区。
> 关联项目：https://github.com/yunxibaili/UpMark · 本地 `D:\dev\upmark`

日期：2026-08-26 · 状态：Shelved

## 一、UpMark 是什么（速览）

- **升本通**：个人备考工具。PC(Windows) FastAPI + SQLAlchemy + SQLite（默认 :8000），
  自研 MD 行扫描状态机解析题库导入；Flutter Android App 绑定 PC → 全量下载 →
  离线刷题 → 回家批量幂等上报进度
- 数据规模：~790 题 / 12 科目 / 48 章；题型 单选/判断/填空(+材料分组)；支持图像题与 `$公式$` 文本化
- 题库格式：`练习题.md` 分区 + 编号题干 + 选项 + `**【答案】**` + `**【讲解】**`，
  E/W 校验码体系（E100 BOM / W302 缺答案 …），规范见其 `docs/MD格式规范v2.2.md`
- 与本联动直接相关的既有能力：**错题本（in_wrong_book）**、答题记录
  （question_id/is_correct/answered_at，幂等去重）
- 接口契约唯一依据：仓库根 `api_contract_v2.json`。常用：
  `GET /api/sync/all` · `GET /api/sync/questions/{chapter_id}` ·
  `POST /api/sync/progress` · `GET /api/health`

## 二、为什么联动

Learning OS 的 mistakes / learning_events / SM-2 复习与 UpMark 的错题本天然互补：

```
UpMark 刷题答错(is_correct=false, 入错题本)
      ↓ U1: 桌面桥接客户端定期/手动拉取 progress
Learning OS integrations/upmark.py
      ↓ 题目↔概念映射（如"04-导数与微分"章 → Concept「导数」）
quiz_wrong 事件 + mistakes 登记 → 掌握度下调 · FORGOTTEN 排期 · AI Tutor 定向讲解
      ↓ U2: 反向通道
复习队列推荐弱概念 → 经契约取对应章节题目嵌入测验 → 结果回传 progress
```

形成「做题 → 诊断 → 复习 → 再做题」闭环，两系统各守本职。

## 三、联动阶段（解挂后再细化排期）

| 阶段 | 内容 | 方向 | 前置 |
|---|---|---|---|
| U1 错题登记流入 | 拉 progress → 映射概念 → 写 quiz_wrong/mistakes | UpMark → Learning OS | M3+M4 完成 |
| U2 双向出题 | 复习队列出题嵌入测验，结果回传 | 双向 | +M5 测验模式 |
| U3 题库文件导入（远期可选） | 练习题.md 作为 exercises 资产引入 workspace（适配其格式规范） | UpMark → vault | U1/U2 验证价值后 |

映射存储（U1 解挂时建）：`question_concept_map(upmark_question_id, concept_id, confidence)`
——先登记于 docs/DATA_MODEL.md §A 变更日志，走 migration，禁止提前创建。

## 四、硬边界（红线）

1. **只经 UpMark 公开 REST 契约通信**（以 api_contract_v2.json 为准）；
   禁止直连其 SQLite——对方红线禁改表结构，外部直读存在锁与 schema 漂移风险
2. 两仓库完全独立：不共享代码、不建 monorepo；Learning OS 侧只新增
   `server/core/integrations/upmark.py` 一个客户端模块（标准库 HTTP，符合依赖纪律，
   REGISTRY 登记）
3. **端口共存**：两服务默认都占 :8000。FastAPI 自 M0 起支持 `PORT` 环境变量——
   共存时以 `PORT=8100` 启动 Learning OS
4. 不向 UpMark 写入其红线禁止的内容；不触碰其 test-bank/computer-bank 私有数据的分发
5. 联动产生的学习数据仍遵循 ADR-005：以文件形式落 workspace 才可多端可见

## 五、解挂流程

用户说「启动 UpMark 联动 U1/U2/U3」→ 本文件升版记录决策 → TASKS 登记正式任务 →
Dependency Review（如需）→ 按 AGENTS 流程开发。
