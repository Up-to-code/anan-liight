import type { AgentScheduler } from "@agents/agent-scheduler";
import type { DeadLetterWriter } from "@lib/retry/dead-letter";
import { StepReplayRegistry } from "@workflows/step-replay-registry";

export interface ReplayWorkerOptions {
  scheduler: AgentScheduler;
  registry: StepReplayRegistry;
  deadLetter: DeadLetterWriter;
  queueName: string;
  maxScheduledRounds: number;
  pollEveryMs?: number;
}

export class StepReplayWorker {
  private timer: NodeJS.Timeout | null = null;

  public constructor(private readonly options: ReplayWorkerOptions) {}

  public start(): void {
    const pollEveryMs = this.options.pollEveryMs ?? 3000;
    this.timer = setInterval(() => {
      void this.tick();
    }, pollEveryMs);
  }

  public stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async tick(): Promise<void> {
    await this.options.scheduler.runDueJobs(this.options.queueName, 50, async (job) => {
      const payload = JSON.parse(job.payloadJson) as {
        actionKey: string;
        workflowRunId: string;
        stepId: string;
        round: number;
      };

      const action = this.options.registry.resolve(payload.actionKey);
      if (!action) {
        await this.options.deadLetter.write({
          deadLetterId: crypto.randomUUID(),
          scope: "workflow-replay",
          operation: `${payload.workflowRunId}:${payload.stepId}`,
          idempotencyKey: `${payload.workflowRunId}:${payload.stepId}:missing_action`,
          errorCode: "NOT_FOUND",
          errorMessage: `Replay action not found: ${payload.actionKey}`,
          payload: { actionKey: payload.actionKey },
          createdAt: Date.now()
        });
        return;
      }

      try {
        await action();
      } catch (error) {
        if (payload.round >= this.options.maxScheduledRounds) {
          await this.options.deadLetter.write({
            deadLetterId: crypto.randomUUID(),
            scope: "workflow-replay",
            operation: `${payload.workflowRunId}:${payload.stepId}`,
            idempotencyKey: `${payload.workflowRunId}:${payload.stepId}:round:${payload.round}`,
            errorCode: "INTERNAL_ERROR",
            errorMessage: error instanceof Error ? error.message : "Replay failed",
            payload: { round: String(payload.round) },
            createdAt: Date.now()
          });
          return;
        }

        const delayMs = Math.min(30000, 1500 * (payload.round + 1));
        await this.options.scheduler.schedule(this.options.queueName, {
          workflowRunId: payload.workflowRunId,
          stepId: payload.stepId,
          actionKey: payload.actionKey,
          round: String(payload.round + 1)
        }, Date.now() + delayMs);
      }
    });
  }
}
