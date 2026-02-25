import type { TableDefinition } from "@tables/types";

export const AUTH_TABLES: TableDefinition[] = [
  {
    tableName: "sessionTokens",
    createSql:
      "CREATE TABLE IF NOT EXISTS sessionTokens (id TEXT PRIMARY KEY, sessionId TEXT UNIQUE, userId TEXT, tokenPayloadJson TEXT, expiresAt BIGINT, revoked BOOLEAN, version BIGINT, createdAt BIGINT, updatedAt BIGINT)",
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_session_tokens_user ON sessionTokens(userId)",
      "CREATE INDEX IF NOT EXISTS idx_session_tokens_expires ON sessionTokens(expiresAt)"
    ]
  }
];
