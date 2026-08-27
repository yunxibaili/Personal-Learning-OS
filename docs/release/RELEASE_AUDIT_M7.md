# M7 Sync Release Audit Report（M7-006.5）

> 日期：2026-08-27 · 基线 commit：e75a16a · 执行：AI（用户批准范围）
> 目标：M7 从开发状态转为稳定发布基线。零功能变更、零同步语义变更。

## 结论：**PASS — M7 达到稳定发布基线**

| 检查项 | 预期 | 实际 | 状态 |
|---|---|---|---|
| pytest 全量 | ≥397 全绿 | **397 passed** | ✅ |
| vite build | PASS | ✓ built | ✅ |
| vitest | PASS | 2 passed | ✅ |
| git working tree | clean 单 commit | 本次审计唯一提交 | ✅ |

## Phase 1 · Sync Boundary Final Audit — PASS

九模块 AST 扫描：stdlib only、零三方依赖、零违规导入。
三处例外全部定性合规（只读哈希 / Layer-3 设备身份 / 用户裁决删 artifact），
详见 `docs/sync/SYNC_BOUNDARY_REPORT.md`。两道 AST 回归测试永久在库。

## Phase 2 · Truth Model Audit（ADR-020）— PASS

- 白名单 = Layer 1 三类，实现与文档一致：
  `SYNC_PATTERNS = vault/**/*.md + metadata/eventlogs/**/*.jsonl +
  mind_maps/**/*.mindmap.json`（manifest.py:21）
- 黑名单生效：`db/`、`metadata/devices.json`永不入同步；settings/API keys 无传输路径
- 验收口径符合裁定：E2E 仅比较 Layer 1 sha256 快照
  （test_e2e_demo.py `layer1_snapshot`），未触碰 concept_mastery/review_queue/links

## Phase 3 · Recovery Audit — PASS

| 异常场景 | 证据 | 结果 |
|---|---|---|
| 网络断开 / 对端宕机 | test_phase_3_2_peer_down_then_retry_recovers | 失败不破坏本地，重试最终一致 |
| 半写恢复（merge 中断） | test_case_b_merge_failure_never_half_merged | fail-closed，本地原样可重试 |
| .sync_tmp 残留 | TestCrashRecovery::test_case_a + 本审计探针 | 旧文件有效、不入 manifest、启动无影响（health ok） |
| 重复同步 | test_idempotent_replay_all_skip + test_sync_recovery.py | 相同 manifest → 零变化 |

附加探针（本审计执行）：stray tmp + 损坏 jsonl 行同时存在时——
health=ok、manifest 正确索引该文件（白名单匹配）、find_conflicts 为空。

## Phase 4 · Documentation Freeze — DONE

docs/sync/*（model/transport/boundary report）· CURRENT_STATE（M7 全景 + Next Up）
· TASKS（路线决议 § + M7 拆解区）· CHANGELOG 均已对齐至本报告状态。

## Phase 5 · T-EXPORT 预检 — DONE

产出 `docs/release/EXPORT_MANIFEST.md`：必含/必排清单、用户数据随行包定义、
三项发布前缺口（导出脚本未实现等）。正式导出脚本仍属 backlog T-EXPORT，
触发条件不变（首次公开发布前必须）。

## 遗留（非阻断，已挂账）

1. M7-007 Vault Conflict Preservation（vault 冲突项现为显式 no-op——文档承诺 vs 实现的已知缺口）
2. Data Model Terminology Cleanup（event_id / event_uuid）
3. routers/sync pairing / LAN manifest exchange 尚未实现（M8 前置）
