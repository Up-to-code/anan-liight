import { AppError } from "@lib/errors/app-error";
import type { AgentScheduler } from "@agents/agent-scheduler";
import type { DeadLetterWriter } from "@lib/retry/dead-letter";
import type { ErrorCode } from "@shared/errors";
import { buildStepState } from "@workflows/step-state";
import { StepReplayRegistry } from "@workflows/step-replay-registry";
import type { WorkflowPersistencePort, WorkflowStepDefinition } from "@workflows/types";

export interface StepRunnerOptions {
  immediateRetries: number;
  scheduledRetries: number;
  scheduler?: AgentScheduler;
  replayQueueName?: string;
  replayRegistry?: StepReplayRegistry;
  deadLetter?: DeadLetterWriter;
}

/**
 * Executes one workflow step with immediate retries, then durable scheduled rounds.
 */
export class StepRunner {
  public constructor(
    private readonly persistence: WorkflowPersistencePort,
    private readonly options: StepRunnerOptions
  ) {}

  public async run(workflowRunId: string, step: WorkflowStepDefinition): Promise<void> {
    const actionKey = step.replayActionKey ?? `${workflowRunId}:${step.stepId}`;
    this.options.replayRegistry?.register(actionKey, step.execute);

    await this.persistence.upsertStep(
      buildStepState(workflowRunId, step.stepId, "RUNNING", 1, undefined, {
        roundType: "immediate",
        round: 1,
        cooldownState: "closed"
      })
    );

    for (let attempt = 1; attempt <= this.options.immediateRetries; attempt += 1) {
      await this.persistence.logStepAttempt({
        workflowRunId,
        stepId: step.stepId,
        attempt,
        roundType: "immediate",
        round: attempt,
        status: "RUNNING"
      });

      try {
        await this.withTimeout(step.execute, step.timeoutMs);
        await this.persistence.logStepAttempt({
          workflowRunId,
          stepId: step.stepId,
          attempt,
          roundType: "immediate",
          round: attempt,
          status: "SUCCEEDED"
        });
        await this.persistence.upsertStep(
          buildStepState(workflowRunId, step.stepId, "SUCCEEDED", attempt, undefined, {
            roundType: "immediate",
            round: attempt
          })
        );
        return;
      } catch (error) {
        const appError = this.normalizeStepError(step.stepId, error);
        await this.persistence.logStepAttempt({
          workflowRunId,
          stepId: step.stepId,
          attempt,
          roundType: "immediate",
          round: attempt,
          status: "FAILED",
          errorCode: appError.code,
          errorMessage: appError.message,
          ...(attempt < this.options.immediateRetries ? { retryDelayMs: this.computeRetryDelay(attempt) } : {})
        });

        if (attempt < this.options.immediateRetries) {
          await this.delay(this.computeRetryDelay(attempt));
          continue;
        }

        await this.persistence.upsertStep(
          buildStepState(workflowRunId, step.stepId, "FAILED", attempt, {
            code: appError.code,
            message: appError.message
          }, {
            roundType: "immediate",
            round: attempt
          })
        );

        await this.scheduleReplayRounds(workflowRunId, step.stepId, actionKey);
        throw new AppError({
          code: "TIMEOUT",
          message: `Step ${step.stepId} deferred to scheduled replay rounds`,
          payload: { timeoutMs: step.timeoutMs, operation: `${workflowRunId}:${step.stepId}` },
          retryable: true,
          cause: appError
        });
      }
    }
  }

  private async scheduleReplayRounds(workflowRunId: string, stepId: string, actionKey: string): Promise<void> {
    if (!this.options.scheduler || !this.options.scheduledRetries) return;

    const queueName = this.options.replayQueueName ?? "workflow-step-replay";
    for (let round = 1; round <= this.options.scheduledRetries; round += 1) {
      const delayMs = this.computeScheduledDelay(round);
      await this.options.scheduler.schedule(
        queueName,
        {
          workflowRunId,
          stepId,
          actionKey,
          round: String(round)
        },
        Date.now() + delayMs
      );

      await this.persistence.logStepAttempt({
        workflowRunId,
        stepId,
        attempt: this.options.immediateRetries + round,
        roundType: "scheduled",
        round,
        status: "RUNNING",
        retryDelayMs: delayMs
      });
    }

    if (this.options.deadLetter) {
      await this.options.deadLetter.write({
        deadLetterId: crypto.randomUUID(),
        scope: "workflow-step",
        operation: `${workflowRunId}:${stepId}`,
        idempotencyKey: `${workflowRunId}:${stepId}:scheduled`,
        errorCode: "TIMEOUT",
        errorMessage: "Step failed immediate retries; scheduled replay rounds queued",
        payload: { replayRounds: String(this.options.scheduledRetries) },
        createdAt: Date.now()
      });
    }
  }

  private normalizeStepError(stepId: string, error: unknown): AppError<ErrorCode> {
    if (error instanceof AppError) return error;
    return new AppError({
      code: "INTERNAL_ERROR",
      message: "Workflow step failed",
      payload: { detail: error instanceof Error ? error.message : "Unknown step error", operation: stepId },
      retryable: false,
      cause: error
    });
  }

  private computeRetryDelay(attempt: number): number {
    return Math.min(3000, 250 * 2 ** (attempt - 1));
  }

  private computeScheduledDelay(round: number): number {
    return Math.min(60000, 2000 * round);
  }

  private async withTimeout(execute: () => Promise<void>, timeoutMs: number): Promise<void> {
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new AppError({
          code: "TIMEOUT",
          message: `Workflow step timeout after ${timeoutMs}ms`,
          payload: { timeoutMs, operation: "workflow-step" },
          retryable: true
        }));
      }, timeoutMs);
    });
    await Promise.race([execute(), timeout]);
  }

  private async delay(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
