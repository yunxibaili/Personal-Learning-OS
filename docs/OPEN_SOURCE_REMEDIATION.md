# 开源就绪度整改意见（Open Source Readiness Remediation）

> 以优秀开源项目为基准，对 Personal Learning OS 的客观评估与整改清单。
> 生成日期：2026-08-28 · 评估对象：HEAD `2c6b8d1`（复核于 `2c6b8d1`，结论未变）
>
> 与 `PROJECT_STATE_SUMMARY.md` 的分工：后者只陈述事实，本文给出判断与整改项。
> 本文中「事实」与「判断」分开标注，判断项均注明对标基准。

---

## 0. 评估基准与方法

本文采用三套外部基准，避免以个人偏好为标准：

| 基准 | 来源 | 用途 |
|---|---|---|
| **基准 A：OpenSSF Scorecard** | OpenSSF 官方 20 项检查（`ossf/scorecard/docs/checks.md`） | 供应链安全与工程健康度的行业通行量化标准 |
| **基准 B：GitHub 社区标准** | GitHub Docs「关于公共仓库的社区资料」 | 贡献者第一眼看到的社区就绪度 |
| **基准 C：同类项目对标** | SiYuan（思源）、Logseq、Anki、Joplin、Trilium | 产品能力与架构演进的参照系 |

**评估结论（先行给出）**：

> 本项目在**工程质量与文档深度上显著超出同类项目的早期阶段**——453 个后端测试、23 份 ADR、三层真值模型、fail-closed 同步写入口，这些是多数同星段项目不具备的。
> 但在**开源工程基础设施上几乎为零**——无 CI、无发布、无治理文件、无分支保护。
> **核心矛盾：代码已达到可协作水准，仓库形态仍停留在个人私有项目阶段。**

---

## 1. 基准 A：OpenSSF Scorecard 20 项对照

评分说明：Scorecard 单项 0–10 分；下表「当前估计」为依据仓库实际状态的推断，非官方跑分结果（仓库尚未公开接入 Scorecard）。

| # | 检查项 | 风险级 | 当前事实状态 | 当前估计 |
|---|---|---|---|---|
| 1 | `Dangerous-Workflow` | Critical | 无任何 workflow 文件 | N/A（无对象可评） |
| 2 | `Webhooks` | Critical | 未配置 | N/A |
| 3 | `Binary-Artifacts` | High | `.gitignore` 已排除 `dist/`、`workspace/`、`sandbox/`、`.venv/`；仓库内无二进制产物 | **10** ✅ |
| 4 | `Branch-Protection` | High | 无分支保护配置；单人直接 push 至 `main` | **0** |
| 5 | `Code-Review` | High | 99 次提交全部单人直接提交，无 PR / 无 Review 记录 | **0** |
| 6 | `Dependency-Update-Tool` | High | 无 Dependabot / Renovate 配置 | **0** |
| 7 | `Maintained` | High | 90 天内高频提交（仅 2026-08-28 即 4 次） | **10** ✅ |
| 8 | `Signed-Releases` | High | `git tag` 数量 = **0**，无任何 Release | **0** |
| 9 | `Token-Permissions` | High | 无 workflow | N/A |
| 10 | `Vulnerabilities` | High | 未接入 OSV 扫描；`requirements.txt` 仅范围约束（`fastapi>=0.115,<1`） | **0**（未验证） |
| 11 | `Fuzzing` | Medium | 无模糊测试 | **0** |
| 12 | `Packaging` | Medium | 无 PyPI / npm / GitHub Package 发布 | **0** |
| 13 | `Pinned-Dependencies` | Medium | `web/package-lock.json` 已入库 ✅；但 Python 侧无 hash pinning，npm 侧未锁 integrity 到 CI 强制校验 | **3–5** |
| 14 | `SAST` | Medium | 无 CodeQL / SonarCloud | **0** |
| 15 | `SBOM` | Medium | 无 SBOM 产物 | **0** |
| 16 | `Security-Policy` | Medium | 无 `SECURITY.md`（仅有 `docs/security/network-boundary.md`） | **0** |
| 17 | `CI-Tests` | Low | **无 `.github/` 目录**，PR 无任何自动测试 | **0** |
| 18 | `CII-Best-Practices` | Low | 未申请 OpenSSF Best Practices 徽章 | **0** |
| 19 | `Contributors` | Low | 单一贡献者 | **0** |
| 20 | `License` | Low | Apache-2.0，`LICENSE` 已入库 | **10** ✅ |

