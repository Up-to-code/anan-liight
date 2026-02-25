import { AppError } from "@lib/errors/app-error";
import type { PRIORITY_LEVELS } from "@shared/constants";

export type QueuePriority = (typeof PRIORITY_LEVELS)[number];

export interface QueueTask {
  taskId: string;
  priority: QueuePriority;
  enqueuedAt: number;
  execute: () => Promise<void>;
}

/**
 * Priority queue with bounded capacity and explicit backpressure.
 */
export class TaskQueue {
  private readonly high: QueueTask[] = [];
  private readonly normal: QueueTask[] = [];
  private readonly low: QueueTask[] = [];

  public constructor(private readonly queueName: string, private readonly capacity: number) {}

  /**
   * Adds task to queue or throws QueueFullError when saturated.
   * @param task Queue task
   * @returns Void
   * @throws AppError<"QUEUE_FULL">
   */
  public enqueue(task: QueueTask): void {
    if (this.size() >= this.capacity) {
      throw new AppError({
        code: "QUEUE_FULL",
        message: `Queue ${this.queueName} is saturated`,
        payload: { queueName: this.queueName, capacity: this.capacity },
        retryable: false
      });
    }

    if (task.priority === "HIGH") this.high.push(task);
    else if (task.priority === "NORMAL") this.normal.push(task);
    else this.low.push(task);
  }

  /**
   * Takes next task in priority order.
   * @returns Next task or null when empty
   */
  public dequeue(): QueueTask | null {
    return this.high.shift() ?? this.normal.shift() ?? this.low.shift() ?? null;
  }

  /**
   * Returns queued task count.
   * @returns Queue size
   */
  public size(): number {
    return this.high.length + this.normal.length + this.low.length;
  }
}
