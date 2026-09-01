"""
示例清单（ADR-025 §3.3）
example_id 是清单枚举键，不是文件路径
"""
from pathlib import Path
from typing import Literal

# 示例目录（随代码发布，属应用资产，绝不放 workspace/vault/）
EXAMPLES_DIR = Path(__file__).parent


class ExampleEntry:
    """示例条目"""

    def __init__(
        self,
        example_id: str,
        title: str,
        concept_title: str,
        template: Literal["FrameStackView", "ArrayView", "GeneralView"],
        filename: str,
    ) -> None:
        self.example_id = example_id
        self.title = title
        self.concept_title = concept_title
        self.template = template
        self.filename = filename

    @property
    def path(self) -> Path:
        """获取示例文件路径（通过 manifest 映射，不直接拼接）"""
        return EXAMPLES_DIR / self.filename


# 示例清单（ADR-025 §3.3）
EXAMPLES: list[ExampleEntry] = [
    ExampleEntry(
        example_id="quicksort-basic",
        title="快速排序",
        concept_title="快速排序",
        template="ArrayView",
        filename="quicksort_basic.py",
    ),
    ExampleEntry(
        example_id="binary-search",
        title="二分查找",
        concept_title="二分查找",
        template="ArrayView",
        filename="binary_search.py",
    ),
    ExampleEntry(
        example_id="bubble-sort",
        title="冒泡排序",
        concept_title="冒泡排序",
        template="ArrayView",
        filename="bubble_sort.py",
    ),
    ExampleEntry(
        example_id="factorial",
        title="阶乘递归",
        concept_title="阶乘递归",
        template="FrameStackView",
        filename="factorial.py",
    ),
    ExampleEntry(
        example_id="fibonacci",
        title="斐波那契递归",
        concept_title="斐波那契递归",
        template="FrameStackView",
        filename="fibonacci.py",
    ),
    ExampleEntry(
        example_id="linear-search",
        title="线性查找",
        concept_title="线性查找",
        template="GeneralView",
        filename="linear_search.py",
    ),
]

# 构建索引（加载期校验唯一性，ADR-025 §3.3 规则 2）
_EXAMPLE_BY_ID: dict[str, ExampleEntry] = {}
_CONCEPT_TITLE_TO_EXAMPLE: dict[str, ExampleEntry] = {}

for ex in EXAMPLES:
    if ex.example_id in _EXAMPLE_BY_ID:
        raise ValueError(f"Duplicate example_id: {ex.example_id}")
    _EXAMPLE_BY_ID[ex.example_id] = ex

    if ex.concept_title in _CONCEPT_TITLE_TO_EXAMPLE:
        raise ValueError(
            f"Duplicate concept_title: {ex.concept_title} "
            f"(entries: {_CONCEPT_TITLE_TO_EXAMPLE[ex.concept_title].example_id} and {ex.example_id})"
        )
    _CONCEPT_TITLE_TO_EXAMPLE[ex.concept_title] = ex


def get_example(example_id: str) -> ExampleEntry | None:
    """通过 example_id 获取示例（ADR-025 §3.3）"""
    return _EXAMPLE_BY_ID.get(example_id)


def get_example_for_concept(concept_title: str) -> ExampleEntry | None:
    """通过 concept_title 获取示例（ADR-025 §3.3）"""
    return _CONCEPT_TITLE_TO_EXAMPLE.get(concept_title)


def list_examples() -> list[ExampleEntry]:
    """列出所有示例"""
    return EXAMPLES.copy()
