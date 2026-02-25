import type { TableDefinition, VersionedRow } from "@tables/types";

export interface OutboxRow extends VersionedRow {
  eventId: string;
  topic: string;
  payloadJson: string;
  status: "PENDING" | "SENT" | "FAILED";
  idempotencyKey: string;
}

export const OUTBOX_TABLE: TableDefinition = {
  tableName: "outbox_events",
  createSql:
    "CREATE TABLE IF NOT EXISTS outbox_events (id TEXT PRIMARY KEY, eventId TEXT UNIQUE, topic TEXT, payloadJson TEXT, status TEXT, idempotencyKey TEXT, version BIGINT, createdAt BIGINT, updatedAt BIGINT)",
  indexes: [
    "CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox_events(status)",
    "CREATE INDEX IF NOT EXISTS idx_outbox_topic ON outbox_events(topic)"
  ]
};
