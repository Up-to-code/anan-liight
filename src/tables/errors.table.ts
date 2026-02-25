import type { ErrorCode } from "@shared/errors";
import type { TableDefinition, VersionedRow } from "@tables/types";

export interface DeadLetterRow extends VersionedRow {
  deadLetterId: string;
  scope: string;
  operation: string;
  idempotencyKey: string;
  errorCode: ErrorCode;
  errorMessage: string;
  payloadJson: string;
}

export const ERRORS_TABLE: TableDefinition = {
  tableName: "dead_letters",
  createSql:
    "CREATE TABLE IF NOT EXISTS dead_letters (id TEXT PRIMARY KEY, deadLetterId TEXT UNIQUE, scope TEXT, operation TEXT, idempotencyKey TEXT, errorCode TEXT, errorMessage TEXT, payloadJson TEXT, version BIGINT, createdAt BIGINT, updatedAt BIGINT)",
  indexes: [
    "CREATE INDEX IF NOT EXISTS idx_dead_letters_scope ON dead_letters(scope)",
    "CREATE INDEX IF NOT EXISTS idx_dead_letters_error_code ON dead_letters(errorCode)"
  ]
};
