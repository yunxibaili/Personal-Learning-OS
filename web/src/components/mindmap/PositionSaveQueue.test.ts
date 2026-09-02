/**
 * PositionSaveQueue 单测（P1-1）。
 * 覆盖：trailing debounce 兜底 / drag-end flush / 同节点去重 / 失败回调 / dispose。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PositionSaveQueue, type FlushItem } from "./PositionSaveQueue";

describe("PositionSaveQueue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const pos = (x: number, y: number) => ({ x, y });

  it("拖动中入队不立即发包，1s 后 trailing flush 最新坐标", async () => {
    const flush = vi.fn(() => Promise.resolve());
    const q = new PositionSaveQueue(flush, () => {}, 1000);

    q.queue(1, pos(10, 20));
    expect(flush).not.toHaveBeenCalled();

    vi.advanceTimersByTime(999);
    expect(flush).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(flush).toHaveBeenCalledTimes(1);
    expect(flush).toHaveBeenCalledWith([{ nodeId: 1, position: pos(10, 20) }]);
  });

  it("同一节点多次入队只保留最后值（trailing 语义）", async () => {
    const flush = vi.fn(() => Promise.resolve());
    const q = new PositionSaveQueue(flush, () => {}, 1000);

    q.queue(1, pos(1, 1));
    q.queue(1, pos(2, 2));
    q.queue(1, pos(3, 3));
    vi.advanceTimersByTime(1000);

    expect(flush).toHaveBeenCalledTimes(1);
    expect(flush).toHaveBeenCalledWith([{ nodeId: 1, position: pos(3, 3) }]);
  });

  it("多个节点合并为一次 flush", async () => {
    const flush = vi.fn(() => Promise.resolve());
    const q = new PositionSaveQueue(flush, () => {}, 1000);

    q.queue(1, pos(1, 1));
    q.queue(2, pos(2, 2));
    q.queue(1, pos(11, 11)); // 同节点覆盖
    vi.advanceTimersByTime(1000);

    expect(flush).toHaveBeenCalledTimes(1);
    expect(flush).toHaveBeenCalledWith([
      { nodeId: 1, position: pos(11, 11) },
      { nodeId: 2, position: pos(2, 2) },
    ]);
  });

  it("drag-end flushNow 立即发包并清掉兜底定时器", async () => {
    const flush = vi.fn(() => Promise.resolve());
    const q = new PositionSaveQueue(flush, () => {}, 1000);

    q.queue(1, pos(5, 5));
    q.queue(2, pos(6, 6));
    q.flushNow();

    expect(flush).toHaveBeenCalledTimes(1);
    expect(flush).toHaveBeenCalledWith([
      { nodeId: 1, position: pos(5, 5) },
      { nodeId: 2, position: pos(6, 6) },
    ]);

    // 定时器已清：再推进时间不重复发包
    vi.advanceTimersByTime(5000);
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it("flushNow 空队列时无副作用", () => {
    const flush = vi.fn(() => Promise.resolve());
    const q = new PositionSaveQueue(flush, () => {}, 1000);
    q.flushNow();
    expect(flush).not.toHaveBeenCalled();
  });

  it("每次入队重置 debounce 计时（经典 trailing）", async () => {
    const flush = vi.fn(() => Promise.resolve());
    const q = new PositionSaveQueue(flush, () => {}, 1000);

    q.queue(1, pos(1, 1));
    vi.advanceTimersByTime(900);
    q.queue(1, pos(2, 2)); // 重置
    vi.advanceTimersByTime(900);
    expect(flush).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(flush).toHaveBeenCalledTimes(1);
    expect(flush).toHaveBeenCalledWith([{ nodeId: 1, position: pos(2, 2) }]);
  });

  it("flush 完成后再次入队重新计时", async () => {
    const flush = vi.fn(() => Promise.resolve());
    const q = new PositionSaveQueue(flush, () => {}, 1000);

    q.queue(1, pos(1, 1));
    vi.advanceTimersByTime(1000);
    expect(flush).toHaveBeenCalledTimes(1);

    q.queue(1, pos(9, 9));
    vi.advanceTimersByTime(1000);
    expect(flush).toHaveBeenCalledTimes(2);
    expect(flush).toHaveBeenLastCalledWith([{ nodeId: 1, position: pos(9, 9) }]);
  });

  it("flush 拒绝时错误交给 onError（不抛未捕获）", async () => {
    const boom = new Error("network down");
    const flush = vi.fn(() => Promise.reject(boom));
    const onError = vi.fn();
    const q = new PositionSaveQueue(flush, onError, 1000);

    q.queue(1, pos(1, 1));
    vi.advanceTimersByTime(1000);
    await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(onError).toHaveBeenCalledWith(boom);
  });

  it("dispose 清掉定时器并把未送达尾批做最后尝试", async () => {
    const flush = vi.fn(() => Promise.resolve());
    const q = new PositionSaveQueue(flush, () => {}, 1000);

    q.queue(1, pos(1, 1));
    q.dispose();
    expect(flush).toHaveBeenCalledTimes(1);
    expect(flush).toHaveBeenCalledWith([{ nodeId: 1, position: pos(1, 1) }]);

    // 定时器已清，dispose 后不再发包
    vi.advanceTimersByTime(5000);
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it("dispose 空队列无副作用", () => {
    const flush = vi.fn(() => Promise.resolve());
    const q = new PositionSaveQueue(flush, () => {}, 1000);
    q.dispose();
    expect(flush).not.toHaveBeenCalled();
  });

  it("flushFn 收到的 items 与入队顺序一致（Map 插入序）", async () => {
    const items: FlushItem[][] = [];
    const flush = vi.fn((batch: FlushItem[]) => {
      items.push(batch);
      return Promise.resolve();
    });
    const q = new PositionSaveQueue(flush, () => {}, 1000);

    q.queue(3, pos(3, 3));
    q.queue(1, pos(1, 1));
    q.queue(2, pos(2, 2));
    vi.advanceTimersByTime(1000);

    expect(items[0].map((i) => i.nodeId)).toEqual([3, 1, 2]);
  });
});
