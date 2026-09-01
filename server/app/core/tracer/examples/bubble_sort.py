"""冒泡排序（ArrayView）"""


def bubble_sort(arr: list[int]) -> None:
    n = len(arr)
    for i in range(n):
        for j in range(0, n - i - 1):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]


data = [64, 34, 25, 12, 22, 11, 90]
print(f"Before: {data}")
bubble_sort(data)
print(f"After:  {data}")
