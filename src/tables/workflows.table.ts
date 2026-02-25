import type { TableDefinition, VersionedRow } from "@tables/types";
import type { WorkflowStepState } from "@shared/workflow";

export interface WorkflowRunRow extends VersionedRow {
  workflowRunId: string;
  name: string;
  status: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";
  idempotencyKey: string;
}

export interface WorkflowStepRow extends VersionedRow {
  workflowRunId: string;
  stepId: string;
  state: WorkflowStepState;
  attempt: number;
  errorCode?: string;
  errorMessage?: string;
}

export const WORKFLOWS_TABLES: TableDefinition[] = [
  {
    tableName: "workflow_runs",
    createSql:
      "CREATE TABLE IF NOT EXISTS workflow_runs (id TEXT PRIMARY KEY, workflowRunId TEXT UNIQUE, name TEXT, status TEXT, idempotencyKey TEXT, version BIGINT, createdAt BIGINT, updatedAt BIGINT)",
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_workflow_runs_status ON workflow_runs(status)",
      "CREATE INDEX IF NOT EXISTS idx_workflow_runs_idempotency ON workflow_runs(idempotencyKey)"
    ]
  },
  {
    tableName: "workflow_steps",
    createSql:
      "CREATE TABLE IF NOT EXISTS workflow_steps (id TEXT PRIMARY KEY, workflowRunId TEXT, stepId TEXT, state TEXT, attempt INTEGER, errorCode TEXT, errorMessage TEXT, version BIGINT, createdAt BIGINT, updatedAt BIGINT)",
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_workflow_steps_run ON workflow_steps(workflowRunId)",
      "CREATE INDEX IF NOT EXISTS idx_workflow_steps_state ON workflow_steps(state)"
    ]
  }
];
