import { randomUUID } from "node:crypto";
import { AppError } from "@lib/errors/app-error";
import { WorkflowCancel } from "@workflows/workflow-cancel";
import { StepRunner } from "@workflows/step-runner";
import type { WorkflowPersistencePort, WorkflowStepDefinition } from "@workflows/types";

/**
 * Durable workflow engine with compensation support.
 */
export class WorkflowEngine {
  private readonly stepRunner: StepRunner;
  private readonly canceller: WorkflowCancel;

  public constructor(stepRunner: StepRunner, persistence: WorkflowPersistencePort) {
    this.stepRunner = stepRunner;
    this.canceller = new WorkflowCancel(persistence);
    this.persistence = persistence;
  }

  private readonly persistence: WorkflowPersistencePort;

  /**
   * Runs workflow steps sequentially with durable status transitions.
   * @param name Workflow name
   * @param idempotencyKey Idempotency key
   * @param steps Step definitions
   * @returns Workflow run id
   */
  public async run(name: string, idempotencyKey: string, steps: WorkflowStepDefinition[]): Promise<string> {
    const workflowRunId = randomUUID();
    const executed: WorkflowStepDefinition[] = [];

    await this.persistence.createRun({ workflowRunId, name, idempotencyKey });
    await this.persistence.markRunStatus(workflowRunId, "RUNNING");

    try {
      for (const step of steps) {
        await this.stepRunner.run(workflowRunId, step);
        executed.push(step);
      }
      await this.persistence.markRunStatus(workflowRunId, "SUCCEEDED");
      return workflowRunId;
    } catch (error) {
      if (error instanceof AppError && error.code === "TIMEOUT" && error.retryable) {
        // Keep workflow alive while scheduled replay rounds execute.
        await this.persistence.markRunStatus(workflowRunId, "RUNNING");
        return workflowRunId;
      }
      await this.persistence.markRunStatus(workflowRunId, "FAILED");
      await this.canceller.compensate(workflowRunId, executed);
      throw error;
    }
  }
}
