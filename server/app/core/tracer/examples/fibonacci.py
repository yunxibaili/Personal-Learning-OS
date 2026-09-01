"""斐波那契递归（FrameStackView）"""


def fibonacci(n: int) -> int:
    if n <= 1:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)


result = fibonacci(6)
print(f"fibonacci(6) = {result}")
