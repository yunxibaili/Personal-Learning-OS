"""二分查找（ArrayView）"""


def binary_search(arr: list[int], target: int) -> int:
    lo, hi = 0, len(arr) - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            lo = mid + 1
        else:
            hi = mid - 1
    return -1


data = [2, 3, 4, 10, 40]
target = 10
result = binary_search(data, target)
print(f"binary_search({data}, {target}) = {result}")
