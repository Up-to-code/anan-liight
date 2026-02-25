import type { WorkflowStepRecord } from "@shared/workflow";

export interface WorkflowPersistencePort {
  createRun(input: { workflowRunId: string; name: string; idempotencyKey: string }): Promise<void>;
  markRunStatus(workflowRunId: string, status: "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED"): Promise<void>;
  upsertStep(step: WorkflowStepRecord): Promise<void>;
  logStepAttempt(input: {
    workflowRunId: string;
    stepId: string;
    attempt: number;
    roundType: "immediate" | "scheduled";
    round: number;
    model?: string;
    cooldownState?: "closed" | "open" | "half_open";
    retryDelayMs?: number;
    status: "RUNNING" | "SUCCEEDED" | "FAILED";
    errorCode?: string;
    errorMessage?: string;
  }): Promise<void>;
}

export interface WorkflowStepDefinition {
  stepId: string;
  timeoutMs: number;
  maxAttempts: number;
  replayActionKey?: string;
  execute: () => Promise<void>;
  compensate?: () => Promise<void>;
}
