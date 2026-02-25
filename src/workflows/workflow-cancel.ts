import { buildStepState } from "@workflows/step-state";
import type { WorkflowPersistencePort, WorkflowStepDefinition } from "@workflows/types";

/**
 * Cancels workflow and runs compensations in reverse step order.
 */
export class WorkflowCancel {
  public constructor(private readonly persistence: WorkflowPersistencePort) {}

  /**
   * Compensates executed steps in reverse order.
   * @param workflowRunId Workflow id
   * @param executedSteps Executed steps
   */
  public async compensate(workflowRunId: string, executedSteps: WorkflowStepDefinition[]): Promise<void> {
    for (const step of [...executedSteps].reverse()) {
      if (!step.compensate) continue;
      await step.compensate();
      await this.persistence.upsertStep(buildStepState(workflowRunId, step.stepId, "COMPENSATED", 1));
    }
    await this.persistence.markRunStatus(workflowRunId, "CANCELLED");
  }
}
