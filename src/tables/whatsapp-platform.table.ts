import type { TableDefinition } from "@tables/types";

export const WHATSAPP_PLATFORM_TABLES: TableDefinition[] = [
  {
    tableName: "wa_templates",
    createSql:
      "CREATE TABLE IF NOT EXISTS wa_templates (id TEXT PRIMARY KEY, templateId TEXT UNIQUE, name TEXT, language TEXT, category TEXT, body TEXT, variablesJson TEXT, status TEXT, createdAt BIGINT, updatedAt BIGINT, version BIGINT)",
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_wa_templates_name ON wa_templates(name)",
      "CREATE INDEX IF NOT EXISTS idx_wa_templates_status ON wa_templates(status)"
    ]
  },
  {
    tableName: "wa_template_versions",
    createSql:
      "CREATE TABLE IF NOT EXISTS wa_template_versions (id TEXT PRIMARY KEY, versionId TEXT UNIQUE, templateId TEXT, status TEXT, providerStatus TEXT, createdAt BIGINT, updatedAt BIGINT, version BIGINT)",
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_wa_template_versions_template ON wa_template_versions(templateId)",
      "CREATE INDEX IF NOT EXISTS idx_wa_template_versions_status ON wa_template_versions(status)"
    ]
  },
  {
    tableName: "wa_campaigns",
    createSql:
      "CREATE TABLE IF NOT EXISTS wa_campaigns (id TEXT PRIMARY KEY, campaignId TEXT UNIQUE, name TEXT, templateId TEXT, messageKind TEXT, payloadJson TEXT, audienceJson TEXT, scheduledAt BIGINT, status TEXT, createdAt BIGINT, updatedAt BIGINT, version BIGINT)",
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_wa_campaigns_status ON wa_campaigns(status)",
      "CREATE INDEX IF NOT EXISTS idx_wa_campaigns_scheduled ON wa_campaigns(scheduledAt)"
    ]
  },
  {
    tableName: "wa_campaign_recipients",
    createSql:
      "CREATE TABLE IF NOT EXISTS wa_campaign_recipients (id TEXT PRIMARY KEY, recipientId TEXT UNIQUE, campaignId TEXT, userId TEXT, phoneNumber TEXT, status TEXT, createdAt BIGINT, updatedAt BIGINT, version BIGINT)",
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_wa_campaign_recipients_campaign ON wa_campaign_recipients(campaignId)",
      "CREATE INDEX IF NOT EXISTS idx_wa_campaign_recipients_phone ON wa_campaign_recipients(phoneNumber)"
    ]
  },
  {
    tableName: "wa_send_jobs",
    createSql:
      "CREATE TABLE IF NOT EXISTS wa_send_jobs (id TEXT PRIMARY KEY, jobId TEXT UNIQUE, campaignId TEXT, payloadJson TEXT, status TEXT, runAt BIGINT, createdAt BIGINT, updatedAt BIGINT, version BIGINT)",
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_wa_send_jobs_status ON wa_send_jobs(status)",
      "CREATE INDEX IF NOT EXISTS idx_wa_send_jobs_run_at ON wa_send_jobs(runAt)"
    ]
  },
  {
    tableName: "wa_send_attempts",
    createSql:
      "CREATE TABLE IF NOT EXISTS wa_send_attempts (id TEXT PRIMARY KEY, attemptId TEXT UNIQUE, jobId TEXT, phoneNumber TEXT, providerMessageId TEXT, status TEXT, errorCode TEXT, errorMessage TEXT, latencyMs INTEGER, createdAt BIGINT, updatedAt BIGINT, version BIGINT)",
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_wa_send_attempts_job ON wa_send_attempts(jobId)",
      "CREATE INDEX IF NOT EXISTS idx_wa_send_attempts_status ON wa_send_attempts(status)"
    ]
  },
  {
    tableName: "wa_conversation_windows",
    createSql:
      "CREATE TABLE IF NOT EXISTS wa_conversation_windows (id TEXT PRIMARY KEY, windowId TEXT UNIQUE, phoneNumber TEXT, userId TEXT, lastInboundAt BIGINT, windowOpenUntil BIGINT, createdAt BIGINT, updatedAt BIGINT, version BIGINT)",
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_wa_windows_phone ON wa_conversation_windows(phoneNumber)",
      "CREATE INDEX IF NOT EXISTS idx_wa_windows_user ON wa_conversation_windows(userId)"
    ]
  },
  {
    tableName: "wa_feedback_events",
    createSql:
      "CREATE TABLE IF NOT EXISTS wa_feedback_events (id TEXT PRIMARY KEY, feedbackId TEXT UNIQUE, campaignId TEXT, messageId TEXT, source TEXT, level TEXT, text TEXT, createdAt BIGINT, updatedAt BIGINT, version BIGINT)",
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_wa_feedback_campaign ON wa_feedback_events(campaignId)",
      "CREATE INDEX IF NOT EXISTS idx_wa_feedback_level ON wa_feedback_events(level)"
    ]
  },
  {
    tableName: "wa_number_performance_snapshots",
    createSql:
      "CREATE TABLE IF NOT EXISTS wa_number_performance_snapshots (id TEXT PRIMARY KEY, snapshotId TEXT UNIQUE, phoneNumber TEXT, sent INTEGER, delivered INTEGER, failed INTEGER, avgLatencyMs INTEGER, createdAt BIGINT, updatedAt BIGINT, version BIGINT)",
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_wa_perf_phone ON wa_number_performance_snapshots(phoneNumber)",
      "CREATE INDEX IF NOT EXISTS idx_wa_perf_created ON wa_number_performance_snapshots(createdAt)"
    ]
  },
  {
    tableName: "wa_policy_audit_log",
    createSql:
      "CREATE TABLE IF NOT EXISTS wa_policy_audit_log (id TEXT PRIMARY KEY, auditId TEXT UNIQUE, event TEXT, payloadJson TEXT, createdAt BIGINT, updatedAt BIGINT, version BIGINT)",
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_wa_policy_event ON wa_policy_audit_log(event)",
      "CREATE INDEX IF NOT EXISTS idx_wa_policy_created ON wa_policy_audit_log(createdAt)"
    ]
  }
];
