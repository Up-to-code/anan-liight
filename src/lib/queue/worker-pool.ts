import { setTimeout as delay } from "node:timers/promises";
import { TaskQueue } from "@lib/queue/task-queue";

/**
 * Concurrency-limited worker pool that drains a TaskQueue.
 */
export class WorkerPool {
  private running = false;
  private activeWorkers = 0;

  public constructor(
    private readonly queue: TaskQueue,
    private readonly maxConcurrency: number,
    private readonly pollDelayMs = 25
  ) {}

  /**
   * Starts polling workers.
   * @returns Promise resolved when loop exits
   */
  public async start(): Promise<void> {
    this.running = true;
    await Promise.all(Array.from({ length: this.maxConcurrency }, async () => this.loop()));
  }

  /**
   * Requests worker shutdown.
   */
  public stop(): void {
    this.running = false;
  }

  /**
   * Returns currently active worker count.
   * @returns Worker count
   */
  public activeCount(): number {
    return this.activeWorkers;
  }

  private async loop(): Promise<void> {
    while (this.running) {
      const task = this.queue.dequeue();
      if (!task) {
        await delay(this.pollDelayMs);
        continue;
      }

      this.activeWorkers += 1;
      try {
        await task.execute();
      } finally {
        this.activeWorkers -= 1;
      }
    }
  }
}
