"""快速排序（ArrayView）"""


def quicksort(arr: list[int], lo: int = 0, hi: int | None = None) -> None:
    if hi is None:
        hi = len(arr) - 1
    if lo < hi:
        pivot = arr[hi]
        i = lo
        for j in range(lo, hi):
            if arr[j] <= pivot:
                arr[i], arr[j] = arr[j], arr[i]
                i += 1
        arr[i], arr[hi] = arr[hi], arr[i]
        quicksort(arr, lo, i - 1)
        quicksort(arr, i + 1, hi)


data = [38, 27, 43, 3, 9, 82, 10]
print(f"Before: {data}")
quicksort(data)
print(f"After:  {data}")