**综合估计：约 2.5 / 10**（17 项可评项加权）。参考区间：Logseq、SiYuan 等成熟项目通常在 6–8 分区间。

**关键判断**：失分集中在「工程基础设施」而非「代码质量」。该 20 项中，**有 8 项可通过新增配置文件在数小时内解决**（第 6、11、14、15、16、17、18 项及第 4 项），属于低投入高收益区间。

---

## 2. 基准 B：GitHub 社区标准对照

| 推荐文件 | 状态 | 说明 |
|---|---|---|
| `README.md` | ⚠️ **存在但内容滞后** | 见 §2.1，严重问题 |
| `LICENSE` | ✅ | Apache-2.0 |
| `CONTRIBUTING.md` | ✅ | 质量高，含强制流程与架构红线速览 |
| `CODE_OF_CONDUCT.md` | ❌ **缺失** | 贡献者准入的第一道信号 |
| `SECURITY.md` | ❌ **缺失** | 漏洞披露渠道不明确 |
| `SUPPORT.md` | ❌ 缺失 | 优先级低 |
| Issue 模板（`.github/ISSUE_TEMPLATE/`） | ❌ **缺失** | issue 质量无法结构化 |
| PR 模板（`.github/pull_request_template.md`） | ❌ **缺失** | 与 CONTRIBUTING 的 checklist 无法自动挂载 |
| `.github/dependabot.yml` | ❌ 缺失 | |

### 2.1 README 内容滞后（事实 + 判断）

**事实**：

- README 里程碑表止于 M3.5-A，其中 **M3 Learning Graph 标注为 `🔜` 待办**，但 `TASKS.md` 中 M3 已 `[x]` 完成
- README 全文提及 `M4 / M5 / M7 / P8` 的次数为 **0**——即 M4（AI Tutor）、M5（复习闭环）、M7（LAN 同步）、P8（PC 产品化）四个已完成里程碑在 README 中完全不存在
- README 声明「Node 18+」，`CONTRIBUTING.md` 声明「Node 20+」，**两份文档环境要求不一致**

**判断**：README 是开源项目的唯一门面。以 SiYuan、Logseq 的 README 为基准，其首页必然实时反映当前能力全貌。当前 README 给首次访问者的信息是「这是一个刚做完 M1 笔记 CRUD 的项目」，而实际已完成 4 个核心闭环 + 同步系统 + AI 管线。**这是本项目对外可信度损失最大的单点问题，且修复成本极低。**

---

## 3. 基准 C：同类项目能力对标

### 3.1 产品能力对照

| 能力 | SiYuan | Logseq | Anki | 本项目 | 差距判断 |
|---|---|---|---|---|---|
| 块级引用（Block ref） | ✅ 核心特性 | ✅ 核心特性 | ➖ | ❌ `blocks` 表列为 backlog | 显著差距。块级引用是双链笔记的第二次进化，直接影响笔记复用粒度 |
| 间隔重复算法 | ➖ | 插件 | ✅ **FSRS**（ML 驱动） | ⚠️ 简化 SM-2 | 算法代差。Anki 已将 FSRS 内置为可选调度器，基于记忆稳定性建模，可优化目标保留率 |
| 插件 / 扩展生态 | ✅ 成熟市场 | ✅ 插件市场 | ✅ 2000+ Addon | ❌ 仅「目录约定」 | 显著差距。生态是开源项目生命周期的关键变量 |
| 多端同步 | ✅ 官方同步 + 第三方 | ✅ | ✅ AnkiWeb | ✅ LAN Sync（M7） | 本项目已具备，但仅限局域网，无广域网方案 |
| 端到端加密 | ✅ | ❌ | ❌ | ❌ | 视定位而定，非必须 |
| 数据全量导出 | ✅ | ✅ 纯文本即导出 | ✅ | ⚠️ **Markdown 原生可带走，但无一键导出功能** | 见 §3.2 |
| 移动端 | ✅ | ✅ | ✅ | ❌ M8 延后 | 路线已决议，非缺陷 |
| i18n | ✅ 多语言 | ✅ 多语言 | ✅ 多语言 | ❌ 仅中英混排 | 影响国际贡献者参与 |

