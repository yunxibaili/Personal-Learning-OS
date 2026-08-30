# 后端架构审计 + M7-008 同步闭环交付（2026-08-30）

> 审计对象：`learning-os` 后端（`server/app`，Python 3.12 + FastAPI + SQLite）
> 审计方法：以**实测**为准，不采信文档自述。文档与实现不一致处，一律以代码和
> OpenAPI schema 实测结果为准并记录为「文档漂移」。

---

## 一、后端架构现状

### 1.1 分层

```
Frontend (React 18 + TS + Vite)      ← §0 政策下冻结，仅最小接线
        │  HTTP REST /api/v1
        ▼
Router 层  20 APIRouter / 88 端点      只做参数校验与序列化，零业务逻辑
        ▼
Core 层    纯 Python，零 fastapi 依赖  knowledge·concepts·mastery·reindex·
        │                             review_scheduler(SM-2)·universe·mindmap
        │                             tutor_context·ai/(5)·sync/(13)
        ▼
Data 层    SQLite + FTS5（无 ORM）     元数据/索引/学习状态，可重建缓存
        + Vault *.md（★事实源★）
        + eventlogs/*.jsonl（跨端可回放真相）
```

### 1.2 实测健康度

| 检查项 | 方法 | 结果 |
|---|---|---|
| 分层纪律 | grep core/ 是否 import fastapi\|starlette\|uvicorn | ✅ 零命中 |
| 连接泄漏 | 扫描 `connect()` 是否配套 `finally: close()` | ✅ 62 处调用全部配套 |
| 异常处理 | 扫描 `except:` / 裸 `except Exception` | ✅ 零命中 |
| 路由接线 | `test_router_registration.py`（双向扫描 + 自检防假红） | ✅ PASS |
| core 边界 | `test_sync_boundary_audit.py`（AST 级 stdlib-only 扫描） | ✅ PASS |
| 测试基线 | `pytest -q` | ✅ **815 passed** |

**结论**：架构 discipline 显著高于同类个人项目水准。分层不是写在文档里的口号，
而是有可执行约束（路由脱挂守护、同步边界 AST 扫描、守护自检防假红）。

### 1.3 架构值得肯定的三处设计

1. **写入口唯一性（Rule 1）**：所有落盘强制经 `SyncApply`，`/sync/plan` 明确只算不写，
   并有测试断言「调用 plan 前后文件集合不变」。这条约束让同步链路的副作用可控。
2. **三层真值模型（ADR-020）**：SQLite 是可重建缓存，vault 才是事实源。
   这意味着数据损坏可恢复（`POST /admin/reindex`），是正确的数据所有权划分。
3. **敏感值不回显**：`main.py` 主动剥离 pydantic 校验失败响应里的 `input`/`url` 字段
   （`include_input` 在该版本不支持，手工剥离）。这是容易被忽略的泄漏面。

---

## 二、进度判定：文档 vs 实测

### 2.1 后端清单（PROJECT_STATE §9）实测核对

| 项 | 文档自述 | 实测 | 判定 |
|---|---|---|---|
| B1 真实 LLM Provider | ✅ B1b 已实测 | 凭据冒烟已记录 | ✅ 成立 |
| B2 流式 SSE | ✅ | `stream()` + SSE 实现齐备 | ✅ 成立 |
| B3–B8 Extractor/链接/概念提取/导图/对话/记忆 | ✅ | 端点均在 OpenAPI 中存在 | ✅ 成立 |
| B9 中文检索 | ✅ 部分 | `_cjk_search` bigram 回退（闭环验证中实测命中 `cjk_bigram`） | ✅ 成立 |
| B10 Ollama 实测 | 待验证 | 需本机 Ollama 环境 | ⏸ **唯一未闭环项（外部依赖，非阻塞）** |
| B11–B19, B27–B28 | ✅ | 端点均存在 | ✅ 成立 |
| sync HTTP pairing/manifest | TASKS 未打勾 | 缺失 | ❌ **真实缺口 → 本次补齐** |

**判定：后端闭环度 ≈ 97%（30/31 项），唯一缺口是同步 HTTP 层，唯一待验项是 Ollama 环境。**

### 2.2 文档漂移（本次一并修正）

文档头部计数长期未更新，与实现严重脱节——这会误导后续所有基于文档做的判断：

| 项 | 文档旧值 | 实测值 |
|---|---|---|
| APIRouter / 端点 | 14 / 47 | **20 / 88** |
| Migration | 7 | **8** |
| 后端 Python 行数 | ≈ 6,119 | **≈ 9,722** |
| §7 concepts 端点说明 | 「无 DELETE，ADR-023」 | 实为 **B7.2 软删**（status=ignored，仅对 ai_suggested 桩） |
| §10.3 AI 闭环 | ⚠️ 半通（Provider 仅 Mock） | **已通**（B1b 真实凭据端到端冒烟通过） |
| TASKS M7-007 | `[ ]` 未完成 | 代码早已实现（`.conflict` 副本），仅文档未勾 |

