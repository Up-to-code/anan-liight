import type { TableDefinition, VersionedRow } from "@tables/types";

export interface ChatMessageRow extends VersionedRow {
  messageId: string;
  threadId: string;
  userId: string;
  role: "user" | "assistant";
  body: string;
  channel: "web" | "app" | "whatsapp";
}

export const CHAT_MESSAGES_TABLE: TableDefinition = {
  tableName: "chatMessages",
  createSql:
    "CREATE TABLE IF NOT EXISTS chatMessages (id TEXT PRIMARY KEY, messageId TEXT UNIQUE, threadId TEXT, userId TEXT, role TEXT, body TEXT, channel TEXT, version BIGINT, createdAt BIGINT, updatedAt BIGINT)",
  indexes: [
    "CREATE INDEX IF NOT EXISTS idx_chat_messages_thread ON chatMessages(threadId)",
    "CREATE INDEX IF NOT EXISTS idx_chat_messages_user ON chatMessages(userId)"
  ]
};
