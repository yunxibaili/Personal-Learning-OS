"""cjk_bigram 切分契约测试（ADR-027）。

覆盖所有者指定的边界：单字 / 双字 / 连续中文 / 中英混合 / 数字，
外加写入-查询一致性（同一切分 ⇒ 查询词元序列是文档词元序列的连续子序列）。
"""
from __future__ import annotations

import pytest

from app.core.cjk_bigram import has_token, is_single_cjk, segment, tokens


class TestSegment:
    def test_single_char_run_kept_as_is(self):
        """单字 run：原样保留（孤立单字自成词元）。"""
        assert segment("熵") == "熵"

    def test_two_char_run_single_bigram(self):
        """双字 run：bigram 即自身，不插空格。"""
        assert segment("学习") == "学习"

    def test_long_run_overlapping_bigrams(self):
        """连续中文：重叠 bigram，空格分隔。"""
        assert segment("注意力机制") == "注意 意力 力机 机制"

    def test_mixed_cjk_latin(self):
        """中英混合：CJK run 切 bigram，拉丁词原样（含大小写）。"""
        assert segment("用 Transformer 学注意力") == "用 Transformer 学注 注意 意力"

    def test_digits_and_punct_preserved(self):
        """数字/标点原样保留（大小写不折叠）。"""
        assert segment("GPT-4 时代，注意力！") == "GPT-4 时代，注意 意力！"

    def test_empty(self):
        assert segment("") == ""

    def test_segment_is_stable_under_resegmentation(self):
        """segment 幂等：对检索文本再切分结果不变（FTS 列可安全重放）。"""
        doc = "注意力机制是深度学习的核心，self-attention 更是关键"
        assert segment(segment(doc)) == segment(doc)


class TestTokens:
    def test_tokens_match_segment_bigrams(self):
        doc = "注意力机制"
        assert tokens(doc) == ["注意", "意力", "力机", "机制"]
        assert tokens(segment(doc)) == tokens(doc)

    def test_latin_words_case_preserved(self):
        assert tokens("Attention Is All You Need") == [
            "Attention", "Is", "All", "You", "Need"]

    def test_digits_and_underscore_words(self):
        assert tokens("GPT_4 v2") == ["GPT_4", "v2"]

    def test_mixed_and_single_char(self):
        assert tokens("熵 S=Nk") == ["熵", "S", "Nk"]

    def test_empty(self):
        assert tokens("") == []


class TestGuards:
    def test_is_single_cjk(self):
        assert is_single_cjk("熵")
        assert is_single_cjk("  熵 ")
        assert not is_single_cjk("学习")
        assert not is_single_cjk("a")
        assert not is_single_cjk("!")
        assert not is_single_cjk("")

    def test_has_token(self):
        assert has_token("学习")
        assert has_token("abc")
        assert has_token("123")
        assert not has_token("！！？")
        assert not has_token("")


class TestWriteQueryContract:
    def test_query_tokens_are_contiguous_subsequence(self):
        """写入-查询一致性：查询词元序列必须是文档词元序列的连续子序列。

        这是「短语匹配 ≈ 子串命中」的结构保证——写入与查询共用 segment
        后，FTS5 短语匹配等价于子串存在性。
        """
        doc = "注意力机制是深度学习的核心"
        for q in ["注意力", "力机制", "深度学习", "机制", "学习"]:
            q_tokens = tokens(segment(q))
            doc_tokens = tokens(segment(doc))
            assert any(
                doc_tokens[i:i + len(q_tokens)] == q_tokens
                for i in range(len(doc_tokens) - len(q_tokens) + 1)
            ), f"{q!r} should be a contiguous subsequence of {doc!r}"

    def test_non_substring_query_not_matched(self):
        """跨字查询（非连续子串）不构成连续子序列——不会误命中。"""
        doc_tokens = tokens(segment("注意力机制是深度学习的核心"))
        q_tokens = tokens(segment("注机制"))
        assert not any(
            doc_tokens[i:i + len(q_tokens)] == q_tokens
            for i in range(len(doc_tokens) - len(q_tokens) + 1)
        )


class TestSearchIntegration:
    """core 层集成：真实 SQLite FTS5 上验证 bigram 检索与单字兜底。"""

    @pytest.fixture()
    def indexed_conn(self, core_conn):
        from app.core.knowledge import upsert_note_index

        upsert_note_index(
            core_conn, note_id=1, path="注意力.md", title="注意力",
            tags=[], body="注意力机制是深度学习的核心", mtime=0.0)
        upsert_note_index(
            core_conn, note_id=2, path="信息论.md", title="信息论",
            tags=[], body="熵是信息论的核心度量", mtime=0.0)
        core_conn.commit()
        return core_conn

    def test_cjk_phrase_via_fts(self, indexed_conn):
        from app.core.knowledge import search_notes

        res = search_notes(indexed_conn, "注意力机制")
        assert [r["title"] for r in res] == ["注意力"]

    def test_two_char_query(self, indexed_conn):
        from app.core.knowledge import search_notes

        # 非连续子串（熵…论不相邻）不构成连续 bigram 子序列 → 不命中
        assert search_notes(indexed_conn, "熵论") == []
        res = search_notes(indexed_conn, "核心")
        assert {r["title"] for r in res} == {"注意力", "信息论"}

    def test_single_char_query_no_silent_miss(self, indexed_conn):
        """单字中文查询必须命中 run 内的该字（LIKE 兜底，不再静默 0 命中）。"""
        from app.core.knowledge import search_notes

        # 「熵」只出现在 run 内部（熵是信息论...），bigram 词元不含孤立「熵」
        res = search_notes(indexed_conn, "熵")
        assert [r["title"] for r in res] == ["信息论"]

    def test_latin_query(self, indexed_conn):
        from app.core.cjk_bigram import segment
        from app.core.knowledge import search_notes, upsert_note_index

        upsert_note_index(
            indexed_conn, note_id=3, path="Attention.md", title="Attention",
            tags=[], body="Self-attention is key", mtime=0.0)
        indexed_conn.commit()
        res = search_notes(indexed_conn, "attention")
        assert {r["title"] for r in res} == {"Attention"}

    def test_pure_punctuation_query_is_safe(self, indexed_conn):
        """纯标点查询不抛异常、不误命中（标题 LIKE 兜底路径）。"""
        from app.core.knowledge import search_notes

        assert search_notes(indexed_conn, "！！！") == []

    def test_fts_special_chars_no_exception(self, indexed_conn):
        from app.core.knowledge import search_notes

        for q in ["a-b", "hello(world)", "C++指针", 'test"quote', "OR"]:
            assert search_notes(indexed_conn, q) is not None