---

## 三、本次交付：M7-008 同步 HTTP 闭环

### 3.1 缺口本质

core 侧 `scan → diff → transport → apply` 早已齐备，但 **HTTP 层没有出口**：
两台设备无法在 API 层面协商「谁有什么」，端到端同步只能靠脚本直调 core。
属于典型的「零件全对、接线没接」——本项目已发生过两次同类失效
（memories router 漏挂、TutorPanel 零 props 渲染）。

### 3.2 交付物

**Core**：`server/app/core/sync/pairing.py`
- `PeerDevice` / `add_peer`（幂等）/ `list_peers`（稳定序）/ `get_peer` / `remove_peer`
- 存于 `metadata/paired_devices.json` —— **Layer 3 本地缓存，永不同步**
  （已登记进 `SYNC_BLACKLIST`，并有测试端到端证明其不会进 manifest）
- 健壮性：原子写入（tmp → replace）、损坏先备份 `.corrupt-<ts>` 再重建、
  脏条目跳过不拖垮整簿、`MAX_PEERS=64` 上限
- fail-closed 入参校验：device_id 形态 · host（IPv4 / RFC1123）· port 范围 · **bool 显式挡掉**

**HTTP**：`routers/sync.py` 新增 6 端点

| 端点 | 作用 |
|---|---|
| `GET /sync/manifest` | 本地 Layer 1 清单（只读扫描） |
| `POST /sync/plan` | 收对端清单 → SyncPlan，**纯计算不落盘** |
| `GET /sync/discover` | UDP 广播发现（默认 1.5s、retries=1、上限 5s） |
| `POST /sync/pair` | 登记对端（幂等，同 id 更新不追加） |
| `GET /sync/peers` | 已配对列表 |
| `DELETE /sync/peers/{id}` | 解配 |

### 3.3 实测修出的真实缺陷（测试先行抓出）

1. **host 校验过松**：`999.999.999.999` 被主机名正则判为合法——
   RFC1123 标签允许纯数字，导致「配对成功但永远连不上」。
   → 收紧为「纯数字点分串一律按 IPv4 严检」。
2. **`files=[]` 逃逸成 500**：`Manifest.from_dict` 对数组输入抛 `AttributeError`，
   未在网络边界捕获 → 500。→ 补捕获，统一 400 `bad_manifest`。
3. **参数校验状态码**：本项目 `main.py` 全局处理器把校验失败映射为 **400**，
   非 FastAPI 默认 422（初版测试按 422 写，全红后才发现）。

### 3.4 端到端闭环实测结论

两设备模拟，全链路逐段验证（已固化为集成测试）：

```
设备身份独立 ✅ → 配对可写可读回 ✅ → 清单互不泄漏 ✅
→ Diff 正确分类：A独有=download / B独有=upload / 双方都改=conflict ✅
→ 传输 + Apply 落盘，字节级一致 ✅
→ reindex hook 生效，同步来的笔记立即可被 FTS 检索 ✅
→ 第二轮同步：已一致项收敛为 skip，冲突仍等人裁决（不自动合并）✅
→ 解配后配对簿清空 ✅
```

---

## 四、验证

| 命令 | 结果 |
|---|---|
| `pytest -q` | **815 passed**（基线 730 → +85），零失败 |
| 新增测试 | pairing core 45 · HTTP 30 · 端到端闭环 7 · mastery 回归 3 |
| 端点数 | 82 → **88** |

新增测试清单：
- `tests/unit/test_sync_pairing.py` — CRUD / 幂等 / 入参 fail-closed / 损坏恢复 /
  原子写入 / 永不进 manifest / core 层 stdlib-only AST 扫描
- `tests/api/test_sync_http.py` — manifest 形状与哈希 / plan 四态分类 /
  非法输入不泄漏 / 配对全生命周期 / 超时参数有界
- `tests/integration/sync/test_sync_closed_loop.py` — 两设备全链路闭环

---

## 五、遗留与建议

| 项 | 状态 | 建议 |
|---|---|---|
| B10 Ollama 实测 | ⏸ 需本机环境 | 代码路径已就绪，装 Ollama 后跑一次即可闭环 |
| B9 FTS 自身仍 unicode61 | 部分 | bigram 回退已可用；若追求分词质量再评估 jieba（会引入依赖，需过 ADR-004 六连问） |
| `metadata/devices.json` 损坏即重建身份 | 已知 | 已改为先备份再重建（B24），可接受 |
| 前端仍未接线新同步端点 | §0 政策下冻结 | 后端已就绪，解冻后 `/sync/pair` + `/sync/manifest` + `/sync/plan` 可直接对接 |
| 文档头部计数 | 已修正 | 建议在里程碑收尾清单里加一条「计数以 OpenAPI 实测为准」 |

> **判定：后端闭环达成。** 除需本机环境的 Ollama 实测外，
> `PROJECT_STATE.md §9` 全部条目已闭环，同步链路端到端验证通过。
