import type { TableDefinition, VersionedRow } from "@tables/types";

export interface IdempotencyRow extends VersionedRow {
  key: string;
  scope: string;
  status: "STARTED" | "COMPLETED" | "FAILED";
  resultJson?: string;
}

export const IDEMPOTENCY_TABLE: TableDefinition = {
  tableName: "idempotency_journal",
  createSql:
    "CREATE TABLE IF NOT EXISTS idempotency_journal (id TEXT PRIMARY KEY, key TEXT, scope TEXT, status TEXT, resultJson TEXT, version BIGINT, createdAt BIGINT, updatedAt BIGINT)",
  indexes: [
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_idempotency_key_scope ON idempotency_journal(key, scope)",
    "CREATE INDEX IF NOT EXISTS idx_idempotency_status ON idempotency_journal(status)"
  ]
};
