import type { TableDefinition, VersionedRow } from "@tables/types";

export interface MessageBusRow extends VersionedRow {
  messageId: string;
  fromAgentId: string;
  toAgentId: string;
  topic: string;
  payloadJson: string;
  idempotencyKey: string;
}

export const MESSAGES_TABLE: TableDefinition = {
  tableName: "agent_messages",
  createSql:
    "CREATE TABLE IF NOT EXISTS agent_messages (id TEXT PRIMARY KEY, messageId TEXT UNIQUE, fromAgentId TEXT, toAgentId TEXT, topic TEXT, payloadJson TEXT, idempotencyKey TEXT, version BIGINT, createdAt BIGINT, updatedAt BIGINT)",
  indexes: [
    "CREATE INDEX IF NOT EXISTS idx_agent_messages_to_agent ON agent_messages(toAgentId)",
    "CREATE INDEX IF NOT EXISTS idx_agent_messages_topic ON agent_messages(topic)"
  ]
};
