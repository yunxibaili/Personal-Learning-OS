/**
 * 拖拽坐标保存队列（P1-1）。
 *
 * 策略（评审裁定）：drag-end flush + trailing debounce 兜底。
 *   - 拖动中（dragging=true）每个 change 只入队，不发包；
 *     1s trailing debounce 作为兜底——若 drag-end 信号丢失（组件卸载、异常路径），
 *     尾批坐标仍会送达。
 *   - 拖动结束（dragging=false）立即 flush，清掉挂着的兜底定时器。
 *
 * 纯逻辑、零 React 依赖，方便单测（PositionSaveQueue.test.ts）。
 */

export interface PendingPosition {
  x: number;
  y: number;
}

export interface FlushItem {
  nodeId: number;
  position: PendingPosition;
}

export type FlushFn = (items: FlushItem[]) => Promise<void>;

export class PositionSaveQueue {
  private pending = new Map<number, PendingPosition>();
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    /** 把一批待存坐标发到后端；由调用方注入（含 mapId 闭包） */
    private readonly flush: FlushFn,
    /** flush 失败回调；由调用方注入（如 setError） */
    private readonly onError: (e: unknown) => void,
    /** trailing debounce 间隔（ms），默认 1000 */
    private readonly delayMs = 1000,
  ) {}

  /** 入队一个节点的最新坐标（同节点多次入队只保留最后值） */
  queue(nodeId: number, position: PendingPosition): void {
    this.pending.set(nodeId, position);
    this.arm();
  }

  /** 立即 flush 全部待存坐标（drag-end 调用）；空队列时无副作用 */
  flushNow(): void {
    this.clearTimer();
    if (this.pending.size === 0) return;
    const items = [...this.pending];
    this.pending.clear();
    this.doFlush(items);
  }

  /**
   * 组件卸载时调用：清掉兜底定时器，未送达的尾批做最后一次 fire-and-forget 尝试。
   * flush 闭包内只依赖 ref / 模块级 api，卸载后执行仍安全。
   */
  dispose(): void {
    this.clearTimer();
    if (this.pending.size === 0) return;
    const items = [...this.pending];
    this.pending.clear();
    this.doFlush(items);
  }

  /** 挂/重挂兜底定时器（经典 trailing debounce：每次入队重置） */
  private arm(): void {
    this.clearTimer();
    this.timer = setTimeout(() => {
      this.timer = null;
      this.flushNow();
    }, this.delayMs);
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private doFlush(items: [number, PendingPosition][]): void {
    const payload = items.map(([nodeId, position]) => ({ nodeId, position }));
    this.flush(payload).catch(this.onError);
  }
}
