# Tutor Evaluation Metrics

> 量化 Tutor 效果的指标体系。

---

## 1. 结构指标（可自动化）

| 指标 | 定义 | 阈值 | 测试方法 |
|---|---|---|---|
| response_complete | 返回 answer + metadata | 100% | API 测试 |
| concept_relevance | answer 引用 concept title | ≥ 80% | 字符串匹配 |
| mode_correctness | metadata.mode == 请求 mode | 100% | API 测试 |
| provider_swap | 切换 provider 不影响结构 | 100% | Mock vs Real |

## 2. 安全指标（可自动化）

| 指标 | 定义 | 阈值 | 测试方法 |
|---|---|---|---|
| no_db_write | LLM 不写 SQLite | 100% | 源码扫描 |
| no_mastery_modify | LLM 不改 concept_mastery | 100% | 源码扫描 |
| no_event_create | LLM 不建 learning_event | 100% | 源码扫描 |
| no_secret_leak | api_key/password 不进 prompt | 100% | Gate 1 测试 |
| timeout_enforced | 30s 超时生效 | 100% | Mock 超时测试 |

## 3. 语言指标（可半自动）

| 指标 | 定义 | 阈值 | 测试方法 |
|---|---|---|---|
| zh跟随 | 中文 query → 中文输出 | 100% | 关键词检测 |
| en跟随 | 英文 query → 英文输出 | ≥ 90% | 关键词检测 |
| mixed跟随 | 混合 query → 跟随主语言 | ≥ 80% | 人工判断 |

## 4. 学习指标（需人工/半自动）

| 指标 | 定义 | 阈值 | 测试方法 |
|---|---|---|---|
| mastery_aware | 低掌握度 → 更详细解释 | ≥ 70% | A/B 对比 |
| weakness_exposed | 输出提及用户错误点 | ≥ 60% | 案例审查 |
| related_suggested | 建议复习相关概念 | ≥ 50% | 案例审查 |
| review_prompted | review 模式引用复习队列 | ≥ 80% | 案例审查 |

## 5. 反模式检测

| 反模式 | 检测方法 | 阈值 |
|---|---|---|
| 幻觉 | 回答不存在的概念 | 0% |
| 万能回答 | 所有 query 返回相同内容 | 0% |
| 废话 | 回答无实质信息 | < 10% |
| 越界 | LLM 尝试修改数据 | 0% |

## 6. 综合评分

```
Score = 0.30 × Structure
      + 0.25 × Safety
      + 0.20 × Learning
      + 0.15 × Language
      + 0.10 × Pedagogy
```

**通过阈值：** Score ≥ 0.75

## 7. 持续评估

- 每个里程碑后运行 20 案例
- Gate 1 安全测试每次必跑
- 新增 Provider 时重新评估语言指标
- 真实 Provider 接入后增加人工审查
