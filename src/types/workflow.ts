import type { WORKFLOW_STEP_STATES } from "@shared/constants";

export type WorkflowStepState = (typeof WORKFLOW_STEP_STATES)[number];

export interface WorkflowStepRecord {
  workflowRunId: string;
  stepId: string;
  state: WorkflowStepState;
  attempt: number;
  roundType?: "immediate" | "scheduled";
  round?: number;
  model?: string;
  cooldownState?: "closed" | "open" | "half_open";
  retryDelayMs?: number;
  startedAt?: number;
  finishedAt?: number;
  errorCode?: string;
  errorMessage?: string;
}

export interface ExecutionPlan {
  workflowRunId: string;
  name: string;
  steps: Array<{ stepId: string; timeoutMs: number; maxAttempts: number }>;
}
