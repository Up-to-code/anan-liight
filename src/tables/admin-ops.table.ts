import type { TableDefinition } from "@tables/types";

export const ADMIN_OPS_TABLES: TableDefinition[] = [
  {
    tableName: "api_event_log",
    createSql:
      "CREATE TABLE IF NOT EXISTS api_event_log (id TEXT PRIMARY KEY, eventId TEXT UNIQUE, requestId TEXT, route TEXT, method TEXT, status INTEGER, latencyMs INTEGER, level TEXT, errorCode TEXT, errorMessage TEXT, traceId TEXT, createdAt BIGINT, updatedAt BIGINT, version BIGINT)",
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_api_event_log_created ON api_event_log(createdAt)",
      "CREATE INDEX IF NOT EXISTS idx_api_event_log_status ON api_event_log(status)",
      "CREATE INDEX IF NOT EXISTS idx_api_event_log_route ON api_event_log(route)"
    ]
  },
  {
    tableName: "webhook_event_log",
    createSql:
      "CREATE TABLE IF NOT EXISTS webhook_event_log (id TEXT PRIMARY KEY, eventId TEXT UNIQUE, provider TEXT, eventType TEXT, status TEXT, signatureValid BOOLEAN, messageId TEXT, phoneNumber TEXT, payloadHash TEXT, errorCode TEXT, createdAt BIGINT, updatedAt BIGINT, version BIGINT)",
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_webhook_event_log_created ON webhook_event_log(createdAt)",
      "CREATE INDEX IF NOT EXISTS idx_webhook_event_log_status ON webhook_event_log(status)",
      "CREATE INDEX IF NOT EXISTS idx_webhook_event_log_message_id ON webhook_event_log(messageId)"
    ]
  },
  {
    tableName: "admin_action_audit",
    createSql:
      "CREATE TABLE IF NOT EXISTS admin_action_audit (id TEXT PRIMARY KEY, actionId TEXT UNIQUE, actorUserId TEXT, actorTenantId TEXT, actorAuthSource TEXT, actionType TEXT, targetType TEXT, targetId TEXT, reason TEXT, confirmationPhraseHash TEXT, payloadJson TEXT, result TEXT, createdAt BIGINT, updatedAt BIGINT, version BIGINT)",
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_admin_action_audit_created ON admin_action_audit(createdAt)",
      "CREATE INDEX IF NOT EXISTS idx_admin_action_audit_action_type ON admin_action_audit(actionType)",
      "CREATE INDEX IF NOT EXISTS idx_admin_action_audit_actor ON admin_action_audit(actorUserId)"
    ]
  }
];
