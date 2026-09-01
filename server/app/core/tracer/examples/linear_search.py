"""线性查找（GeneralView）"""


def linear_search(arr: list[int], target: int) -> int:
    for i, val in enumerate(arr):
        if val == target:
            return i
    return -1


data = [10, 23, 45, 70, 11, 15]
target = 70
result = linear_search(data, target)
print(f"linear_search({data}, {target}) = {result}")
