# ADR-006: 移动端技术栈——React Native + 混合内核

日期：2026-08-26 · 状态：**Superseded as primary route; retained as fallback**
（2026-09-03 所有者裁定：M8 主路线改为 Tauri 2 Mobile——**conditional on M8-000 spike**，
见 `Open Learning OS — M8 Mobile 可行性决策评审.md` 裁定记录；RN 保留为 fallback，
仅当 M8-000 证明 Tauri Mobile 的 Core 迁移成本/runtime 限制不可接受时重激活。
M8 全线暂停，PC Stable Baseline 优先。本 ADR 的引擎策略三选一与编辑分级仍然有效，
框架无关部分可平移。）

## Context

多端形态确定手机客户端需求：离线浏览/搜索笔记、复习测验（SM-2 调度）、笔记轻编辑、
LAN 同步、AI 讲解。手机上没有 Python——知识引擎如何存在于移动端是核心抉择。

## Decision

### 框架：React Native（Expo 管理），Android 首发

- 复用 TS 类型定义、API client 形态、Zustand 心智与部分纯逻辑组件
- iOS 构建依赖 macOS/Xcode，本机 Windows 环境 → **iOS 待条件具备再评估**（Expo EAS 云构建届时再议）
- Expo 触发安装时机 = M8 启动前（REGISTRY 规划表），此前禁止进入 package.json

### 引擎策略：C 混合内核（三选一裁决）

| 层 | 位置 | 说明 |
|---|---|---|
| 数据 | expo-sqlite 本地缓存 | 由同步下来的文件重建（md 索引 + eventlog 回放的 mastery），与桌面同构：DB=缓存 |
| SM-2 / 掌握度数学内核 | **TS 移植版 ~200 行**（shared 包） | 手机离线可独立完成复习调度与掌握度展示 |
| Tutor/RAG/图谱查询 | 不上手机 | 在家走桌面 FastAPI(LAN)；外出降级直连云 LLM（无个性化上下文或仅带缓存的 mastery 摘要） |

**一致性保障**：pytest(Python 版) ↔ vitest(TS 版) 使用同一份事件夹具 JSON，
断言两端输出逐字段一致；夹具随任一端算法变更必须双端同步更新。

### 编辑能力分级

查看/搜索 ✅ · 复习测验 ✅ · 笔记轻编辑（文本级改动可推回）✅ ·
思维导图编辑 ❌（v1 只读渲染大纲）· 可视化播放 ❌（M9 后评估投屏方案）

## Alternatives Considered

| 方案 | 否决理由 |
|---|---|
| Flutter(Dart) | 第二语言栈；与 TS 前端共享为零；团队(个人)维护成本翻倍 |
| PWA | iOS/Android 对文件系统、后台任务、SQLite 支持受限，无法承载 Local-first 数据权 |
| 纯瘦客户端 | 离线即残废，违背 Local-first 初心 |
| 全量引擎移植 TS | 推翻"后端 Python"冻结决策；RAG/tutor 双实现维护成本最高 |

## Reason

最大化复用既有 TS 资产与人脑心智；把必须离线的最小闭环（读/搜/复习）留在端上，
把重的智能留给桌面与云，复杂度分布最合理。

## Consequences

- 出现第二套运行时（RN），依赖审计从 M8 起覆盖 RN 生态
- mastery/sm2 数学从此有 Python+TS 双实现——任何公式改动（TECH_DESIGN §5）必须双端同步，
  一致性测试是合并门禁
- Android 优先意味着 M8 验收基于真机/MuMu 模拟器（UpMark 项目已验证 MuMu adb 流程可用）