### 3.2 承诺与实现的落差（本文最重要的一项判断）

**项目自身的红线承诺**（`PRODUCT_PRINCIPLES.md` §1）：

> 用户数据永远属于用户：vault 是开放 Markdown，SQLite 可随时删除重建；**系统必须始终提供一键全量导出**，禁止任何私有格式、云端绑定或迁移阻碍。

**README 对用户的承诺**：

> 你的数据永远是开放的 Markdown + SQLite，**随时可整库带走**。

**实际状态**（`docs/release/EXPORT_MANIFEST.md`、`TASKS.md`）：

- T-EXPORT（数据全量导出）**尚未实现**
- `PROJECT_BRIEF.md` §8 自评：「数据导出（T-EXPORT，发布前必须）⏳」

**判断**：项目把「数据不锁死」定为**最高优先级产品原则（五条原则之首）**，但承载该原则的功能尚未实现。从治理角度，这是**原则与实现的未兑现缺口**，而非技术缺陷——Markdown vault 本身确实是开放的，用户手动拷贝目录即可带走，所以不构成数据锁死。但「必须始终提供一键全量导出」这一**明确的功能性承诺**目前未兑现。

以同类项目为基准：Logseq 与 SiYuan 均将「纯文本存储」本身作为导出方案的基石，并额外提供标准导出格式。**本项目建议优先补齐 T-EXPORT，以闭合第一原则**——这是整改清单中唯一涉及产品可信度的 P0 项。

---

## 4. P0 致命缺陷（阻塞开源可用性）

> 判定标准：不修复则外部贡献者无法有效参与，或项目对外承诺不成立。

### P0-1 无持续集成（CI）

**事实**：仓库无 `.github/` 目录，无任何 CI 配置。所有测试（453 pytest + 23 vitest + tsc + build）仅在本机手动执行。

**判断依据**：Scorecard `CI-Tests` = 0。以任何成熟开源项目为基准，CI 是 PR 合并的强制门禁，缺失即等同于「不接受外部贡献」。

**整改动作**：新增 `.github/workflows/ci.yml`：

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

permissions:
  contents: read          # Token-Permissions：最小权限

jobs:
  backend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: server
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
          cache: pip
      - run: pip install -r requirements.txt -r requirements-dev.txt
      - run: python -m pytest -q

  frontend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: web
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: npm
          cache-dependency-path: web/package-lock.json
      - run: npm ci          # 强制 lockfile 一致性，禁止 ^ 漂移
      - run: npm run build   # tsc --noEmit && vite build
      - run: npm test
