import { TaskQueue, type QueuePriority } from "@lib/queue/task-queue";
import { WorkerPool } from "@lib/queue/worker-pool";

/**
 * Agent execution engine with bounded queue and worker pool.
 */
export class AgentRunner {
  private readonly queue: TaskQueue;
  private readonly workers: WorkerPool;

  public constructor(queueName: string, capacity: number, concurrency: number) {
    this.queue = new TaskQueue(queueName, capacity);
    this.workers = new WorkerPool(this.queue, concurrency);
  }

  /**
   * Starts the worker pool.
   */
  public async start(): Promise<void> {
    await this.workers.start();
  }

  /**
   * Stops worker pool gracefully.
   */
  public stop(): void {
    this.workers.stop();
  }

  /**
   * Queues an agent task.
   * @param taskId Unique task id
   * @param priority Queue priority
   * @param execute Async operation
   */
  public enqueue(taskId: string, priority: QueuePriority, execute: () => Promise<void>): void {
    this.queue.enqueue({ taskId, priority, enqueuedAt: Date.now(), execute });
  }

  /**
   * Returns queue depth.
   * @returns Number of queued tasks
   */
  public queueDepth(): number {
    return this.queue.size();
  }
}
