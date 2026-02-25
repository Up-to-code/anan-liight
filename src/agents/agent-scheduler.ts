import { randomUUID } from "node:crypto";
import type { AgentSchedulerPort } from "@agents/types";

/**
 * Durable scheduler that persists jobs in DB-backed queue rows.
 */
export class AgentScheduler {
  public constructor(private readonly port: AgentSchedulerPort) {}

  /**
   * Schedules job for future execution.
   * @param queueName Logical queue name
   * @param payload JSON payload
   * @param runAt Execution timestamp in ms
   */
  public async schedule(queueName: string, payload: Record<string, string>, runAt: number): Promise<void> {
    await this.port.schedule({
      jobId: randomUUID(),
      queueName,
      payloadJson: JSON.stringify(payload),
      runAt,
      idempotencyKey: randomUUID()
    });
  }

  /**
   * Pulls and acknowledges due jobs by callback.
   * @param queueName Queue name
   * @param limit Max jobs
   * @param execute Callback per job
   */
  public async runDueJobs(
    queueName: string,
    limit: number,
    execute: (job: { jobId: string; payloadJson: string }) => Promise<void>
  ): Promise<void> {
    const now = Date.now();
    const jobs = await this.port.pullDueJobs(queueName, now, limit);

    for (const job of jobs) {
      if (job.status && job.status !== "SCHEDULED") continue;
      if (typeof job.runAt === "number" && job.runAt > now) continue;
      try {
        await execute({ jobId: job.jobId, payloadJson: job.payloadJson });
        await this.port.markCompleted(job.jobId);
      } catch (error) {
        const reason = error instanceof Error ? error.message : "Unknown scheduler error";
        await this.port.markFailed(job.jobId, reason);
      }
    }
  }
}
