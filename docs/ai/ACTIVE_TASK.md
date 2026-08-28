# Active Task

> AI 工作记忆：当前正在做什么。
> 上次更新：2026-08-28 · P8-003B Mastery Decay 完成

---

## Task ID

P8-003D Tutor Knowledge Base（下一步）

## Status

```
P8-001A Concept Foundation     ✅
P8-001B Knowledge Universe V2  ✅
P8-001C Knowledge Planet       ✅
P8-004 Demo Cleanup            ✅
P8-002 Graph V2                ✅
P8-003A Review Session MVP     ✅
P8-003C Vault Reindex          ✅
P8-003B Mastery Decay          ✅
P8-003D Tutor Knowledge Base   ← 下一步（RAG 层：FTS5 + concept→notes→context）
P8-003E Tutor Review Bridge    🔥（Tutor 读取 mastery + 错答历史）
```

## 已完成前置

- ADR-008 / ADR-018 / ADR-020 / ADR-022 / ADR-023 全部冻结
- M7-001~006.5 同步系统完整
- workspace/db 测试脏数据已清除（P8-004）
- Universe（概念空间）+ Graph（关系地图）+ Planet（首页地球）均已落地
- Review Session MVP：SM-2 学习闭环已接入 UI（P8-003A）
- Vault Reindex：Markdown→SQLite 索引恢复机制（P8-003C）
- Mastery Decay：Ebbinghaus 时间衰减（P8-003B）

## 长期沟通规则

所有回复必须使用中文；代码、文件路径、commit hash 保持英文。

## 路线

P8-003D Tutor Knowledge Base → P8-003E Tutor Review Bridge → Home / UI Polish
