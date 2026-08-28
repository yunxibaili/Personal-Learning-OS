# Regression Checklist

> 每次 Gate 执行时逐项检查。勾选通过项。

---

## 使用方法

1. 复制本文件到当前 Gate 报告
2. 逐项执行
3. 记录结果到 Gate 报告

---

## 1. 后端单元测试

```
□ pytest -q → 全部 passed
□ 无 skipped（除非有明确记录）
□ 无 deprecation warning 需处理
```

## 2. 后端 API 测试

```
□ test_notes.py → 全部 passed
□ test_mastery.py → 全部 passed
□ test_suggest.py → 全部 passed
□ test_m2_smoke.py → 全部 passed
□ test_smoke.py → 全部 passed
```

## 3. 数据恢复测试

```
□ test_recovery.py → 全部 passed
```

## 4. 前端

```
□ npm run build → pass（无 TS 错误）
□ npm run test → pass
□ CSS 变量引用无断裂
```

## 5. 契约一致性

```
□ shared/types/*.ts 与 API 响应形状一致
□ pytest 契约测试覆盖新增端点
□ 无前端直接调用不存在的 API
```

## 6. 依赖审计

```
□ requirements.txt 与实际 import 一致
□ package.json 与实际 import 一致
□ 无未登记依赖
□ 无重复功能依赖
□ 无已废弃依赖
```

## 7. 架构边界

```
□ Frontend 未直连 SQLite
□ Router 未包含业务逻辑
□ Core 未 import FastAPI
□ LLM 调用仅在 core/ai/
□ 全部数据变更经 event 路径
```

## 8. 文档同步

```
□ CURRENT_STATE.md 已更新
□ TECH_DESIGN.md 如有改动已同步
□ data-model/INDEX.md 如有改动已同步
□ TASKS.md 回填完成报告
□ CHANGELOG.md 有对应条目
```

---

**全部通过 = 回归通过。任何一项失败 = 必须修复后重跑。**