```

**附带收益**：同时修复 `Pinned-Dependencies`（`npm ci` 强制 lockfile）、`CI-Tests` 两项。

---

### P0-2 无版本发布与语义化版本

**事实**：`git tag` 数量 = 0，`web/package.json` 版本停留在 `0.1.0-dev`，无 Release Notes。

**判断依据**：Scorecard `Signed-Releases` = 0、`Packaging` = 0。以同类项目为基准，版本号是用户判断"能否用于生产"的首要信号；`CHANGELOG.md` 已遵循 Keep a Changelog 规范，但无 tag 锚定则无法回溯。

**整改动作**：
1. 打首个 tag `v0.1.0`，发布 Pre-release（明确标注 alpha 状态，避免用户误判成熟度）
2. 在 `README.md` 顶部增加状态徽章与成熟度声明
3. 建立「里程碑收尾四件事」的执行机制——该制度已写在 `TASKS.md` 开头（依赖审计 / 环境删除测试 / CHANGELOG / Git tag），但**从未执行过 tag 这一项**，属制度未落地

---

### P0-3 README 与实际进度严重脱节

**事实**：见 §2.1。M3 标记为待办但实际已完成；M4/M5/M7/P8 零提及；Node 版本要求两处冲突。

**整改动作**：
1. 里程碑表按 `TASKS.md` 实际状态重写，补齐 M2b / M3 / M3b / M4 / M5 / M7 / P8
2. 统一 Node 版本要求（建议统一为 20 LTS，与 CONTRIBUTING 对齐，并在 CI 中锁定）
3. 增加「当前闭环状态」小节，直接告诉访客哪些能力可用、AI 环节处于 Mock 阶段

**判断**：此项修复工作量约 30 分钟，但对首次访问者的可信度影响高于任何其他单项。

---

### P0-4 无安全披露渠道（`SECURITY.md`）

**事实**：无 `SECURITY.md`。已有 `docs/security/network-boundary.md`（工程质量很高），但那是网络边界设计文档，不承担漏洞披露职能。

**判断依据**：Scorecard `Security-Policy` = 0（Medium 风险）。项目持有用户 API Key（settings 表）并处理本地文件写入，属有攻击面项目。

**整改动作**：新增 `SECURITY.md`，最小内容：

```markdown
# Security Policy

## Supported Versions
| Version | Supported |
|---|---|
| 0.1.x (pre-release) | ✅ |

