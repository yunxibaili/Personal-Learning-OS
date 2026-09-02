# ADR-027: 中文 FTS——应用侧 CJK bigram 预分词（零新依赖）

日期：2026-09-02 · 状态：Accepted
取代：ADR-011（其延后决策的触发条件已达成，且其首选改进路径 trigram 经评审证伪，见下）

## Context

ADR-011（2026-08-26）以 unicode61 起步，约定「中文搜索质量成为可感知问题」时再增强。
触发条件现已达成：unicode61 把连续汉字**整段**当一个 token，中文短语/子串查询几乎必然
0 命中；B9 补的 `_cjk_search`（Python 全表 bigram 重叠扫描）只是正确性兜底，
O(N·L) 且无 BM25/snippet（评审报告：`Open Learning OS — 中文 FTS 架构选型评审.md`，
2026-09-02，架构专家团只读选型）。

选型评审四案加权：**bigram 预分词 70** > trigram+LIKE 67 > jieba 58 > ICU 44。

对 ADR-011 首选路径（trigram）的证伪：SQLite 内置 trigram tokenizer 对 **<3 字符
查询静默 0 命中**，而 2 字词是中文最高频查询长度——选 trigram 必须永久保留短查询
LIKE 回退扫描，无法真正收拢搜索路径（多源交叉确认：intent-engine 源码、openclaw
PR #56707、多篇生产实践）。

## Decision

（所有者裁定 2026-09-02：方案 A）

- **应用侧 CJK bigram 预分词**：新增纯函数模块 `app/core/cjk_bigram.py`
  （`segment`/`tokens`/`is_single_cjk`/`has_token`），FTS **写入与查询共用同一
  segment**——同一切分保证「短语匹配 ≈ 子串命中」（重叠 bigram 序列与子串一一对应）。
- tokenizer 仍为内置 unicode61（不注册自定义 tokenizer：stdlib sqlite3 不暴露该 API，
  apsw/sqlitefts 属新依赖）；**零新增运行时依赖**。
- migration `010_fts_bigram`：DROP + CREATE notes_fts；启动链路（`main.lifespan`
  检测 `db.FTS_REBUILD_VERSIONS`）自动触发 `reindex_vault` 全量重建。
  notes_fts 是纯派生索引，vault/ 仍是唯一事实源，无业务数据迁移。
- `search_notes` 统一 FTS MATCH（ORDER BY rank）；兜底两级：
  单字中文 → LIKE 扫检索文本（segment 保留全部汉字字符，单字不再静默 0 命中）；
  其余 → 标题 LIKE（旧行为）。**`_cjk_search` 全表扫描删除，不留第二套搜索逻辑。**
- `autolink.tokenize` 复用 `cjk_bigram.tokens` 底层规则，自身保留「过滤单字 CJK」
  历史语义；依赖方向 autolink → cjk_bigram，禁止反向。
- **语义边界（有意为之）**：短语 = 连续子串（与 Obsidian 子串搜索一致）；
  bigram 不跨词边界——正文「梯度下降 学习率」不命中查询「梯度下降学习率」。
- 不新增业务表、不新增 truth state、不把 bigram 文本写回 Markdown。

## Alternatives Considered

| 方案 | 结论 |
|---|---|
| trigram + LIKE 回退（ADR-011 原首选） | 零依赖但 2 字查询永不走索引、索引 3–4×、bm25 噪声、Python 兜底无法删除 |
| jieba 预分词 | 六连问 ③ 即止（项目内已有 bigram 实现）；默认词典 trie 常驻 ~150MB、首次 cut 1–3s；检索场景增益边际 |
| ICU tokenizer 扩展 | 逐平台 C 扩展编译/分发（Windows 需 ICU DLL），与 M8 Android 方向冲突最大 |
| sqlitefts/apsw 注册 Python tokenizer | 新依赖 + 要求动态链接 SQLite，违反最小依赖 |

## Consequences

- 中文短语/子串检索正确恢复（FTS 索引路径），BM25 rank / FTS `snippet()` 能力恢复可用
  （snippet 接线归后续任务）。
- notes_fts 列内容为检索文本（非原文快照），任何新消费者不得把它当正文读。
- 已知限制（记录、可接受）：单字查询走 LIKE（规模大时慢，单字查询低频）；
  跨词边界查询需含空格；索引体积约 2× 于纯中文文本（个人 vault 规模无感）。
- 六连问：不新增依赖，无 DEPENDENCIES.md 登记义务。
