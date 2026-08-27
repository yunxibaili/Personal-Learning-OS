# Gate 1 — AI Boundary Audit

> M4-C LLM Provider 开工前必须通过的架构边界审计。
> 审计日期：2026-08-27 · pytest 92 passed

---

## G1-01: Context Isolation

**目标**：敏感数据不进入 prompt。

| 检查项 | 方法 | 结果 |
|---|---|---|
| api_key 字段被过滤 | tainted context → assert "sk-" not in prompt | ✅ PASS |
| password 字段被过滤 | tainted context → assert "hunter2" not in prompt | ✅ PASS |
| SQLite 路径不出现 | context builder 不暴露 db_path | ✅ PASS |
| sk- 内容前缀被替换 | concept="sk-xxxx" → "[REDACTED]" | ✅ PASS |
| Bearer token 被替换 | concept="Bearer abc" → "[REDACTED]" | ✅ PASS |
| ghp_ token 被替换 | concept="ghp_xxx" → "[REDACTED]" | ✅ PASS |
| 正常知识保留 | concept="token bucket" → 保留 | ✅ PASS |

**结论**：双重防御生效。Context Builder 输出干净，Prompt Builder 二次过滤兜底。

---

## G1-02: Prompt Purity

**目标**：build_prompt() 是纯函数，无副作用。

| 检查项 | 方法 | 结果 |
|---|---|---|
| 无文件 I/O | inspect source: no open()/Path() | ✅ PASS |
| 无 SQLite | inspect source: no sqlite/connect | ✅ PASS |
| 无网络 | inspect source: no requests/urllib/httpx | ✅ PASS |
| 无 datetime.now | inspect source: no time依赖 | ✅ PASS |
| 确定性 | 同输入 → p1 == p2 | ✅ PASS |
| 无禁止模块导入 | AST 分析：无 sqlite3/requests/httpx/urllib/aiohttp | ✅ PASS |

**结论**：build_prompt() 是纯函数。相同输入 → 相同输出。

---

## G1-03: LLM Write Boundary

**目标**：LLM 无写权限，event 是唯一写入口。

| 检查项 | 方法 | 结果 |
|---|---|---|
| 无 execute() | grep ai/tutor.py source | ✅ PASS |
| 无 INSERT/UPDATE/DELETE | grep ai/tutor.py source | ✅ PASS |
| 无 commit() | grep ai/tutor.py source | ✅ PASS |

**结论**：ai/tutor.py 是纯读模块。未来 M4-C 的 LLM Provider 只能返回文本，不能直接写 DB。

**架构约束**（冻结）：
```
LLM → Response (文本)
     → Tutor Router (解析)
     → learning_events (event 写入)
     → mastery (event-driven 更新)
```

LLM 永远不能：`llm.update_mastery()` / `llm.create_note()` / `llm.execute()`

---

## G1-04: Provider Isolation

**目标**：无 LLM 厂商绑定。

| 检查项 | 方法 | 结果 |
|---|---|---|
| 无 OpenAI import | grep source | ✅ PASS |
| 无 Ollama import | grep source | ✅ PASS |
| 无硬编码模型名 | grep gpt-/claude/llama | ✅ PASS |

**结论**：Provider 无绑定。M4-C 可自由实现 OpenAI/Ollama/其他。

**M4-C 推荐结构**：
```
core/ai/
├── providers/
│   ├── base.py      # ProviderProtocol (ABC)
│   ├── openai.py    # OpenAI-compatible
│   ├── ollama.py    # Ollama local
│   └── mock.py      # 测试用
└── service.py       # TutorService（业务层）
```

---

## G1-05: Multilingual Boundary

**目标**：ADR-015 语言契约不被破坏。

| 检查项 | 方法 | 结果 |
|---|---|---|
| prompt 不因 query 语言改变 | en query vs zh query → same system prompt | ✅ PASS |
| metadata 可扩展 | metadata is dict | ✅ PASS |

**结论**：语言自适应已预留，不破坏现有边界。

---

## G1-06: Edge Cases & Truncation

**目标**：边界情况不崩溃。

| 检查项 | 方法 | 结果 |
|---|---|---|
| 100k+ context 被截断 | massive concept → truncated=True | ✅ PASS |
| 空 concept 不崩溃 | TutorContext 无 concept → 正常输出 | ✅ PASS |
| debug fallback 正确 | mode=debug → mode=explain + requested_mode=debug | ✅ PASS |
| 所有 mode 可用 | explain/hint/review/debug → 4 个均输出有效 | ✅ PASS |

---

## 测试覆盖

| 测试文件 | 用例数 | 状态 |
|---|---|---|
| test_ai_boundary.py（新增） | 25 | ✅ 25/25 |
| test_prompt_builder.py | 16 | ✅ 16/16 |
| test_sm2.py | 6 | ✅ 6/6 |
| 其他全部测试 | 45 | ✅ |
| **总计** | **92** | **✅ 92/92** |

---

## 结论

| 项 | 状态 |
|---|---|
| G1-01 Context Isolation | ✅ PASS |
| G1-02 Prompt Purity | ✅ PASS |
| G1-03 LLM Write Boundary | ✅ PASS |
| G1-04 Provider Isolation | ✅ PASS |
| G1-05 Multilingual Boundary | ✅ PASS |
| G1-06 Edge Cases | ✅ PASS |
| **Gate 1 总结** | **✅ PASS (6/6)** |

**M4-C 可以开工。**

---

## M4-C 施工红线

通过 Gate 1 后，M4-C 必须遵守：

1. **ProviderProtocol**：所有 LLM Provider 实现统一接口
2. **Response Only**：LLM 只返回文本，不直接写 DB
3. **Event-Driven**：用户确认/系统检测 → learning_event → mastery
4. **Provider 可替换**：settings 表配置切换，代码不感知厂商
5. **Prompt 不变**：M4-B 的 build_prompt() 输出是 Provider 的唯一输入
6. **超时+重试**：Provider 必须有超时（默认 30s）和重试（默认 3 次）
7. **错误不泄露**：LLM 错误 → 用户友好消息，不暴露 stack trace / API key