## Reporting a Vulnerability
请勿公开提交 issue。请通过 GitHub Private Vulnerability Reporting 提交。
响应时间目标：72 小时内首次回应。
```

---

## 5. P1 重要缺陷（影响协作效率与长期健康）

### P1-1 依赖更新自动化缺失

**事实**：无 Dependabot / Renovate。Python 依赖为范围约束（`fastapi>=0.115,<1`），无法复现确定构建。

**整改动作**：
1. 新增 `.github/dependabot.yml`（npm + pip 双生态，周级）
2. Python 依赖引入 hash pinning（`pip-compile --generate-hashes`）或至少锁定具体版本号

### P1-2 无 SAST 与漏洞扫描

**整改动作**：新增 `.github/workflows/codeql.yml`（CodeQL，Python + JavaScript 双语言），同时满足 Scorecard `SAST` 项。

### P1-3 无代码覆盖率度量

**事实**：无 `pytest.ini` / `pyproject.toml` / `.coveragerc`，453 个测试的**实际覆盖率未知**。

**判断**：测试数量多 ≠ 覆盖充分。以同类项目为基准，覆盖率是可量化的质量信号，也是贡献者判断"改动是否安全"的依据。

**整改动作**：
1. 新增 `server/pyproject.toml`（pytest 配置 + coverage 阈值）
2. 接入 Codecov 或 Coveralls，README 展示徽章

### P1-4 无 Issue / PR 模板与行为准则

**整改动作**：
1. `.github/ISSUE_TEMPLATE/bug_report.yml` + `feature_request.yml`（YAML 表单，含必填复现步骤）
2. `.github/pull_request_template.md`——**直接复用 `CONTRIBUTING.md` 已有的 PR checklist**，避免两份维护
3. `CODE_OF_CONDUCT.md`（采用 Contributor Covenant 2.1，业界通行）

### P1-5 分支保护缺失

**事实**：单人直接 push `main`，99 次提交无一次 Review。

**判断**：当前单人开发下风险可控，但一旦有外部贡献者即成为高危点（Scorecard 将 `Branch-Protection` 与 `Code-Review` 均列为 High 风险）。

**整改动作**：在 GitHub 仓库设置中启用 `main` 分支保护：要求 PR + 至少一个通过的状态检查（即 P0-1 的 CI）。

### P1-6 前端构建产物未做代码分割

**事实**：`vite build` 产出单 chunk **1,317.67 kB**（gzip 437 kB），Vite 已输出 chunk 体积告警。

**判断**：以同类 Web 应用为基准，单 chunk 超过 1MB 会显著劣化首屏。当前依赖中 `cobe`、`d3-force`、`dagre`、`@xyflow/react`、`tiptap`、`katex` 均可按路由懒加载。

**整改动作**：按 view 维度 `React.lazy()` 懒加载，或对 `cobe`（Planet）、`dagre`（Graph）做动态 import。

---

## 6. P2 优化项（提升专业度，非阻塞）

| # | 项 | 事实 | 对标基准 |
|---|---|---|---|
| P2-1 | **T-EXPORT 数据导出** | `PROJECT_BRIEF` 标为「发布前必须」，未实现 | 见 §3.2，虽列 P2 但建议优先于其他 P2 处理 |
| P2-2 | **块级引用** | `blocks` 表在 `data-model/INDEX.md` 中被列为「延后建表」 | SiYuan / Logseq 核心特性 |
| P2-3 | **调度算法代差** | 简化 SM-2（`review_scheduler.py`） | Anki 已内置 FSRS；项目已预留「可替换但需 ADR」接口，具备升级条件 |
| P2-4 | **SBOM 产物** | 无 | Scorecard `SBOM` 项 |
| P2-5 | **i18n** | 无；`ADR-015` 仅冻结「内容语言无关」，非 UI 国际化 | 同类项目均为多语言 |
| P2-6 | **Docker** | `PROJECT_BRIEF` 标为「发布前评估」 | 降低试用门槛的标准做法 |
| P2-7 | **`global.css` 持续膨胀** | 单文件，P8 各里程累计新增 400+ 行（80+113+156+55） | 长期可维护性；与项目「小而可维护」原则存在张力 |
| P2-8 | **文档体量与新人负担** | 23 份 ADR + `TASKS.md` 44KB + `TECH_DESIGN.md` 38KB | 见 §6.1 判断 |
| P2-9 | **AI 闭环未通** | 仅 `MockProvider`，无真实 HTTP 实现 | 见 §6.2 判断 |

### 6.1 关于文档体量的判断

**事实**：项目文档密度极高——23 份 ADR、38KB 技术设计、44KB 任务台账、21KB 状态文件，且 `AGENTS.md` 强制要求写码前必读四份文件。

**判断**：这是**双面性**的。正面上，文档深度远超同星段项目，是实质资产；风险面上，`AGENTS.md` 的必读清单 + §12 八项清单 + 三问 + TASKS 回填制度，构成了对外部贡献者**极高的准入门槛**。以 Logseq、Joplin 的 `CONTRIBUTING.md` 为基准，其外部贡献者可在 15 分钟内完成首次 PR。

**建议的控制手段**（非要求削减文档）：在 `CONTRIBUTING.md` 顶部区分**「贡献者必读」**（精简，5 分钟）与**「架构决策者必读」**（完整 ADR 体系），降低首接触摩擦。

### 6.2 关于 AI 闭环的判断

**事实**：`providers/` 仅有 `base.py`（Protocol）与 `mock.py`，全仓库无任何真实 HTTP LLM 调用；`TutorPanel` 与 `/tutor/test` 均返回固定 Mock 响应。

**判断**：从**架构**角度，这是教科书级的正确做法——先冻结 `ProviderProtocol` 与 Context/Prompt 契约，用 Mock 打通全链路并锁定测试，最后替换实现。项目在有 453 个测试护体的情况下，接入真实 Provider 的风险很低。

但从**对外表述**角度需注意：README 与 `PROJECT_BRIEF` 将「记忆感知 AI Tutor」列为**第一优先目标**，而当前该能力在运行时不可演示。对外开源时建议明确标注 AI 环节处于「契约就绪、实现待接入」状态，避免贡献者预期落差。

---

## 7. 整改路线图

### 第一阶段：开源基础设施（建议 1–2 个会话）

目标：让仓库达到「可被外部贡献者使用」的最低标准，Scorecard 从 ~2.5 提升至 ~6。

1. `ci.yml`（P0-1）— 同时修复 CI-Tests / Pinned-Dependencies
2. `SECURITY.md`（P0-4）— Security-Policy 0→10
3. `CODE_OF_CONDUCT.md` + Issue/PR 模板（P1-4）— 补齐 GitHub 社区标准
4. `dependabot.yml` + `codeql.yml`（P1-1 / P1-2）— Dependency-Update-Tool / SAST 0→10
5. **README 重写**（P0-3）— 可信度收益最高的单项
6. 打 `v0.1.0` tag 并发布 Pre-release（P0-2）
7. 启用 `main` 分支保护（P1-5）

**预期 Scorecard 变化**：`CI-Tests` 0→10、`Security-Policy` 0→10、`Dependency-Update-Tool` 0→10、`SAST` 0→10、`Signed-Releases` 0→7（需 GPG 签名可达 10）、`Pinned-Dependencies` 3→7。

### 第二阶段：质量可度量（建议 2–3 个会话）

8. `server/pyproject.toml` + 覆盖率门禁 + 徽章（P1-3）
9. 前端代码分割（P1-6）
10. SBOM 产物接入（P2-4）
11. 申请 OpenSSF Best Practices 徽章（CII-Best-Practices 0→≥5）

### 第三阶段：产品承诺闭合

12. **T-EXPORT 数据全量导出**（P2-1 / §3.2）— 闭合产品第一原则
13. 真实 LLM Provider 接入 — 闭合 AI 闭环
14. 块级引用评估（P2-2）
15. FSRS 调度器评估（P2-3，需开 ADR）

---

## 8. 优先级汇总

| 优先级 | 项 | 基准来源 | 投入 | 收益 |
|---|---|---|---|---|
| **P0** | CI 流水线 | Scorecard `CI-Tests` | 中 | 极高（贡献准入门槛） |
| **P0** | README 重写 | GitHub 社区标准 | **极低** | **极高**（门面可信度） |
| **P0** | 版本 tag + Pre-release | Scorecard `Signed-Releases` | 极低 | 高 |
| **P0** | `SECURITY.md` | Scorecard `Security-Policy` | 极低 | 高 |
| **P1** | 依赖更新自动化 | Scorecard `Dependency-Update-Tool` | 低 | 中高 |
| **P1** | CodeQL SAST | Scorecard `SAST` | 低 | 中高 |
| **P1** | 覆盖率度量 | 通用工程基准 | 中 | 中高 |
| **P1** | 社区模板 + CoC | GitHub 社区标准 | 低 | 中 |
| **P1** | 分支保护 | Scorecard `Branch-Protection` | 极低 | 高（有外部贡献者后） |
| **P1** | 前端代码分割 | Web 性能基准 | 中 | 中 |
| **P2** | T-EXPORT | **项目自身第一原则** | 中 | 高（承诺闭合） |
| **P2** | 真实 LLM Provider | 产品第一目标 | 中 | 高（闭环闭合） |
| **P2** | 块级引用 / FSRS | SiYuan / Anki 对标 | 高 | 视路线决策 |

---

## 9. 需要项目所有者裁决的事项

以下几项属路线决策，非技术判断，本文不给单方结论：

1. **是否以「吸引外部贡献」为目标？** 若是，P0 全部为必做；若定位为个人项目开源存档，则 P0-3（README）与 P0-2（版本）仍强烈建议，CI 可视情况延后。
2. **i18n 的必要性**（P2-5）：决定项目是面向中文用户还是国际社区。
3. **块级引用的优先级**（P2-2）：`blocks` 表会显著改变数据模型，与「不追求功能数量」原则需要权衡。
4. **SM-2 → FSRS 是否值得开 ADR**（P2-3）：FSRS 在记忆建模上优于简化 SM-2，但引入参数拟合复杂度，与项目「最小复杂度」原则存在张力。项目已在 `review_scheduler.py` 预留可替换接口，升级的技术前提具备。

---

*文档结束。本文判断项均标注对标基准，事实项可回溯至具体文件。*
