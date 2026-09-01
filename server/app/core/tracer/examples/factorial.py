"""阶乘递归（FrameStackView）"""


def factorial(n: int) -> int:
    if n <= 1:
        return 1
    return n * factorial(n - 1)


result = factorial(5)
print(f"factorial(5) = {result}")
