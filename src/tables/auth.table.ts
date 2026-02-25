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
  },
  {
    tableName: "userRoles",
    createSql:
      "CREATE TABLE IF NOT EXISTS userRoles (id TEXT PRIMARY KEY, roleAssignmentId TEXT UNIQUE, userId TEXT, role TEXT, active BOOLEAN, version BIGINT, createdAt BIGINT, updatedAt BIGINT)",
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_user_roles_user ON userRoles(userId)",
      "CREATE INDEX IF NOT EXISTS idx_user_roles_role ON userRoles(role)"
    ]
  },
  {
    tableName: "adminUsers",
    createSql:
      "CREATE TABLE IF NOT EXISTS adminUsers (id TEXT PRIMARY KEY, userId TEXT UNIQUE, enabled BOOLEAN, lastLoginAt BIGINT, version BIGINT, createdAt BIGINT, updatedAt BIGINT)",
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_admin_users_enabled ON adminUsers(enabled)"
    ]
  },
  {
    tableName: "adminProfiles",
    createSql:
      "CREATE TABLE IF NOT EXISTS adminProfiles (id TEXT PRIMARY KEY, userId TEXT UNIQUE, displayName TEXT, notes TEXT, version BIGINT, createdAt BIGINT, updatedAt BIGINT)",
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_admin_profiles_user ON adminProfiles(userId)"
    ]
  }
];
