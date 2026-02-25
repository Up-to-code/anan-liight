import type { TableDefinition, VersionedRow } from "@tables/types";

export interface ScheduledJobRow extends VersionedRow {
  jobId: string;
  queueName: string;
  payloadJson: string;
  runAt: number;
  status: "SCHEDULED" | "RUNNING" | "COMPLETED" | "FAILED";
  idempotencyKey: string;
}

export const SCHEDULER_TABLE: TableDefinition = {
  tableName: "scheduler_jobs",
  createSql:
    "CREATE TABLE IF NOT EXISTS scheduler_jobs (id TEXT PRIMARY KEY, jobId TEXT UNIQUE, queueName TEXT, payloadJson TEXT, runAt BIGINT, status TEXT, idempotencyKey TEXT, version BIGINT, createdAt BIGINT, updatedAt BIGINT)",
  indexes: [
    "CREATE INDEX IF NOT EXISTS idx_scheduler_jobs_run_at ON scheduler_jobs(runAt)",
    "CREATE INDEX IF NOT EXISTS idx_scheduler_jobs_status ON scheduler_jobs(status)"
  ]
};
