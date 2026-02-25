import type { WorkflowStepRecord, WorkflowStepState } from "@shared/workflow";

/**
 * Creates deterministic workflow step records for persistence.
 * @param workflowRunId Workflow run id
 * @param stepId Step identifier
 * @param state Current step state
 * @param attempt Attempt number
 * @param error Optional error metadata
 * @returns Step record
 */
export function buildStepState(
  workflowRunId: string,
  stepId: string,
  state: WorkflowStepState,
  attempt: number,
  error?: { code: string; message: string },
  metadata?: {
    roundType?: "immediate" | "scheduled";
    round?: number;
    model?: string;
    cooldownState?: "closed" | "open" | "half_open";
    retryDelayMs?: number;
  }
): WorkflowStepRecord {
  const now = Date.now();
  const base: WorkflowStepRecord = {
    workflowRunId,
    stepId,
    state,
    attempt,
    ...metadata,
    startedAt: now
  };

  if (["SUCCEEDED", "FAILED", "COMPENSATED", "CANCELLED"].includes(state)) {
    base.finishedAt = now;
  }
  if (error?.code) base.errorCode = error.code;
  if (error?.message) base.errorMessage = error.message;
  return base;
}
